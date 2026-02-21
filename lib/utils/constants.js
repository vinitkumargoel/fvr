const os = require('os');
const path = require('path');

// FVR home directory
const FVR_HOME = path.join(os.homedir(), '.fvr');

// FVR paths
const STATE_FILE = path.join(FVR_HOME, 'state.json');
const LOGS_DIR = path.join(FVR_HOME, 'logs');
const DAEMON_SOCK = path.join(FVR_HOME, 'daemon.sock');

// Config file names (search order)
const CONFIG_FILES = ['fvr.config.js', 'fvr.config.cjs', '.fvrrc.js'];

// Process defaults
const DEFAULTS = {
  exec_mode: 'fork',
  instances: 1,
  watch: false,
  autorestart: true,
  env: {},
  args: []
};

// Timeouts and intervals
const TIMEOUTS = {
  gracefulShutdown: 5000,    // 5 seconds for SIGTERM before SIGKILL
  restartDelay: 1000,         // 1 second delay before auto-restart
  memoryPoll: 5000,           // 5 seconds between memory checks
  watchDebounce: 500,         // 500ms debounce for file changes
  ipcTimeout: 10000           // 10 seconds for IPC response
};

// Crash loop detection
const CRASH_LOOP = {
  maxRestarts: 5,             // Max restarts before marking as errored
  timeWindow: 60000           // Time window in ms (60 seconds)
};

// Log rotation
const LOG_ROTATION = {
  maxSize: 10 * 1024 * 1024,  // 10MB
  maxBackups: 1                // Keep 1 backup file
};

// App status values
const APP_STATUS = {
  ONLINE: 'online',
  STOPPED: 'stopped',
  ERRORED: 'errored',
  RESTARTING: 'restarting'
};

// Execution modes
const EXEC_MODES = {
  FORK: 'fork',
  CLUSTER: 'cluster'
};

module.exports = {
  FVR_HOME,
  STATE_FILE,
  LOGS_DIR,
  DAEMON_SOCK,
  CONFIG_FILES,
  DEFAULTS,
  TIMEOUTS,
  CRASH_LOOP,
  LOG_ROTATION,
  APP_STATUS,
  EXEC_MODES
};
