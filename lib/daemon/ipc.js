const net = require('net');
const fs = require('fs');
const { DAEMON_SOCK, TIMEOUTS } = require('../utils/constants');
const { DaemonError } = require('../utils/errors');

// Store pending requests (for client)
const pendingRequests = new Map(); // Map<requestId, {resolve, reject, timeout}>

// Generate unique request ID
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create IPC server (daemon side)
 * @param {Function} commandHandler - Handler function for commands
 * @returns {net.Server} Server instance
 */
function createIPCServer(commandHandler) {
  // Remove existing socket file if it exists
  if (fs.existsSync(DAEMON_SOCK)) {
    try {
      fs.unlinkSync(DAEMON_SOCK);
    } catch (error) {
      console.warn(`[FORV WARN] Failed to remove existing socket: ${error.message}`);
    }
  }

  const server = net.createServer((socket) => {
    let buffer = '';

    socket.on('data', async (data) => {
      buffer += data.toString();

      // Try to parse complete JSON messages (separated by newlines)
      const messages = buffer.split('\n');
      buffer = messages.pop(); // Keep incomplete message in buffer

      for (const message of messages) {
        if (!message.trim()) continue;

        try {
          const request = JSON.parse(message);
          const { id, command, args } = request;

          // Call command handler
          try {
            const result = await commandHandler(command, args);

            // Send success response
            const response = {
              id,
              success: true,
              data: result
            };
            socket.write(JSON.stringify(response) + '\n');
          } catch (error) {
            // Send error response
            const response = {
              id,
              success: false,
              error: error.message
            };
            socket.write(JSON.stringify(response) + '\n');
          }
        } catch (error) {
          console.error(`[FORV ERROR] Failed to parse IPC message: ${error.message}`);
        }
      }
    });

    socket.on('error', (error) => {
      console.error(`[FORV ERROR] Socket error: ${error.message}`);
    });

    socket.on('end', () => {
      // Client disconnected
    });
  });

  server.on('error', (error) => {
    throw new DaemonError(`IPC server error: ${error.message}`);
  });

  server.listen(DAEMON_SOCK, () => {
    // Set socket permissions (readable/writable by owner only)
    try {
      fs.chmodSync(DAEMON_SOCK, 0o600);
    } catch (error) {
      console.warn(`[FORV WARN] Failed to set socket permissions: ${error.message}`);
    }
  });

  return server;
}

/**
 * Send command to daemon (client side)
 * @param {string} command - Command name
 * @param {object} args - Command arguments
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<object>} Response data
 */
function sendCommand(command, args = {}, timeout = TIMEOUTS.ipcTimeout) {
  return new Promise((resolve, reject) => {
    // Check if socket exists
    if (!fs.existsSync(DAEMON_SOCK)) {
      reject(new DaemonError('Daemon is not running. Start it with: fvr start'));
      return;
    }

    // Connect to daemon socket
    const client = net.connect(DAEMON_SOCK);
    let buffer = '';

    const requestId = generateRequestId();

    // Set timeout
    const timeoutId = setTimeout(() => {
      client.destroy();
      reject(new DaemonError(`Command timed out after ${timeout}ms`));
    }, timeout);

    client.on('connect', () => {
      // Send request
      const request = {
        id: requestId,
        command,
        args
      };
      client.write(JSON.stringify(request) + '\n');
    });

    client.on('data', (data) => {
      buffer += data.toString();

      // Try to parse response
      const messages = buffer.split('\n');
      buffer = messages.pop(); // Keep incomplete message

      for (const message of messages) {
        if (!message.trim()) continue;

        try {
          const response = JSON.parse(message);

          if (response.id === requestId) {
            clearTimeout(timeoutId);
            client.end();

            if (response.success) {
              resolve(response.data);
            } else {
              reject(new DaemonError(response.error || 'Unknown error'));
            }
            return;
          }
        } catch (error) {
          clearTimeout(timeoutId);
          client.destroy();
          reject(new DaemonError(`Failed to parse response: ${error.message}`));
          return;
        }
      }
    });

    client.on('error', (error) => {
      clearTimeout(timeoutId);
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOENT') {
        reject(new DaemonError('Daemon is not running. Start it with: fvr start'));
      } else {
        reject(new DaemonError(`IPC error: ${error.message}`));
      }
    });

    client.on('end', () => {
      clearTimeout(timeoutId);
      // Connection closed without response
      if (buffer.trim()) {
        reject(new DaemonError('Connection closed unexpectedly'));
      }
    });
  });
}

/**
 * Check if daemon is running
 * @returns {boolean} True if daemon is running
 */
function isDaemonRunning() {
  if (!fs.existsSync(DAEMON_SOCK)) {
    return false;
  }

  // Try to connect to socket
  try {
    const client = net.connect(DAEMON_SOCK);
    client.on('connect', () => {
      client.end();
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Close IPC server
 * @param {net.Server} server - Server instance
 * @returns {Promise<void>}
 */
function closeIPCServer(server) {
  return new Promise((resolve) => {
    server.close(() => {
      // Remove socket file
      if (fs.existsSync(DAEMON_SOCK)) {
        try {
          fs.unlinkSync(DAEMON_SOCK);
        } catch (error) {
          console.warn(`[FORV WARN] Failed to remove socket file: ${error.message}`);
        }
      }
      resolve();
    });
  });
}

module.exports = {
  createIPCServer,
  sendCommand,
  isDaemonRunning,
  closeIPCServer
};
