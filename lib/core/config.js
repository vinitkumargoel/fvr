const fs = require('fs');
const path = require('path');
const { CONFIG_FILES, DEFAULTS, EXEC_MODES } = require('../utils/constants');
const { ConfigError, validateRequiredFields } = require('../utils/errors');

/**
 * Find config file in directory
 * @param {string} cwd - Directory to search in
 * @returns {string|null} Config file path or null if not found
 */
function findConfig(cwd = process.cwd()) {
  for (const configFile of CONFIG_FILES) {
    const configPath = path.join(cwd, configFile);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * Load config file
 * @param {string} configPath - Path to config file (absolute or relative)
 * @returns {object} Loaded config object
 * @throws {ConfigError} If config file not found or invalid
 */
function loadConfig(configPath) {
  let resolvedPath;

  // If configPath is provided, use it
  if (configPath) {
    resolvedPath = path.resolve(configPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new ConfigError(
        `Config file not found: ${resolvedPath}\n` +
        `Searched for: ${configPath}`
      );
    }
  } else {
    // Search for config file in current directory
    resolvedPath = findConfig();
    if (!resolvedPath) {
      throw new ConfigError(
        `Config file not found in current directory.\n` +
        `Searched for: ${CONFIG_FILES.join(', ')}`
      );
    }
  }

  // Load config using require
  let config;
  try {
    // Clear require cache to allow reloading
    delete require.cache[require.resolve(resolvedPath)];
    config = require(resolvedPath);
  } catch (error) {
    throw new ConfigError(`Failed to load config file: ${error.message}`);
  }

  // Validate and normalize config
  return validateConfig(config, path.dirname(resolvedPath));
}

/**
 * Validate config object
 * @param {object} config - Config object to validate
 * @param {string} basePath - Base path for resolving relative paths
 * @returns {object} Validated and normalized config
 * @throws {ConfigError} If validation fails
 */
function validateConfig(config, basePath = process.cwd()) {
  if (!config || typeof config !== 'object') {
    throw new ConfigError('Config must be an object');
  }

  if (!config.apps || !Array.isArray(config.apps)) {
    throw new ConfigError('Config must have an "apps" array');
  }

  if (config.apps.length === 0) {
    throw new ConfigError('Config must have at least one app');
  }

  // Validate all apps
  const errors = [];
  const names = new Set();

  const validatedApps = [];

  for (let i = 0; i < config.apps.length; i++) {
    try {
      const app = validateApp(config.apps[i], basePath);

      // Check for duplicate names
      if (names.has(app.name)) {
        errors.push(`Duplicate app name: "${app.name}"`);
      } else {
        names.add(app.name);
        validatedApps.push(app);
      }
    } catch (error) {
      errors.push(`App #${i}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    throw new ConfigError(
      `Config validation failed:\n  - ${errors.join('\n  - ')}`
    );
  }

  return {
    apps: validatedApps
  };
}

/**
 * Validate single app config
 * @param {object} app - App config to validate
 * @param {string} basePath - Base path for resolving relative paths
 * @returns {object} Validated and normalized app config
 * @throws {ConfigError} If validation fails
 */
function validateApp(app, basePath = process.cwd()) {
  if (!app || typeof app !== 'object') {
    throw new ConfigError('App config must be an object');
  }

  // Validate required fields
  validateRequiredFields(app, ['name', 'script'], 'app config');

  // Validate name
  if (typeof app.name !== 'string' || app.name.trim().length === 0) {
    throw new ConfigError('App name must be a non-empty string');
  }

  // Validate and normalize script path
  if (typeof app.script !== 'string' || app.script.trim().length === 0) {
    throw new ConfigError('App script must be a non-empty string');
  }

  const scriptPath = path.isAbsolute(app.script)
    ? app.script
    : path.resolve(basePath, app.script);

  if (!fs.existsSync(scriptPath)) {
    throw new ConfigError(
      `Script file not found: ${scriptPath}\n` +
      `(resolved from: ${app.script})`
    );
  }

  // Normalize app config
  return normalizeApp(app, basePath);
}

/**
 * Normalize app config with defaults and absolute paths
 * @param {object} app - App config to normalize
 * @param {string} basePath - Base path for resolving relative paths
 * @returns {object} Normalized app config
 */
function normalizeApp(app, basePath = process.cwd()) {
  const scriptPath = path.isAbsolute(app.script)
    ? app.script
    : path.resolve(basePath, app.script);

  const cwd = app.cwd
    ? (path.isAbsolute(app.cwd) ? app.cwd : path.resolve(basePath, app.cwd))
    : path.dirname(scriptPath);

  // Validate exec_mode
  const exec_mode = app.exec_mode || DEFAULTS.exec_mode;
  if (!Object.values(EXEC_MODES).includes(exec_mode)) {
    throw new ConfigError(
      `Invalid exec_mode for app "${app.name}": ${exec_mode}. ` +
      `Must be "${EXEC_MODES.FORK}" or "${EXEC_MODES.CLUSTER}"`
    );
  }

  // Validate instances
  let instances = app.instances !== undefined ? app.instances : DEFAULTS.instances;
  if (typeof instances !== 'number' || instances < 1 || !Number.isInteger(instances)) {
    throw new ConfigError(
      `Invalid instances for app "${app.name}": ${instances}. ` +
      `Must be a positive integer`
    );
  }

  // Validate watch
  const watch = app.watch !== undefined ? app.watch : DEFAULTS.watch;
  if (typeof watch !== 'boolean') {
    throw new ConfigError(
      `Invalid watch for app "${app.name}": ${watch}. Must be boolean`
    );
  }

  // Validate autorestart
  const autorestart = app.autorestart !== undefined ? app.autorestart : DEFAULTS.autorestart;
  if (typeof autorestart !== 'boolean') {
    throw new ConfigError(
      `Invalid autorestart for app "${app.name}": ${autorestart}. Must be boolean`
    );
  }

  // Validate max_memory_restart
  let max_memory_restart = app.max_memory_restart || null;
  if (max_memory_restart !== null) {
    if (typeof max_memory_restart !== 'string') {
      throw new ConfigError(
        `Invalid max_memory_restart for app "${app.name}": ${max_memory_restart}. ` +
        `Must be a string like "200M" or "1G"`
      );
    }
    // Validate format (number + M/G)
    if (!/^\d+[MG]$/.test(max_memory_restart)) {
      throw new ConfigError(
        `Invalid max_memory_restart format for app "${app.name}": ${max_memory_restart}. ` +
        `Must be like "200M" or "1G"`
      );
    }
  }

  // Normalize env (use first if array)
  let env = app.env || DEFAULTS.env;
  if (Array.isArray(env)) {
    if (env.length === 0) {
      env = {};
    } else {
      env = env[0]; // Use first environment
      if (typeof env !== 'object' || env === null) {
        throw new ConfigError(
          `Invalid env for app "${app.name}": env array must contain objects`
        );
      }
    }
  } else if (typeof env !== 'object' || env === null) {
    throw new ConfigError(
      `Invalid env for app "${app.name}": must be an object or array of objects`
    );
  }

  // Normalize args
  let args = app.args || DEFAULTS.args;
  if (typeof args === 'string') {
    // Split string into array (simple space split)
    args = args.trim().split(/\s+/).filter(arg => arg.length > 0);
  } else if (!Array.isArray(args)) {
    throw new ConfigError(
      `Invalid args for app "${app.name}": must be a string or array`
    );
  }

  return {
    name: app.name.trim(),
    script: scriptPath,
    cwd,
    exec_mode,
    instances,
    watch,
    autorestart,
    max_memory_restart,
    env,
    args
  };
}

module.exports = {
  findConfig,
  loadConfig,
  validateConfig,
  validateApp,
  normalizeApp
};
