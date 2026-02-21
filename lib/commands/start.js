const path = require('path');
const { loadConfig } = require('../core/config');
const { addApp, getApp, getAllApps } = require('../core/state');
const { sendCommand, isDaemonRunning } = require('../daemon/ipc');
const { forkDaemon } = require('../daemon/daemon');
const { exitWithError, printInfo, printSuccess, ConfigError } = require('../utils/errors');

/**
 * Build app config from inline CLI arguments
 * @param {string} script - Script to run
 * @param {object} options - CLI options
 * @param {object} command - Commander command object
 * @returns {object} App configuration
 */
function buildInlineConfig(script, options, command) {
  if (!options.name) {
    exitWithError('--name is required for inline app start');
  }

  // Parse script arguments (everything after --)
  let scriptArgs = [];
  if (command && command.args) {
    const rawArgs = command.parent.rawArgs;
    const dashDashIndex = rawArgs.indexOf('--');
    if (dashDashIndex !== -1) {
      scriptArgs = rawArgs.slice(dashDashIndex + 1);
    }
  }

  // Check if script is a system command
  const isSystemCommand = ['npm', 'yarn', 'pnpm', 'bun', 'deno', 'python', 'python3', 'ruby', 'php'].includes(script);

  // System commands can't use cluster mode
  if (isSystemCommand && options.instances && options.instances > 1) {
    printInfo(`Warning: Cluster mode not supported for '${script}'. Using fork mode with 1 instance.`);
  }

  // Build config
  const config = {
    name: options.name,
    script: script,
    args: scriptArgs.length > 0 ? scriptArgs : [],
    cwd: options.cwd || process.cwd(),
    exec_mode: (isSystemCommand || !options.instances || options.instances <= 1) ? 'fork' : 'cluster',
    instances: (isSystemCommand || !options.instances) ? 1 : options.instances,
    watch: options.watch || false,
    autorestart: true,
    max_memory_restart: options.maxMemory || null,
    env: options.env || {}
  };

  return config;
}

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
 * @param {string} configOrName - Config file path, app name, or script (for inline start)
 * @param {object} options - Command options
 * @param {object} command - Commander command object (for inline start)
 */
async function startCommand(configOrName, options = {}, command = null) {
  try {
    // Ensure daemon is running
    await ensureDaemon();

    // Determine if argument is a config file or app name
    let config;
    let appName = null;

    // Check if this is an inline start (PM2-style)
    if (options.name && configOrName) {
      // Inline start: fvr start <script> --name <name> [options] [-- args]
      const inlineConfig = buildInlineConfig(configOrName, options, command);
      config = { apps: [inlineConfig] };
    } else if (!configOrName) {
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

      if (app) {
        // App exists in state - restart it
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
      } else {
        // App not in state - try to find in config file
        try {
          const fullConfig = loadConfig();
          const appConfig = fullConfig.apps.find(a => a.name === appName);

          if (!appConfig) {
            exitWithError(`App '${appName}' not found in config file or state`);
          }

          config = {
            apps: [appConfig]
          };
        } catch (error) {
          exitWithError(`App '${appName}' not found in state, and failed to load config: ${error.message}`);
        }
      }
    }

    // Start all apps in config
    for (const appConfig of config.apps) {
      // Override watch setting if --watch flag is provided
      if (options.watch !== undefined) {
        appConfig.watch = options.watch;
      }

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
          const watchStatus = appConfig.watch ? ' (watch enabled)' : '';
          printSuccess(`${appConfig.name} started (PID${result.pids.length > 1 ? 's' : ''}: ${result.pids.join(', ')})${watchStatus}`);
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
