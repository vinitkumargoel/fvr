# FVR

[![npm version](https://img.shields.io/npm/v/@vinitkumargoel/fvr.svg)](https://www.npmjs.com/package/@vinitkumargoel/fvr)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/fvr.svg)](https://nodejs.org)

**FVR** is a lightweight, minimal Node.js process manager — a PM2 alternative designed for simplicity and efficiency. Zero bloat, zero complexity. Just process management done right.

## ✨ Features

- 🚀 **Fork & Cluster Modes** — Run single instances or scale with Node.js clustering
- 🔄 **Auto-Restart** — Automatic crash recovery with smart crash loop detection
- 📊 **Memory Monitoring** — Restart processes when memory thresholds are exceeded
- 👁️ **Watch Mode** — Auto-restart on file changes (perfect for development)
- 📝 **Log Management** — Centralized stdout/stderr logs with automatic rotation
- 💻 **Simple CLI** — Clean, intuitive commands (start, stop, restart, list, logs)
- 🎯 **Lightweight** — Minimal dependencies, fast startup, low overhead
- ⚙️ **Easy Configuration** — Single JavaScript config file, no complex setup

## 📋 Requirements

- **Node.js** ≥ 16.0.0
- **OS**: Linux (macOS support for development only)

## 📦 Installation

Install globally via npm:

```bash
npm install -g @vinitkumargoel/fvr
```

Or use with npx (no installation needed):

```bash
npx @vinitkumargoel/fvr start
```

## 🚀 Quick Start

### 1. Create a config file

Create `fvr.config.js` in your project root:

```javascript
module.exports = {
  apps: [
    {
      name: 'my-app',
      script: 'server.js',
      exec_mode: 'cluster',
      instances: 2,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
```

### 2. Start your app

```bash
fvr start
```

### 3. Check status

```bash
fvr list
```

### 4. View logs

```bash
fvr logs my-app
```

### 5. Manage your app

```bash
fvr restart my-app    # Restart
fvr stop my-app       # Stop
fvr delete my-app     # Remove from FVR
```

## ⚙️ Configuration

### Config File

FVR looks for configuration in the following files (in order):
- `fvr.config.js`
- `fvr.config.cjs`
- `.fvrrc.js`

### Configuration Options

```javascript
module.exports = {
  apps: [
    {
      // Required fields
      name: 'my-app',              // Unique app name
      script: 'server.js',         // Entry point script

      // Process execution
      exec_mode: 'cluster',        // 'fork' | 'cluster' (default: 'fork')
      instances: 2,                // Number of instances (cluster mode only)
      args: '--port 3000',         // Arguments (string or array)

      // Auto-restart
      autorestart: true,           // Auto-restart on crash (default: true)
      max_memory_restart: '300M',  // Restart on memory limit (e.g., '200M', '1G')

      // Development
      watch: true,                 // Watch files and auto-restart (default: false)

      // Environment
      env: {                       // Environment variables
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
```

### Configuration Fields Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | ✅ | — | Unique identifier for the app |
| `script` | string | ✅ | — | Path to the entry script |
| `args` | string or array | ❌ | `[]` | CLI arguments passed to script |
| `exec_mode` | `'fork'` or `'cluster'` | ❌ | `'fork'` | Execution mode |
| `instances` | number | ❌ | `1` | Number of workers (cluster mode only) |
| `watch` | boolean | ❌ | `false` | Auto-restart on file changes |
| `max_memory_restart` | string | ❌ | `null` | Memory limit (e.g., `'200M'`, `'1G'`) |
| `autorestart` | boolean | ❌ | `true` | Auto-restart on crash |
| `env` | object or array | ❌ | `{}` | Environment variables |

### Multiple Environments

You can define multiple environment configurations:

```javascript
env: [
  { NODE_ENV: 'development', PORT: 3000 },
  { NODE_ENV: 'production',  PORT: 8080 }
]
```

FVR uses the first environment by default.

## 🎮 CLI Commands

### `fvr start [config]`

Start apps defined in config file.

```bash
fvr start                   # Use fvr.config.js in current directory
fvr start fvr.config.js     # Use specific config file
fvr start my-app            # Restart specific app by name
```

### `fvr stop <name>`

Stop a running app.

```bash
fvr stop my-app      # Stop specific app
fvr stop all         # Stop all apps
```

### `fvr restart <name>`

Restart a running app.

```bash
fvr restart my-app   # Restart specific app
fvr restart all      # Restart all apps
```

### `fvr delete <name>`

Stop and remove an app from FVR state.

```bash
fvr delete my-app    # Delete specific app
fvr delete all       # Delete all apps
```

### `fvr list`

Display a table of all managed apps and their status.

```bash
fvr list             # or: fvr ls
```

**Example output:**

```
┌────┬──────────┬──────────┬──────────┬──────────────┬────────────┬──────────┐
│ id │ name     │ mode     │ pid      │ instances    │ status     │ memory   │
├────┼──────────┼──────────┼──────────┼──────────────┼────────────┼──────────┤
│ 0  │ my-app   │ cluster  │ 12345    │ 2/2          │ online     │ 45.2 MB  │
│ 1  │ worker   │ fork     │ 12399    │ 1/1          │ online     │ 22.1 MB  │
└────┴──────────┴──────────┴──────────┴──────────────┴────────────┴──────────┘

Total: 2 app(s) | 2 online | 0 stopped
```

### `fvr logs <name>`

Stream logs for an app.

```bash
fvr logs my-app              # Stream stdout + stderr
fvr logs my-app --lines 100  # Show last 100 lines
fvr logs my-app --err        # Show only stderr
fvr logs my-app --out        # Show only stdout
```

**Logs are stored at:** `~/.fvr/logs/<name>-out.log` and `~/.fvr/logs/<name>-err.log`

## 📚 Examples

### Simple Fork Mode App

```javascript
module.exports = {
  apps: [{
    name: 'api',
    script: 'server.js',
    env: { PORT: 3000 }
  }]
};
```

### Cluster Mode with Auto-Restart

```javascript
module.exports = {
  apps: [{
    name: 'web-app',
    script: 'index.js',
    exec_mode: 'cluster',
    instances: 4,
    autorestart: true,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    }
  }]
};
```

### Development Mode with Watch

```javascript
module.exports = {
  apps: [{
    name: 'dev-server',
    script: 'app.js',
    watch: true,
    env: {
      NODE_ENV: 'development',
      DEBUG: 'app:*'
    }
  }]
};
```

### Multiple Apps

```javascript
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'api/server.js',
      exec_mode: 'cluster',
      instances: 2,
      env: { PORT: 3000 }
    },
    {
      name: 'worker',
      script: 'workers/queue.js',
      env: { REDIS_URL: 'redis://localhost:6379' }
    },
    {
      name: 'cron',
      script: 'tasks/scheduler.js',
      autorestart: false
    }
  ]
};
```

## 🔧 How It Works

### Daemon Architecture

FVR runs a persistent daemon process that:
- Manages all child processes (fork/cluster)
- Monitors memory usage every 5 seconds
- Handles auto-restart with crash loop detection
- Watches files for changes (when enabled)
- Pipes logs to `~/.fvr/logs/`

### State Persistence

FVR stores process metadata in `~/.fvr/state.json`:
- App configurations
- Process IDs (PIDs)
- Restart counts and history
- Current status

### IPC Communication

CLI commands communicate with the daemon via Unix domain socket (`~/.fvr/daemon.sock`).

## 🆚 FVR vs PM2

| Feature | FVR | PM2 |
|---------|-----|-----|
| **Size** | ~65 dependencies | 200+ dependencies |
| **Complexity** | Single config file | Multiple config formats, ecosystem |
| **Startup Time** | Fast (<100ms) | Slower |
| **Memory Footprint** | Minimal (~20MB) | Higher (~50-100MB) |
| **Features** | Core essentials | Kitchen sink (metrics, deploy, modules) |
| **Learning Curve** | Minutes | Hours |
| **Best For** | Production servers, VPS, containers | Large teams, full DevOps pipeline |

**Use FVR if you want:**
- ✅ Simple, reliable process management
- ✅ Minimal resource overhead
- ✅ Easy configuration
- ✅ No unnecessary features

**Use PM2 if you need:**
- ❌ Built-in monitoring dashboard
- ❌ Deploy automation
- ❌ Module ecosystem
- ❌ Startup scripts (systemd integration)

## 📂 Project Structure

```
~/.fvr/
├── state.json           # Process state persistence
├── daemon.sock          # IPC socket
└── logs/
    ├── app-out.log      # Stdout logs
    └── app-err.log      # Stderr logs
```

## 🐛 Troubleshooting

### Daemon not starting?

```bash
# Check if daemon is running
ps aux | grep fvr

# Check logs (if any)
ls -la ~/.fvr/
```

### App not starting?

- Verify script path exists: `ls -la path/to/script.js`
- Check config syntax: `node -c fvr.config.js`
- View logs: `fvr logs <app-name>`

### Permission issues?

```bash
# Ensure FVR home directory has correct permissions
chmod 755 ~/.fvr/
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

### Development Setup

```bash
# Clone the repository
git clone https://github.com/vinitkumargoel/fvr.git
cd fvr

# Install dependencies
npm install

# Link for local development
npm link

# Run tests
npm test
```

### Code Style

- Use 2 spaces for indentation
- Follow existing code patterns
- Add comments for complex logic
- Write tests for new features

### Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

### Reporting Issues

When reporting bugs, please include:
- FVR version (`fvr --version`)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Error messages and logs

## 📄 License

MIT © Vinit Kumar Goel

## 🙏 Acknowledgments

- Inspired by [PM2](https://pm2.keymetrics.io/)
- Built with Node.js and ❤️

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/vinitkumargoel/fvr/issues)
- **Discussions**: [GitHub Discussions](https://github.com/vinitkumargoel/fvr/discussions)

---

**Made with ❤️ for developers who value simplicity**
