const chokidar = require('chokidar');
const { TIMEOUTS, CRASH_LOOP, APP_STATUS } = require('../utils/constants');
const { getProcessMemory, isProcessRunning } = require('../core/process-manager');

// Store monitoring state
const monitors = new Map(); // Map<appName, {memoryInterval, watcher, restartCallback}>

/**
 * Parse memory limit string to bytes
 * @param {string} limit - Memory limit string (e.g., "200M", "1G")
 * @returns {number} Memory limit in bytes
 */
function parseMemoryLimit(limit) {
  if (!limit || typeof limit !== 'string') {
    return null;
  }

  const match = limit.match(/^(\d+)([MG])$/);
  if (!match) {
    return null;
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  if (unit === 'M') {
    return value * 1024 * 1024; // MB to bytes
  } else if (unit === 'G') {
    return value * 1024 * 1024 * 1024; // GB to bytes
  }

  return null;
}

/**
 * Check if app is in crash loop
 * @param {object} app - App state from state.json
 * @returns {boolean} True if app is in crash loop
 */
function checkCrashLoop(app) {
  if (!app.restart_history || app.restart_history.length < CRASH_LOOP.maxRestarts) {
    return false;
  }

  // Get last N restarts
  const recentRestarts = app.restart_history.slice(-CRASH_LOOP.maxRestarts);

  // Check if all happened within time window
  const oldestRestart = new Date(recentRestarts[0]).getTime();
  const newestRestart = new Date(recentRestarts[recentRestarts.length - 1]).getTime();

  const timeSpan = newestRestart - oldestRestart;

  return timeSpan <= CRASH_LOOP.timeWindow;
}

/**
 * Record restart in app history
 * @param {object} app - App state from state.json
 * @returns {object} Updated app with new restart record
 */
function recordRestart(app) {
  const now = new Date().toISOString();

  const updatedApp = {
    ...app,
    restart_count: (app.restart_count || 0) + 1,
    restart_history: [
      ...(app.restart_history || []),
      now
    ]
  };

  // Keep only last 10 restarts in history
  if (updatedApp.restart_history.length > 10) {
    updatedApp.restart_history = updatedApp.restart_history.slice(-10);
  }

  return updatedApp;
}

/**
 * Setup auto-restart for an app
 * @param {object} app - App configuration
 * @param {Function} restartCallback - Callback to restart app (receives app object)
 * @param {Function} updateAppState - Callback to update app state
 */
function setupAutoRestart(app, restartCallback, updateAppState) {
  // Store the restart callback for this app
  const monitor = monitors.get(app.name) || {};
  monitor.restartCallback = async (exitInfo) => {
    console.log(`[FORV] Process ${app.name} exited with code ${exitInfo.code}`);

    // Check if autorestart is enabled
    if (!app.autorestart) {
      console.log(`[FORV] Auto-restart disabled for ${app.name}`);
      await updateAppState(app.name, { status: APP_STATUS.STOPPED, pids: [] });
      return;
    }

    // Update state to restarting
    await updateAppState(app.name, { status: APP_STATUS.RESTARTING });

    // Record restart
    const updatedApp = recordRestart(app);
    await updateAppState(app.name, {
      restart_count: updatedApp.restart_count,
      restart_history: updatedApp.restart_history
    });

    // Check for crash loop
    if (checkCrashLoop(updatedApp)) {
      console.error(`[FORV ERROR] App ${app.name} in crash loop (${CRASH_LOOP.maxRestarts} restarts in ${CRASH_LOOP.timeWindow / 1000}s). Stopping auto-restart.`);
      await updateAppState(app.name, { status: APP_STATUS.ERRORED, pids: [] });
      stopMonitoring(app.name);
      return;
    }

    // Wait before restarting
    console.log(`[FORV] Restarting ${app.name} in ${TIMEOUTS.restartDelay / 1000}s...`);
    setTimeout(async () => {
      try {
        await restartCallback(app);
        console.log(`[FORV] App ${app.name} restarted successfully`);
      } catch (error) {
        console.error(`[FORV ERROR] Failed to restart ${app.name}: ${error.message}`);
        await updateAppState(app.name, { status: APP_STATUS.ERRORED, pids: [] });
      }
    }, TIMEOUTS.restartDelay);
  };

  monitors.set(app.name, monitor);
}

/**
 * Get restart callback for an app
 * @param {string} appName - App name
 * @returns {Function|null} Restart callback or null
 */
function getRestartCallback(appName) {
  const monitor = monitors.get(appName);
  return monitor?.restartCallback || null;
}

/**
 * Start memory monitoring for an app
 * @param {object} app - App configuration
 * @param {Function} onMemoryExceeded - Callback when memory limit exceeded
 */
function startMemoryMonitoring(app, onMemoryExceeded) {
  if (!app.max_memory_restart) {
    return; // No memory limit configured
  }

  const memoryLimit = parseMemoryLimit(app.max_memory_restart);
  if (!memoryLimit) {
    console.warn(`[FORV WARN] Invalid memory limit for ${app.name}: ${app.max_memory_restart}`);
    return;
  }

  const monitor = monitors.get(app.name) || {};

  // Clear existing interval if any
  if (monitor.memoryInterval) {
    clearInterval(monitor.memoryInterval);
  }

  // Start polling memory
  monitor.memoryInterval = setInterval(() => {
    if (!app.pids || app.pids.length === 0) {
      return; // No running processes
    }

    // Check memory for all PIDs
    let totalMemory = 0;
    let anyRunning = false;

    for (const pid of app.pids) {
      if (isProcessRunning(pid)) {
        anyRunning = true;
        const memory = getProcessMemory(pid);
        if (memory !== null) {
          totalMemory += memory;
        }
      }
    }

    if (!anyRunning) {
      return; // All processes stopped
    }

    // Check if memory exceeded
    if (totalMemory > memoryLimit) {
      const memoryMB = (totalMemory / (1024 * 1024)).toFixed(2);
      const limitMB = (memoryLimit / (1024 * 1024)).toFixed(2);
      console.warn(`[FORV WARN] App ${app.name} exceeded memory limit: ${memoryMB}MB > ${limitMB}MB. Restarting...`);

      if (onMemoryExceeded) {
        onMemoryExceeded(app);
      }
    }
  }, TIMEOUTS.memoryPoll);

  monitors.set(app.name, monitor);
}

/**
 * Stop memory monitoring for an app
 * @param {string} appName - App name
 */
function stopMemoryMonitoring(appName) {
  const monitor = monitors.get(appName);
  if (monitor?.memoryInterval) {
    clearInterval(monitor.memoryInterval);
    monitor.memoryInterval = null;
  }
}

/**
 * Start file watching for an app
 * @param {object} app - App configuration
 * @param {Function} onFileChange - Callback when files change
 */
function startWatcher(app, onFileChange) {
  if (!app.watch) {
    return; // Watch mode not enabled
  }

  const monitor = monitors.get(app.name) || {};

  // Close existing watcher if any
  if (monitor.watcher) {
    monitor.watcher.close();
  }

  // Create watcher
  const watcher = chokidar.watch(app.cwd, {
    ignored: [
      /(^|[\/\\])\../,           // hidden files
      '**/node_modules/**',      // node_modules
      '**/.git/**',              // git directory
      '**/logs/**',              // logs directory
      '**/*.log'                 // log files
    ],
    persistent: true,
    ignoreInitial: true,         // don't fire events for initial scan
    awaitWriteFinish: {
      stabilityThreshold: TIMEOUTS.watchDebounce,
      pollInterval: 100
    }
  });

  let restartTimeout = null;

  const handleChange = (path) => {
    console.log(`[FORV] File changed in ${app.name}: ${path}`);

    // Debounce restarts
    if (restartTimeout) {
      clearTimeout(restartTimeout);
    }

    restartTimeout = setTimeout(() => {
      console.log(`[FORV] Restarting ${app.name} due to file change...`);
      if (onFileChange) {
        onFileChange(app, path);
      }
      restartTimeout = null;
    }, TIMEOUTS.watchDebounce);
  };

  watcher.on('change', handleChange);
  watcher.on('add', handleChange);
  watcher.on('unlink', handleChange);

  watcher.on('error', (error) => {
    console.error(`[FORV ERROR] Watcher error for ${app.name}: ${error.message}`);
  });

  monitor.watcher = watcher;
  monitors.set(app.name, monitor);

  console.log(`[FORV] Watching files for ${app.name} in ${app.cwd}`);
}

/**
 * Stop file watching for an app
 * @param {string} appName - App name
 */
function stopWatcher(appName) {
  const monitor = monitors.get(appName);
  if (monitor?.watcher) {
    monitor.watcher.close();
    monitor.watcher = null;
    console.log(`[FORV] Stopped watching files for ${appName}`);
  }
}

/**
 * Stop all monitoring for an app
 * @param {string} appName - App name
 */
function stopMonitoring(appName) {
  stopMemoryMonitoring(appName);
  stopWatcher(appName);
  monitors.delete(appName);
}

/**
 * Stop all monitoring (for daemon shutdown)
 */
function stopAllMonitoring() {
  for (const appName of monitors.keys()) {
    stopMonitoring(appName);
  }
  monitors.clear();
}

module.exports = {
  parseMemoryLimit,
  checkCrashLoop,
  recordRestart,
  setupAutoRestart,
  getRestartCallback,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  startWatcher,
  stopWatcher,
  stopMonitoring,
  stopAllMonitoring
};
