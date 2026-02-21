#!/usr/bin/env node

const { program } = require('commander');
const startCommand = require('../lib/commands/start');
const stopCommand = require('../lib/commands/stop');
const restartCommand = require('../lib/commands/restart');
const deleteCommand = require('../lib/commands/delete');
const listCommand = require('../lib/commands/list');
const logsCommand = require('../lib/commands/logs');
const updateCommand = require('../lib/commands/update');

// CLI configuration
program
  .name('fvr')
  .description('FVR - Lightweight Node.js process manager')
  .version('0.2.0');

// Start command
program
  .command('start [name|file|id...]')
  .description('start and daemonize an app')
  .option('--watch', 'Watch folder for changes')
  .action((nameOrConfig, options) => {
    startCommand(nameOrConfig, options);
  });

// Stop command
program
  .command('stop <name|id|all...>')
  .description('stop a process')
  .option('--watch', 'Stop watching folder for changes')
  .action((name, options) => {
    stopCommand(name, options);
  });

// Restart command
program
  .command('restart <name|id|all...>')
  .description('restart a process')
  .option('--watch', 'Toggle watching folder for changes')
  .action((name, options) => {
    restartCommand(name, options);
  });

// Delete command
program
  .command('delete <name|id|all...>')
  .alias('del')
  .description('stop and delete a process from fvr process list')
  .action((name, options) => {
    deleteCommand(name, options);
  });

// Update/Reload command
program
  .command('update [name|file|all...]')
  .alias('reload')
  .description('update and reload apps with new configuration from config file')
  .action((nameOrConfig, options) => {
    updateCommand(nameOrConfig, options);
  });

// List command
program
  .command('list')
  .alias('ls')
  .description('list all processes')
  .action(listCommand);

// Logs command
program
  .command('logs <name>')
  .description('stream logs for an app')
  .option('--lines <n>', 'Number of lines to show initially', '50')
  .option('--out', 'Show only stdout')
  .option('--err', 'Show only stderr')
  .action(logsCommand);

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
