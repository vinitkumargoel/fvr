const { spawn } = require('child_process');
const path = require('path');
const { APP_STATUS } = require('../utils/constants');
const { DaemonError } = require('../utils/errors');
const { loadState, updateApp, removeApp, setDaemonPid, getAllApps } = require('../core/state');
const { startApp, stopApp, restartApp, isProcessRunning, getProcessMemory, cleanupAllProcesses } = require('../core/process-manager');
const { createIPCServer, closeIPCServer } = require('./ipc');
const {
  setupAutoRestart,
  getRestartCallback,
  startMemoryMonitoring,
  startWatcher,
  stopMonitoring,
  stopAllMonitoring
} = require('./monitor');

// Global daemon state
let ipcServer = null;
let isShuttingDown = false;

/**
 * Update app state in state file
 * @param {string} appName - App name
 * @param {object} updates - State updates
 */
async function updateAppState(appName, updates) {
  try {
    updateApp(appName, updates);
  } catch (error) {
    console.error(`[FORV ERROR] Failed to update app state: ${error.message}`);
  }
}

/**
 * Start an app and set up monitoring
 * @param {object} appConfig - App configuration
 */
async function startAppWithMonitoring(appConfig) {
  // Setup exit handler for auto-restart
  const onExit = async (exitInfo) => {
    const callback = getRestartCallback(appConfig.name);
    if (callback) {
      await callback(exitInfo);
    }
  };

  // Get current state to update
  let state = loadState();

  // Start the app
  const { pids } = await startApp(appConfig, state, onExit);

  // Update state
  await updateAppState(appConfig.name, {
    pids,
    status: APP_STATUS.ONLINE,
    started_at: new Date().toISOString()
  });

  // Reload state to get updated app
  state = loadState();
  const app = state.apps.find(a => a.name === appConfig.name);

  // Setup monitoring
  setupAutoRestart(
    app,
    async (appToRestart) => {
      // Restart callback
      const { pids: newPids } = await startApp(appConfig, loadState(), onExit);
      await updateAppState(appToRestart.name, {
        pids: newPids,
        status: APP_STATUS.ONLINE,
        started_at: new Date().toISOString()
      });

      // Re-setup monitoring
      const updatedState = loadState();
      const updatedApp = updatedState.apps.find(a => a.name === appToRestart.name);
      startMemoryMonitoring(updatedApp, handleMemoryExceeded);
      startWatcher(updatedApp, handleFileChange);
    },
    updateAppState
  );

  startMemoryMonitoring(app, handleMemoryExceeded);
  startWatcher(app, handleFileChange);

  return { pids };
}

/**
 * Handle memory exceeded event
 * @param {object} app - App that exceeded memory
 */
async function handleMemoryExceeded(app) {
  try {
    // Stop the app (this will trigger auto-restart via exit handler)
    await stopApp(app.name);
  } catch (error) {
    console.error(`[FORV ERROR] Failed to restart app after memory exceeded: ${error.message}`);
  }
}

/**
 * Handle file change event
 * @param {object} app - App with file change
 * @param {string} filePath - Changed file path
 */
async function handleFileChange(app, filePath) {
  try {
    // Get app config from state
    const state = loadState();
    const appState = state.apps.find(a => a.name === app.name);

    if (!appState) {
      return;
    }

    // Restart the app
    const appConfig = {
      name: appState.name,
      script: appState.script,
      cwd: appState.cwd,
      exec_mode: appState.exec_mode,
      instances: appState.instances,
      env: appState.env,
      args: appState.args,
      autorestart: appState.autorestart,
      watch: appState.watch,
      max_memory_restart: appState.max_memory_restart
    };

    await stopApp(app.name);
    await startAppWithMonitoring(appConfig);

    console.log(`[FORV] App ${app.name} restarted due to file change`);
  } catch (error) {
    console.error(`[FORV ERROR] Failed to restart app after file change: ${error.message}`);
  }
}

/**
 * Handle IPC commands from CLI
 * @param {string} command - Command name
 * @param {object} args - Command arguments
 * @returns {Promise<object>} Command result
 */
