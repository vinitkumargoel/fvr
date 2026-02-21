const Table = require('cli-table3');
const { sendCommand, isDaemonRunning } = require('../daemon/ipc');
const { exitWithError, printInfo } = require('../utils/errors');

/**
 * Format bytes to human readable format
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string
 */
function formatMemory(bytes) {
  if (!bytes || bytes === 0) {
    return '—';
  }

  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }

  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/**
 * Format PID(s) for display
 * @param {array} pids - Array of PIDs
 * @returns {string} Formatted PID string
 */
function formatPids(pids) {
  if (!pids || pids.length === 0) {
    return '—';
  }

  if (pids.length === 1) {
    return pids[0].toString();
  }

  // Show first PID + count for cluster mode
  return `${pids[0]}...`;
}

/**
 * Format instances for display
 * @param {number} runningCount - Number of running instances
 * @param {number} totalCount - Total configured instances
 * @returns {string} Formatted instances string
 */
function formatInstances(runningCount, totalCount) {
  return `${runningCount}/${totalCount}`;
}

/**
 * Colorize status
 * @param {string} status - Status string
 * @returns {string} Colored status
 */
function colorizeStatus(status) {
  switch (status) {
    case 'online':
      return `\x1b[32m${status}\x1b[0m`; // Green
    case 'stopped':
      return `\x1b[90m${status}\x1b[0m`; // Gray
    case 'errored':
      return `\x1b[31m${status}\x1b[0m`; // Red
    case 'restarting':
      return `\x1b[33m${status}\x1b[0m`; // Yellow
    default:
      return status;
  }
}

/**
 * List command handler
 * @param {object} options - Command options
 */
async function listCommand(options = {}) {
  try {
    // Check if daemon is running
    if (!isDaemonRunning()) {
      exitWithError('Daemon is not running. Start apps with: fvr start');
    }

    // Get app list from daemon
    const result = await sendCommand('list', {});
    const apps = result.apps || [];

    if (apps.length === 0) {
      printInfo('No apps managed by FVR');
      printInfo('Start apps with: fvr start');
      return;
    }

    // Create table
    const table = new Table({
      head: ['id', 'name', 'mode', 'pid', 'instances', 'status', 'memory'],
      style: {
        head: ['cyan'],
        border: ['gray']
      },
      colWidths: [6, 20, 12, 12, 14, 14, 12]
    });

    // Add rows
    for (const app of apps) {
      table.push([
        app.id,
        app.name,
        app.exec_mode,
        formatPids(app.pids),
        formatInstances(app.pids.length, app.instances),
        colorizeStatus(app.status),
        formatMemory(app.memory)
      ]);
    }

    // Print table
    console.log(table.toString());

    // Print summary
    const online = apps.filter(a => a.status === 'online').length;
    const stopped = apps.filter(a => a.status === 'stopped').length;
    const errored = apps.filter(a => a.status === 'errored').length;

    console.log('');
    console.log(`Total: ${apps.length} app(s) | ` +
                `\x1b[32m${online} online\x1b[0m | ` +
                `\x1b[90m${stopped} stopped\x1b[0m` +
                (errored > 0 ? ` | \x1b[31m${errored} errored\x1b[0m` : ''));
  } catch (error) {
    exitWithError(error.message);
  }
}

module.exports = listCommand;
