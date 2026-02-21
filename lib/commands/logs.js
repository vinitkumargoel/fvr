const { getApp } = require('../core/state');
const { streamLogs, getLogPaths } = require('../core/logger');
const { exitWithError, printInfo } = require('../utils/errors');
const fs = require('fs');

/**
 * Logs command handler
 * @param {string} appName - App name
 * @param {object} options - Command options
 */
async function logsCommand(appName, options = {}) {
  if (!appName) {
    exitWithError('App name is required. Usage: fvr logs <name>');
  }

  try {
    // Check if app exists
    const app = getApp(appName);
    if (!app) {
      exitWithError(`App '${appName}' not found`);
    }

    // Get log paths
    const { outLog, errLog } = getLogPaths(appName);

    // Check if logs exist
    const outExists = fs.existsSync(outLog);
    const errExists = fs.existsSync(errLog);

    if (!outExists && !errExists) {
      printInfo(`No logs found for ${appName}`);
      printInfo('App may not have been started yet');
      return;
    }

    // Determine which logs to show
    const showOut = options.out !== false && (options.err ? false : true);
    const showErr = options.err !== false && (options.out ? false : true);

    const lines = options.lines || 50;

    // Stream logs
    printInfo(`Streaming logs for ${appName}... (Press Ctrl+C to exit)`);
    console.log('');

    const streamer = streamLogs(appName, {
      lines,
      out: showOut,
      err: showErr
    });

    // Handle Ctrl+C to stop streaming
    process.on('SIGINT', () => {
      console.log('\n');
      printInfo('Stopped streaming logs');
      streamer.stop();
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {}); // Never resolves, keeps streaming
  } catch (error) {
    exitWithError(error.message);
  }
}

module.exports = logsCommand;
