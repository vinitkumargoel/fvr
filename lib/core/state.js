const fs = require('fs');
const path = require('path');
const { FVR_HOME, STATE_FILE, APP_STATUS } = require('../utils/constants');
const { StateError } = require('../utils/errors');

/**
 * Ensure FVR home directory exists
 */
function ensureFVRHome() {
  if (!fs.existsSync(FVR_HOME)) {
    try {
      fs.mkdirSync(FVR_HOME, { recursive: true, mode: 0o755 });
    } catch (error) {
      throw new StateError(`Failed to create FVR home directory: ${error.message}`);
    }
  }
}

/**
 * Create empty state structure
 * @returns {object} Empty state object
 */
function createEmptyState() {
  return {
    apps: [],
    daemon_pid: null
  };
}

/**
 * Load state from disk
 * @returns {object} State object
 */
function loadState() {
  ensureFVRHome();

  if (!fs.existsSync(STATE_FILE)) {
    return createEmptyState();
  }

  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    const state = JSON.parse(data);

    // Validate state structure
    if (!state.apps || !Array.isArray(state.apps)) {
      throw new Error('Invalid state structure: apps must be an array');
    }

    return state;
  } catch (error) {
    // If state file is corrupted, back it up and create fresh state
    if (error instanceof SyntaxError) {
      const backupFile = `${STATE_FILE}.backup.${Date.now()}`;
      try {
        fs.copyFileSync(STATE_FILE, backupFile);
        console.warn(`[FORV WARN] Corrupted state file backed up to ${backupFile}`);
      } catch (backupError) {
        // Ignore backup errors
      }
      return createEmptyState();
    }
    throw new StateError(`Failed to load state: ${error.message}`);
  }
}

/**
 * Save state to disk atomically
 * @param {object} state - State object to save
 */
function saveState(state) {
  ensureFVRHome();

  try {
    // Write to temporary file first
    const tempFile = `${STATE_FILE}.tmp`;
    const data = JSON.stringify(state, null, 2);
    fs.writeFileSync(tempFile, data, { encoding: 'utf8', mode: 0o644 });

    // Atomic rename
    fs.renameSync(tempFile, STATE_FILE);
  } catch (error) {
    throw new StateError(`Failed to save state: ${error.message}`);
  }
}

/**
 * Get app by name from state
 * @param {string} name - App name
 * @returns {object|null} App object or null if not found
 */
function getApp(name) {
  const state = loadState();
  return state.apps.find(app => app.name === name) || null;
}

/**
 * Get all apps from state
 * @returns {Array} Array of app objects
 */
function getAllApps() {
  const state = loadState();
  return state.apps;
}

/**
 * Add app to state
 * @param {object} appData - App data to add
 * @throws {StateError} If app with same name already exists
 */
function addApp(appData) {
  const state = loadState();

  // Check if app already exists
  const existing = state.apps.find(app => app.name === appData.name);
  if (existing) {
    throw new StateError(`App '${appData.name}' already exists in state`);
  }

  // Assign ID (max ID + 1, or 0 if no apps)
  const maxId = state.apps.length > 0
    ? Math.max(...state.apps.map(app => app.id))
    : -1;

  const app = {
    id: maxId + 1,
    name: appData.name,
    script: appData.script,
    cwd: appData.cwd || path.dirname(appData.script),
    exec_mode: appData.exec_mode || 'fork',
    instances: appData.instances || 1,
    pids: appData.pids || [],
    status: appData.status || APP_STATUS.STOPPED,
    autorestart: appData.autorestart !== undefined ? appData.autorestart : true,
    watch: appData.watch || false,
    max_memory_restart: appData.max_memory_restart || null,
    env: appData.env || {},
    args: appData.args || [],
    started_at: appData.started_at || null,
    restart_count: 0,
    restart_history: []
  };

  state.apps.push(app);
  saveState(state);

  return app;
}

/**
 * Update app in state
 * @param {string} name - App name
 * @param {object} updates - Updates to apply
 * @throws {StateError} If app not found
 */
function updateApp(name, updates) {
  const state = loadState();
  const app = state.apps.find(app => app.name === name);

  if (!app) {
    throw new StateError(`App '${name}' not found in state`);
  }

  // Apply updates
  Object.assign(app, updates);

  saveState(state);
  return app;
}

/**
 * Remove app from state
 * @param {string} name - App name
 * @throws {StateError} If app not found
 */
function removeApp(name) {
  const state = loadState();
  const index = state.apps.findIndex(app => app.name === name);

  if (index === -1) {
    throw new StateError(`App '${name}' not found in state`);
  }

  state.apps.splice(index, 1);
  saveState(state);
}

/**
 * Set daemon PID in state
 * @param {number|null} pid - Daemon PID
 */
function setDaemonPid(pid) {
  const state = loadState();
  state.daemon_pid = pid;
  saveState(state);
}

/**
 * Get daemon PID from state
 * @returns {number|null} Daemon PID or null
 */
function getDaemonPid() {
  const state = loadState();
  return state.daemon_pid;
}

/**
 * Clear all apps from state (for testing/cleanup)
 */
function clearState() {
  const state = createEmptyState();
  saveState(state);
}

module.exports = {
  loadState,
  saveState,
  getApp,
  getAllApps,
  addApp,
  updateApp,
  removeApp,
  setDaemonPid,
  getDaemonPid,
  clearState,
  ensureFVRHome
};
