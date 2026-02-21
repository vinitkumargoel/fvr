const { sendCommand, isDaemonRunning } = require('../daemon/ipc');
const { getAllApps, updateApp, getApp } = require('../core/state');
const { exitWithError, printInfo, printSuccess } = require('../utils/errors');

/**
 * Stop command handler
 * @param {string} appName - App name or 'all'
 * @param {object} options - Command options
 */
async function stopCommand(appName, options = {}) {
  if (!appName) {
    exitWithError('App name is required. Usage: fvr stop <name>');
  }

  try {
    // Check if daemon is running
    if (!isDaemonRunning()) {
      exitWithError('Daemon is not running');
    }

    // Handle --watch flag (stop watching without stopping the process)
    if (options.watch !== undefined) {
      if (appName === 'all') {
        const apps = getAllApps();
        for (const app of apps) {
          updateApp(app.name, { watch: false });
        }
        printSuccess('Stopped watching all apps');
        printInfo('Note: Apps are still running. Use "fvr stop all" to stop them.');
      } else {
        const app = getApp(appName);
        if (!app) {
          exitWithError(`App '${appName}' not found`);
        }
        updateApp(appName, { watch: false });
        printSuccess(`Stopped watching ${appName}`);
        printInfo('Note: App is still running. Use "fvr stop <name>" without --watch to stop it.');
      }
      return;
    }

    // Handle 'all' case
    if (appName === 'all') {
      const apps = getAllApps();

      if (apps.length === 0) {
        printInfo('No apps to stop');
        return;
      }

      printInfo(`Stopping ${apps.length} app(s)...`);

      for (const app of apps) {
        try {
          await sendCommand('stop', { appName: app.name });
          printSuccess(`${app.name} stopped`);
        } catch (error) {
          console.error(`[FVR ERROR] Failed to stop ${app.name}: ${error.message}`);
        }
      }
    } else {
      // Stop single app
      printInfo(`Stopping ${appName}...`);

      const result = await sendCommand('stop', { appName });

      if (result.success) {
        printSuccess(`${appName} stopped`);
      }
    }
  } catch (error) {
    exitWithError(error.message);
  }
}

module.exports = stopCommand;
