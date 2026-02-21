const { sendCommand, isDaemonRunning } = require('../daemon/ipc');
const { getAllApps } = require('../core/state');
const { exitWithError, printInfo, printSuccess } = require('../utils/errors');

/**
 * Restart command handler
 * @param {string} appName - App name or 'all'
 * @param {object} options - Command options
 */
async function restartCommand(appName, options = {}) {
  if (!appName) {
    exitWithError('App name is required. Usage: fvr restart <name>');
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
        printInfo('No apps to restart');
        return;
      }

      printInfo(`Restarting ${apps.length} app(s)...`);

      for (const app of apps) {
        try {
          const result = await sendCommand('restart', { appName: app.name });
          if (result.success) {
            printSuccess(`${app.name} restarted (PID${result.pids.length > 1 ? 's' : ''}: ${result.pids.join(', ')})`);
          }
        } catch (error) {
          console.error(`[FVR ERROR] Failed to restart ${app.name}: ${error.message}`);
        }
      }
    } else {
      // Restart single app
      printInfo(`Restarting ${appName}...`);

      const result = await sendCommand('restart', { appName });

      if (result.success) {
        printSuccess(`${appName} restarted (PID${result.pids.length > 1 ? 's' : ''}: ${result.pids.join(', ')})`);
      }
    }
  } catch (error) {
    exitWithError(error.message);
  }
}

module.exports = restartCommand;
