const { sendCommand, isDaemonRunning } = require('../daemon/ipc');
const { loadConfig } = require('../core/config');
const { getAllApps, updateApp, getApp } = require('../core/state');
const { exitWithError, printInfo, printSuccess } = require('../utils/errors');

/**
 * Update command handler
 * Reloads app with updated configuration from config file
 * @param {string} configOrName - Config file path or app name
 * @param {object} options - Command options
 */
async function updateCommand(configOrName, options = {}) {
  try {
    // Check if daemon is running
    if (!isDaemonRunning()) {
      exitWithError('Daemon is not running. Start apps with: fvr start');
    }

    let appsToUpdate = [];

    // Handle 'all' case
    if (configOrName === 'all') {
      // Reload from default config file
      try {
        const config = loadConfig();
        appsToUpdate = config.apps;
      } catch (error) {
        exitWithError(`Failed to load config: ${error.message}`);
      }
    } else if (!configOrName) {
      // No argument - reload all from default config
      try {
        const config = loadConfig();
        appsToUpdate = config.apps;
      } catch (error) {
        exitWithError(`Failed to load config: ${error.message}`);
      }
    } else if (configOrName.endsWith('.js') || configOrName.endsWith('.cjs')) {
      // Config file path provided
      try {
        const config = loadConfig(configOrName);
        appsToUpdate = config.apps;
      } catch (error) {
        exitWithError(`Failed to load config: ${error.message}`);
      }
    } else {
      // Assume it's an app name
      const appName = configOrName;
      const existingApp = getApp(appName);

      if (!existingApp) {
        exitWithError(`App '${appName}' not found`);
      }

      // Try to load from default config
      try {
        const config = loadConfig();
        const appConfig = config.apps.find(a => a.name === appName);

        if (!appConfig) {
          exitWithError(`App '${appName}' not found in config file`);
        }

        appsToUpdate = [appConfig];
      } catch (error) {
        exitWithError(`Failed to load config: ${error.message}`);
      }
    }

    if (appsToUpdate.length === 0) {
      printInfo('No apps to update');
      return;
    }

    printInfo(`Updating ${appsToUpdate.length} app(s) with new configuration...`);

    // Update each app
    for (const appConfig of appsToUpdate) {
      try {
        const existingApp = getApp(appConfig.name);

        if (!existingApp) {
          console.warn(`[FVR WARN] App '${appConfig.name}' not running, skipping`);
          continue;
        }

        // Update state with new config
        updateApp(appConfig.name, {
          script: appConfig.script,
          cwd: appConfig.cwd,
          exec_mode: appConfig.exec_mode,
          instances: appConfig.instances,
          env: appConfig.env,
          args: appConfig.args,
          watch: appConfig.watch,
          autorestart: appConfig.autorestart,
          max_memory_restart: appConfig.max_memory_restart
        });

        // Restart the app with new config
        const result = await sendCommand('restart', { appName: appConfig.name });

        if (result.success) {
          printSuccess(`${appConfig.name} updated and restarted`);
        }
      } catch (error) {
        console.error(`[FVR ERROR] Failed to update ${appConfig.name}: ${error.message}`);
      }
    }
  } catch (error) {
    exitWithError(error.message);
  }
}

module.exports = updateCommand;
