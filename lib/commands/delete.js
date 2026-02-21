const { sendCommand, isDaemonRunning } = require('../daemon/ipc');
const { getAllApps } = require('../core/state');
const { exitWithError, printInfo, printSuccess } = require('../utils/errors');

/**
 * Delete command handler
 * @param {string} appName - App name or 'all'
 * @param {object} options - Command options
 */
async function deleteCommand(appName, options = {}) {
  if (!appName) {
    exitWithError('App name is required. Usage: fvr delete <name|id|all>');
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
        printInfo('No apps to delete');
        return;
      }

      printInfo(`Deleting ${apps.length} app(s)...`);

      for (const app of apps) {
        try {
          await sendCommand('delete', { appName: app.name });
          printSuccess(`${app.name} deleted`);
        } catch (error) {
          console.error(`[FVR ERROR] Failed to delete ${app.name}: ${error.message}`);
        }
      }
    } else {
      // Delete single app
      printInfo(`Deleting ${appName}...`);

      const result = await sendCommand('delete', { appName });

      if (result.success) {
        printSuccess(`${appName} deleted`);
      }
    }
  } catch (error) {
    exitWithError(error.message);
  }
}

module.exports = deleteCommand;
