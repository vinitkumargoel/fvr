/**
 * Custom error class for FORV-specific errors
 */
class FVRError extends Error {
  constructor(message, code = 'FORV_ERROR') {
    super(message);
    this.name = 'FVRError';
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error for configuration-related issues
 */
class ConfigError extends FVRError {
  constructor(message) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

/**
 * Error for state management issues
 */
class StateError extends FVRError {
  constructor(message) {
    super(message, 'STATE_ERROR');
    this.name = 'StateError';
  }
}

/**
 * Error for daemon-related issues
 */
class DaemonError extends FVRError {
  constructor(message) {
    super(message, 'DAEMON_ERROR');
    this.name = 'DaemonError';
  }
}

/**
 * Error for process management issues
 */
class ProcessError extends FVRError {
  constructor(message) {
    super(message, 'PROCESS_ERROR');
    this.name = 'ProcessError';
  }
}

/**
 * Format error message with FVR prefix
 * @param {string} message - Error message
 * @returns {string} Formatted error message
 */
function formatError(message) {
  return `[FVR ERROR] ${message}`;
}

/**
 * Format info message with FVR prefix
 * @param {string} message - Info message
 * @returns {string} Formatted info message
 */
function formatInfo(message) {
  return `[FVR] ${message}`;
}

/**
 * Print error to stderr and exit
 * @param {string|Error} error - Error message or Error object
 * @param {number} exitCode - Exit code (default: 1)
 */
function exitWithError(error, exitCode = 1) {
  const message = error instanceof Error ? error.message : error;
  console.error(formatError(message));
  if (error instanceof Error && error.stack && process.env.FVR_DEBUG) {
    console.error(error.stack);
  }
  process.exit(exitCode);
}

/**
 * Print formatted info message to stdout
 * @param {string} message - Info message
 */
function printInfo(message) {
  console.log(formatInfo(message));
}

/**
 * Print success message
 * @param {string} message - Success message
 */
function printSuccess(message) {
  console.log(`✓ ${message}`);
}

/**
 * Validate that required fields are present in an object
 * @param {object} obj - Object to validate
 * @param {string[]} requiredFields - Array of required field names
 * @param {string} context - Context for error messages (e.g., 'app config')
 * @throws {ConfigError} If required fields are missing
 */
function validateRequiredFields(obj, requiredFields, context = 'object') {
  const missing = requiredFields.filter(field => !(field in obj));
  if (missing.length > 0) {
    throw new ConfigError(
      `Missing required field(s) in ${context}: ${missing.join(', ')}`
    );
  }
}

module.exports = {
  FVRError,
  ConfigError,
  StateError,
  DaemonError,
  ProcessError,
  formatError,
  formatInfo,
  exitWithError,
  printInfo,
  printSuccess,
  validateRequiredFields
};
