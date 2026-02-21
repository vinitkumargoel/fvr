const { sendCommand, isDaemonRunning } = require('../daemon/ipc');
const { getAllApps } = require('../core/state');
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
