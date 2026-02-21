const { spawn } = require('child_process');
const cluster = require('cluster');
const fs = require('fs');
const { EXEC_MODES, APP_STATUS, TIMEOUTS } = require('../utils/constants');
const { ProcessError } = require('../utils/errors');
const { createLogStreams } = require('./logger');

// Store references to active processes and workers
const processes = new Map(); // Map<appName, {process, workers, logStreams}>

/**
 * Check if a PID is running
 * @param {number} pid - Process ID
 * @returns {boolean} True if process is running
 */
function isProcessRunning(pid) {
  if (!pid || typeof pid !== 'number') {
    return false;
  }

  try {
    // Sending signal 0 doesn't kill the process, just checks if it exists
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get memory usage for a process (RSS in bytes)
 * @param {number} pid - Process ID
 * @returns {number|null} Memory usage in bytes or null if unavailable
 */
function getProcessMemory(pid) {
  if (!isProcessRunning(pid)) {
    return null;
  }

  // Try to read from /proc (Linux)
  const procPath = `/proc/${pid}/status`;
  if (fs.existsSync(procPath)) {
    try {
      const content = fs.readFileSync(procPath, 'utf8');
      const match = content.match(/VmRSS:\s+(\d+)\s+kB/);
      if (match) {
        return parseInt(match[1]) * 1024; // Convert KB to bytes
      }
    } catch (error) {
      // Ignore errors, fall through to return null
    }
  }

  // /proc not available (macOS development) - return null
  // In production on Linux, this should work
  return null;
}

/**
 * Start an app in fork mode
 * @param {object} appConfig - App configuration
 * @param {object} state - Current state reference
 * @param {Function} onExit - Callback when process exits
 * @returns {object} Object with pid and process reference
 */
function startForkMode(appConfig, state, onExit) {
  const { script, cwd, env, args } = appConfig;

  // Create log streams
  const { outStream, errStream } = createLogStreams(appConfig.name);

  // Merge environment variables
  const processEnv = {
    ...process.env,
    ...env
  };

  // Spawn the process
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    env: processEnv,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Pipe stdout and stderr to log files
  child.stdout.pipe(outStream);
  child.stderr.pipe(errStream);

  // Handle process exit
  child.on('exit', (code, signal) => {
    outStream.end();
    errStream.end();

    if (onExit) {
      onExit({
        pid: child.pid,
        code,
        signal,
        appName: appConfig.name
      });
    }

    // Clean up process reference
    processes.delete(appConfig.name);
  });

  // Handle errors
  child.on('error', (error) => {
    console.error(`[FVR ERROR] Process error for ${appConfig.name}: ${error.message}`);
  });

  // Store process reference
  processes.set(appConfig.name, {
    process: child,
    workers: null,
    logStreams: { outStream, errStream },
    mode: EXEC_MODES.FORK
  });

  return {
    pid: child.pid,
    process: child
  };
}

/**
 * Start an app in cluster mode
 * @param {object} appConfig - App configuration
 * @param {object} state - Current state reference
 * @param {Function} onExit - Callback when worker exits
 * @returns {object} Object with pids array and workers
 */
function startClusterMode(appConfig, state, onExit) {
  const { script, cwd, env, args, instances } = appConfig;

  // We need to set up cluster in the master process
  // Since we're already running as a daemon, we ARE the master

  // Setup cluster configuration
  cluster.setupMaster({
    exec: script,
    args: args,
    cwd: cwd,
    silent: true // We'll handle stdout/stderr ourselves
  });

  const workers = [];
  const pids = [];

  // Create log streams (shared for all workers)
  const { outStream, errStream } = createLogStreams(appConfig.name);

  // Fork workers
  for (let i = 0; i < instances; i++) {
    const worker = cluster.fork(env);

    // Pipe worker stdout/stderr to log files
    if (worker.process.stdout) {
      worker.process.stdout.pipe(outStream, { end: false });
    }
    if (worker.process.stderr) {
      worker.process.stderr.pipe(errStream, { end: false });
    }

    workers.push(worker);
    pids.push(worker.process.pid);

    // Handle worker exit
    worker.on('exit', (code, signal) => {
      if (onExit) {
        onExit({
          pid: worker.process.pid,
          code,
          signal,
          appName: appConfig.name,
          workerId: worker.id
        });
      }
    });
  }

  // Store process reference
  processes.set(appConfig.name, {
    process: null,
    workers,
    logStreams: { outStream, errStream },
    mode: EXEC_MODES.CLUSTER
  });

  return {
    pids,
    workers
  };
}

/**
 * Start an app
 * @param {object} appConfig - App configuration
 * @param {object} state - Current state reference
 * @param {Function} onExit - Callback when process exits
 * @returns {Promise<object>} Object with pids
 */
async function startApp(appConfig, state, onExit) {
  const { exec_mode, name } = appConfig;

  // Check if app is already running
  if (processes.has(name)) {
    throw new ProcessError(`App '${name}' is already running`);
  }

  try {
    if (exec_mode === EXEC_MODES.FORK) {
      const { pid } = startForkMode(appConfig, state, onExit);
      return { pids: [pid] };
    } else if (exec_mode === EXEC_MODES.CLUSTER) {
      const { pids } = startClusterMode(appConfig, state, onExit);
      return { pids };
    } else {
      throw new ProcessError(`Invalid exec_mode: ${exec_mode}`);
    }
  } catch (error) {
    throw new ProcessError(`Failed to start app '${name}': ${error.message}`);
  }
}

/**
 * Stop an app
 * @param {string} appName - App name
 * @param {string} signal - Signal to send (default: SIGTERM)
 * @param {number} timeout - Timeout before SIGKILL (default: 5000ms)
 * @returns {Promise<void>}
 */
async function stopApp(appName, signal = 'SIGTERM', timeout = TIMEOUTS.gracefulShutdown) {
  const ref = processes.get(appName);

  if (!ref) {
    // App not in process map, nothing to stop
    return;
  }

  const { process: proc, workers, logStreams, mode } = ref;

  try {
    if (mode === EXEC_MODES.FORK && proc) {
      // Fork mode: stop single process
      if (isProcessRunning(proc.pid)) {
        proc.kill(signal);

        // Wait for graceful shutdown
        await new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            // Force kill if still running
            if (isProcessRunning(proc.pid)) {
              proc.kill('SIGKILL');
            }
            resolve();
          }, timeout);

          proc.once('exit', () => {
            clearTimeout(timeoutId);
            resolve();
          });
        });
      }
    } else if (mode === EXEC_MODES.CLUSTER && workers) {
      // Cluster mode: stop all workers
      const stopPromises = workers.map(worker => {
        return new Promise((resolve) => {
          if (worker.isDead()) {
            resolve();
            return;
          }

          worker.kill(signal);

          const timeoutId = setTimeout(() => {
            if (!worker.isDead()) {
              worker.kill('SIGKILL');
            }
            resolve();
          }, timeout);

          worker.once('exit', () => {
            clearTimeout(timeoutId);
            resolve();
          });
        });
      });

      await Promise.all(stopPromises);
    }

    // Close log streams
    if (logStreams) {
      logStreams.outStream.end();
      logStreams.errStream.end();
    }

    // Remove from process map
    processes.delete(appName);
  } catch (error) {
    throw new ProcessError(`Failed to stop app '${appName}': ${error.message}`);
  }
}

/**
 * Restart an app
 * @param {string} appName - App name
 * @param {object} appConfig - App configuration
 * @param {object} state - Current state reference
 * @param {Function} onExit - Callback when process exits
 * @returns {Promise<object>} Object with new pids
 */
async function restartApp(appName, appConfig, state, onExit) {
  await stopApp(appName);
  return await startApp(appConfig, state, onExit);
}

/**
 * Get process reference for an app (for testing/debugging)
 * @param {string} appName - App name
 * @returns {object|null} Process reference or null
 */
function getProcessRef(appName) {
  return processes.get(appName) || null;
}

/**
 * Clean up all processes (for daemon shutdown)
 */
async function cleanupAllProcesses() {
  const stopPromises = [];
  for (const appName of processes.keys()) {
    stopPromises.push(stopApp(appName));
  }
  await Promise.all(stopPromises);
}

module.exports = {
  startApp,
  stopApp,
  restartApp,
  isProcessRunning,
  getProcessMemory,
  getProcessRef,
  cleanupAllProcesses
};
