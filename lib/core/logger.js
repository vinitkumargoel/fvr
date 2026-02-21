const fs = require('fs');
const path = require('path');
const { LOGS_DIR, LOG_ROTATION } = require('../utils/constants');
const { StateError } = require('../utils/errors');

/**
 * Ensure logs directory exists
 */
function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    try {
      fs.mkdirSync(LOGS_DIR, { recursive: true, mode: 0o755 });
    } catch (error) {
      throw new StateError(`Failed to create logs directory: ${error.message}`);
    }
  }
}

/**
 * Get log file paths for an app
 * @param {string} appName - App name
 * @returns {object} Object with outLog and errLog paths
 */
function getLogPaths(appName) {
  return {
    outLog: path.join(LOGS_DIR, `${appName}-out.log`),
    errLog: path.join(LOGS_DIR, `${appName}-err.log`)
  };
}

/**
 * Rotate log file if it exceeds max size
 * @param {string} logPath - Path to log file
 */
function rotateLogIfNeeded(logPath) {
  if (!fs.existsSync(logPath)) {
    return;
  }

  try {
    const stats = fs.statSync(logPath);
    if (stats.size >= LOG_ROTATION.maxSize) {
      const backupPath = `${logPath}.1`;

      // Remove old backup if exists
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      // Rename current log to backup
      fs.renameSync(logPath, backupPath);
    }
  } catch (error) {
    // Ignore rotation errors, don't break logging
    console.warn(`[FVR WARN] Failed to rotate log ${logPath}: ${error.message}`);
  }
}

/**
 * Create writable log streams for an app
 * @param {string} appName - App name
 * @returns {object} Object with outStream and errStream
 */
function createLogStreams(appName) {
  ensureLogsDir();

  const { outLog, errLog } = getLogPaths(appName);

  // Rotate logs if needed before creating streams
  rotateLogIfNeeded(outLog);
  rotateLogIfNeeded(errLog);

  try {
    const outStream = fs.createWriteStream(outLog, {
      flags: 'a', // append
      encoding: 'utf8',
      mode: 0o644
    });

    const errStream = fs.createWriteStream(errLog, {
      flags: 'a', // append
      encoding: 'utf8',
      mode: 0o644
    });

    // Handle stream errors
    outStream.on('error', (error) => {
      console.error(`[FVR ERROR] Failed to write to ${outLog}: ${error.message}`);
    });

    errStream.on('error', (error) => {
      console.error(`[FVR ERROR] Failed to write to ${errLog}: ${error.message}`);
    });

    return { outStream, errStream };
  } catch (error) {
    throw new StateError(`Failed to create log streams for ${appName}: ${error.message}`);
  }
}

/**
 * Get last N lines from a file
 * @param {string} filePath - Path to file
 * @param {number} lines - Number of lines to retrieve
 * @returns {string} Last N lines
 */
function getLastLines(filePath, lines = 50) {
  if (!fs.existsSync(filePath)) {
    return '';
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const allLines = content.split('\n');

    // Get last N lines (filter empty last line if exists)
    const lastLines = allLines.slice(-lines - 1);
    if (lastLines[lastLines.length - 1] === '') {
      lastLines.pop();
    }

    return lastLines.join('\n');
  } catch (error) {
    console.warn(`[FVR WARN] Failed to read log file ${filePath}: ${error.message}`);
    return '';
  }
}

/**
 * Stream logs to stdout
 * @param {string} appName - App name
 * @param {object} options - Streaming options
 * @param {number} options.lines - Number of initial lines to show (default: 50)
 * @param {boolean} options.out - Stream stdout (default: true)
 * @param {boolean} options.err - Stream stderr (default: true)
 * @param {Function} options.onLine - Callback for each new line (optional)
 * @returns {object} Object with stop() method to stop streaming
 */
function streamLogs(appName, options = {}) {
  const {
    lines = 50,
    out = true,
    err = true,
    onLine = null
  } = options;

  const { outLog, errLog } = getLogPaths(appName);

  // Print initial lines
  if (out && fs.existsSync(outLog)) {
    const initialOut = getLastLines(outLog, lines);
    if (initialOut) {
      console.log(initialOut);
    }
  }

  if (err && fs.existsSync(errLog)) {
    const initialErr = getLastLines(errLog, lines);
    if (initialErr) {
      // Print stderr in red
      console.error('\x1b[31m' + initialErr + '\x1b[0m');
    }
  }

  // Watch for new lines
  const watchers = [];

  if (out && fs.existsSync(outLog)) {
    const outWatcher = fs.watch(outLog, (eventType) => {
      if (eventType === 'change') {
        // This is a simplified approach - for production, use a proper tail implementation
        // For now, we'll rely on the daemon to write logs
      }
    });
    watchers.push(outWatcher);
  }

  if (err && fs.existsSync(errLog)) {
    const errWatcher = fs.watch(errLog, (eventType) => {
      if (eventType === 'change') {
        // Simplified approach
      }
    });
    watchers.push(errWatcher);
  }

  // Return stop function
  return {
    stop: () => {
      watchers.forEach(watcher => watcher.close());
    }
  };
}

/**
 * Clean up log files for an app
 * @param {string} appName - App name
 */
function cleanupLogs(appName) {
  const { outLog, errLog } = getLogPaths(appName);

  [outLog, errLog, `${outLog}.1`, `${errLog}.1`].forEach(logPath => {
    if (fs.existsSync(logPath)) {
      try {
        fs.unlinkSync(logPath);
      } catch (error) {
        console.warn(`[FVR WARN] Failed to delete log ${logPath}: ${error.message}`);
      }
    }
  });
}

module.exports = {
  ensureLogsDir,
  getLogPaths,
  createLogStreams,
  rotateLogIfNeeded,
  getLastLines,
  streamLogs,
  cleanupLogs
};
