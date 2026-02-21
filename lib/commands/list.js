const Table = require('cli-table3');
const { sendCommand, isDaemonRunning } = require('../daemon/ipc');
const { exitWithError, printInfo } = require('../utils/errors');

/**
 * Format bytes to human readable format
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string
 */
function formatMemory(bytes) {
  if (!bytes || bytes === 0) {
    return '0 B';
  }

  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }
  if (mb < 1024) {
    return `${mb.toFixed(0)} MB`;
  }

  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

/**
 * Format uptime
 * @param {string} startedAt - ISO timestamp
 * @returns {string} Formatted uptime
 */
function formatUptime(startedAt) {
  if (!startedAt) {
    return '0s';
  }

  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diff = Math.floor((now - start) / 1000); // seconds

  if (diff < 60) {
    return `${diff}s`;
  }
  if (diff < 3600) {
    return `${Math.floor(diff / 60)}m`;
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours}h`;
  }
  const days = Math.floor(diff / 86400);
  return `${days}D`;
}

/**
 * Format PID(s) for display
 * @param {array} pids - Array of PIDs
 * @returns {string} Formatted PID string
 */
function formatPids(pids) {
  if (!pids || pids.length === 0) {
    return '0';
  }

  if (pids.length === 1) {
    return pids[0].toString();
  }

  // Show first PID for cluster mode
  return pids[0].toString();
}

/**
 * Get status symbol and color
 * @param {string} status - Status string
 * @returns {string} Colored status with symbol
 */
function formatStatus(status) {
  switch (status) {
    case 'online':
      return `\x1b[1m\x1b[32monline\x1b[0m`; // Bold Green
    case 'stopped':
      return `\x1b[90mstopped\x1b[0m`; // Gray
    case 'errored':
      return `\x1b[1m\x1b[31merrored\x1b[0m`; // Bold Red
    case 'restarting':
      return `\x1b[33mlaunching\x1b[0m`; // Yellow
    default:
      return status;
  }
}

/**
 * Format mode (fork/cluster)
 * @param {string} mode - Execution mode
 * @returns {string} Formatted mode
 */
function formatMode(mode) {
  if (mode === 'cluster') {
    return '\x1b[36mcluster\x1b[0m'; // Cyan
  }
  return 'fork';
}

/**
 * List command handler
 * @param {object} options - Command options
 */
async function listCommand(options = {}) {
  try {
    let apps = [];

    // Check if daemon is running
    if (isDaemonRunning()) {
      // Get app list from daemon
      const result = await sendCommand('list', {});
      apps = result.apps || [];
    }

    if (apps.length === 0) {
      console.log('┌─────────────────────────────────────────────────────────────────────┐');
      console.log('│ \x1b[33mNo processes are being managed by FVR\x1b[0m                             │');
      console.log('│ Try running: \x1b[36mfvr start\x1b[0m                                         │');
      console.log('└─────────────────────────────────────────────────────────────────────┘');
      return;
    }

    // Create table with PM2-like styling
    const table = new Table({
      head: [
        '\x1b[1mApp name\x1b[0m',
        '\x1b[1mid\x1b[0m',
        '\x1b[1mmode\x1b[0m',
        '\x1b[1mpid\x1b[0m',
        '\x1b[1mstatus\x1b[0m',
        '\x1b[1mrestart\x1b[0m',
        '\x1b[1muptime\x1b[0m',
        '\x1b[1mmemory\x1b[0m'
      ],
      style: {
        head: [],
        border: ['grey'],
        compact: true
      },
      colWidths: [18, 5, 10, 8, 12, 9, 9, 12],
      chars: {
        'top': '─',
        'top-mid': '┬',
        'top-left': '┌',
        'top-right': '┐',
        'bottom': '─',
        'bottom-mid': '┴',
        'bottom-left': '└',
        'bottom-right': '┘',
        'left': '│',
        'left-mid': '├',
        'mid': '─',
        'mid-mid': '┼',
        'right': '│',
        'right-mid': '┤',
        'middle': '│'
      }
    });

    // Add rows
    for (const app of apps) {
      const restartCount = app.restart_count || 0;
      const instances = app.instances || 1;

      // For cluster mode, show instance info
      let nameDisplay = app.name;
      if (app.exec_mode === 'cluster' && instances > 1) {
        nameDisplay = `${app.name} (${app.pids.length}/${instances})`;
      }

      table.push([
        nameDisplay,
        app.id.toString(),
        formatMode(app.exec_mode),
        formatPids(app.pids),
        formatStatus(app.status),
        restartCount.toString(),
        formatUptime(app.started_at),
        formatMemory(app.memory)
      ]);
    }

    // Print table
    console.log(table.toString());

    // Print summary (PM2-style)
    console.log('');

    // Module information line (like PM2)
    console.log('\x1b[90m Module activated\x1b[0m');

    const online = apps.filter(a => a.status === 'online').length;
    const stopped = apps.filter(a => a.status === 'stopped').length;
    const errored = apps.filter(a => a.status === 'errored').length;
    const restarting = apps.filter(a => a.status === 'restarting').length;

    // Status summary
    const statusParts = [];
    if (online > 0) statusParts.push(`\x1b[32m● online: ${online}\x1b[0m`);
    if (stopped > 0) statusParts.push(`\x1b[90m● stopped: ${stopped}\x1b[0m`);
    if (errored > 0) statusParts.push(`\x1b[31m● errored: ${errored}\x1b[0m`);
    if (restarting > 0) statusParts.push(`\x1b[33m● launching: ${restarting}\x1b[0m`);

    console.log(statusParts.join('  '));
  } catch (error) {
    exitWithError(error.message);
  }
}

module.exports = listCommand;
