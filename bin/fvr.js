#!/usr/bin/env node

const { program } = require('commander');
const startCommand = require('../lib/commands/start');
const stopCommand = require('../lib/commands/stop');
const restartCommand = require('../lib/commands/restart');
const deleteCommand = require('../lib/commands/delete');
const listCommand = require('../lib/commands/list');
const logsCommand = require('../lib/commands/logs');

// CLI configuration
program
  .name('fvr')
  .description('FVR - Lightweight Node.js process manager')
  .version('0.1.0');

// Start command
program
  .command('start [config]')
  .description('Start apps from config file or restart an app by name')
  .action(startCommand);

// Stop command
program
  .command('stop <name>')
  .description('Stop a running app (use "all" to stop all apps)')
  .action(stopCommand);

// Restart command
program
  .command('restart <name>')
  .description('Restart a running app (use "all" to restart all apps)')
  .action(restartCommand);

// Delete command
program
  .command('delete <name>')
  .description('Stop and remove an app from FVR state (use "all" to delete all)')
  .action(deleteCommand);

// List command
program
  .command('list')
  .description('List all managed apps with their status')
  .alias('ls')
  .action(listCommand);

// Logs command
program
  .command('logs <name>')
  .description('Stream logs for an app')
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