async function handleCommand(command, args) {
  try {
    switch (command) {
      case 'start':
        return await handleStartCommand(args);

      case 'stop':
        return await handleStopCommand(args);

      case 'restart':
        return await handleRestartCommand(args);

      case 'delete':
        return await handleDeleteCommand(args);

      case 'list':
        return await handleListCommand(args);

      case 'status':
        return await handleStatusCommand(args);

      default:
        throw new DaemonError(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`[FORV ERROR] Command failed: ${error.message}`);
    throw error;
  }
}

/**
 * Handle start command
 */
async function handleStartCommand(args) {
  const { appConfig } = args;

  try {
    const result = await startAppWithMonitoring(appConfig);
    return {
      success: true,
      message: `Started app ${appConfig.name}`,
      pids: result.pids
    };
  } catch (error) {
    throw new DaemonError(`Failed to start app: ${error.message}`);
  }
}

/**
 * Handle stop command
 */
async function handleStopCommand(args) {
  const { appName } = args;

  try {
    // Stop monitoring first
    stopMonitoring(appName);

    // Stop the process
    await stopApp(appName);

    // Update state
    await updateAppState(appName, {
      pids: [],
      status: APP_STATUS.STOPPED
    });

    return {
      success: true,
      message: `Stopped app ${appName}`
    };
  } catch (error) {
    throw new DaemonError(`Failed to stop app: ${error.message}`);
  }
}

/**
 * Handle restart command
 */
async function handleRestartCommand(args) {
  const { appName } = args;

  try {
    // Get app config from state
    const state = loadState();
    const app = state.apps.find(a => a.name === appName);

    if (!app) {
      throw new DaemonError(`App ${appName} not found`);
    }

    const appConfig = {
      name: app.name,
      script: app.script,
      cwd: app.cwd,
      exec_mode: app.exec_mode,
      instances: app.instances,
      env: app.env,
      args: app.args,
      autorestart: app.autorestart,
      watch: app.watch,
      max_memory_restart: app.max_memory_restart
    };

    // Stop monitoring
    stopMonitoring(appName);

    // Stop and restart
    await stopApp(appName);
    const result = await startAppWithMonitoring(appConfig);

    return {
      success: true,
      message: `Restarted app ${appName}`,
      pids: result.pids
    };
  } catch (error) {
    throw new DaemonError(`Failed to restart app: ${error.message}`);
  }
}

/**
 * Handle delete command
 */
async function handleDeleteCommand(args) {
  const { appName } = args;

  try {
    // Stop monitoring
    stopMonitoring(appName);

    // Stop the process
    await stopApp(appName);

    // Remove from state
    removeApp(appName);

    return {
      success: true,
      message: `Deleted app ${appName}`
    };
  } catch (error) {
    throw new DaemonError(`Failed to delete app: ${error.message}`);
  }
}

/**
 * Handle list command
 */
async function handleListCommand(args) {
  const state = loadState();
  const apps = state.apps;

  // Enrich with runtime info
  const appsWithInfo = apps.map(app => {
    // Check if processes are actually running
    const runningPids = (app.pids || []).filter(pid => isProcessRunning(pid));

    // Calculate total memory
    let totalMemory = 0;
    for (const pid of runningPids) {
      const memory = getProcessMemory(pid);
      if (memory !== null) {
        totalMemory += memory;
      }
    }

    // Determine status
    let status = app.status;
    if (runningPids.length === 0 && app.status === APP_STATUS.ONLINE) {
      status = APP_STATUS.STOPPED;
    }

    return {
      ...app,
      pids: runningPids,
      status,
      memory: totalMemory
    };
  });

  return { apps: appsWithInfo };
}

/**
 * Handle status command (health check)
 */
async function handleStatusCommand(args) {
  return {
    running: true,
    pid: process.pid,
    uptime: process.uptime()
  };
}

/**
 * Start the daemon
 */
function startDaemon() {
  console.log('[FORV] Starting daemon...');

  // Set up IPC server
  ipcServer = createIPCServer(handleCommand);

  // Save daemon PID
  setDaemonPid(process.pid);

  console.log(`[FORV] Daemon started (PID: ${process.pid})`);

  // Setup signal handlers
  process.on('SIGTERM', () => {
    console.log('[FORV] Received SIGTERM, shutting down...');
    shutdown();
  });

  process.on('SIGINT', () => {
    console.log('[FORV] Received SIGINT, shutting down...');
    shutdown();
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[FORV ERROR] Uncaught exception:', error);
    // Don't exit on uncaught exceptions, daemon should stay alive
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[FORV ERROR] Unhandled rejection:', reason);
    // Don't exit on unhandled rejections
  });

  // Keep daemon alive
  setInterval(() => {
    // Heartbeat - do nothing, just keep process alive
  }, 60000); // Every 60 seconds
}

/**
 * Shutdown daemon gracefully
 */
async function shutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log('[FORV] Shutting down daemon...');

  try {
    // Stop all monitoring
    stopAllMonitoring();

    // Stop all processes
    await cleanupAllProcesses();

    // Close IPC server
    if (ipcServer) {
      await closeIPCServer(ipcServer);
    }

    // Clear daemon PID from state
    setDaemonPid(null);

    console.log('[FORV] Daemon shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('[FORV ERROR] Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Check if we should run as daemon (detached process)
 * This is called when daemon needs to be started
 */
function forkDaemon() {
  const daemonScript = __filename;

  // Fork daemon process as detached
  const child = spawn(process.execPath, [daemonScript, '--daemon'], {
    detached: true,
    stdio: 'ignore',
    env: process.env
  });

  child.unref(); // Allow parent to exit independently

  return child.pid;
}

module.exports = {
  startDaemon,
  shutdown,
  forkDaemon,
  handleCommand
};

// If this file is run directly with --daemon flag, start the daemon
if (require.main === module && process.argv.includes('--daemon')) {
  startDaemon();
}
