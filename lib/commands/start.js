const path = require('path');
const { loadConfig } = require('../core/config');
const { addApp, getApp, getAllApps } = require('../core/state');
const { sendCommand, isDaemonRunning } = require('../daemon/ipc');
const { forkDaemon } = require('../daemon/daemon');
const { exitWithError, printInfo, printSuccess, ConfigError } = require('../utils/errors');

/**
 * Ensure daemon is running, start if not
 */
async function ensureDaemon() {
  if (!isDaemonRunning()) {
    printInfo('Starting FVR daemon...');
    const daemonPid = forkDaemon();
    printInfo(`Daemon started (PID: ${daemonPid})`);

    // Wait a bit for daemon to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify daemon is running
    if (!isDaemonRunning()) {
      exitWithError('Failed to start daemon');
    }
  }
}

/**
 * Start command handler
 * @param {string} configOrName - Config file path or app name
 * @param {object} options - Command options
 */
async function startCommand(configOrName, options = {}) {
  try {
    // Ensure daemon is running
    await ensureDaemon();

    // Determine if argument is a config file or app name
    let config;
    let appName = null;

    if (!configOrName) {
      // No argument - look for config in current directory
      try {
        config = loadConfig();
      } catch (error) {
        exitWithError(error.message);
      }
    } else if (configOrName.endsWith('.js') || configOrName.endsWith('.cjs')) {
      // Looks like a config file path
      try {
        config = loadConfig(configOrName);
      } catch (error) {
        exitWithError(error.message);
      }
    } else {
      // Assume it's an app name
      appName = configOrName;
      const app = getApp(appName);

      if (!app) {
        exitWithError(`App '${appName}' not found in state`);
      }

      // Convert app state back to config format
      config = {
        apps: [{
          name: app.name,
          script: app.script,
          cwd: app.cwd,
          exec_mode: app.exec_mode,
          instances: app.instances,
          env: app.env,
          args: app.args,
          watch: app.watch,
          autorestart: app.autorestart,
          max_memory_restart: app.max_memory_restart
        }]
      };
    }

    // Start all apps in config
    for (const appConfig of config.apps) {
      printInfo(`Starting ${appConfig.name}...`);

      // Check if app already exists in state
      const existing = getApp(appConfig.name);

      if (!existing) {
        // Add to state
        try {
          addApp(appConfig);
        } catch (error) {
          // Ignore if already exists
          if (!error.message.includes('already exists')) {
            throw error;
          }
        }
      }

      // Send start command to daemon
      try {
        const result = await sendCommand('start', { appConfig });

        if (result.success) {
          printSuccess(`${appConfig.name} started (PID${result.pids.length > 1 ? 's' : ''}: ${result.pids.join(', ')})`);
        }
      } catch (error) {
        console.error(`[FVR ERROR] Failed to start ${appConfig.name}: ${error.message}`);
      }
    }
  } catch (error) {
    exitWithError(error.message);
  }
}

module.exports = startCommand;
