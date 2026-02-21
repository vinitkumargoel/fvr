// FVR Example Configuration
// This file demonstrates all available configuration options

module.exports = {
  apps: [
    // Example 1: Simple fork mode app
    {
      name: 'simple-app',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },

    // Example 2: Cluster mode with multiple instances
    {
      name: 'cluster-app',
      script: 'app.js',
      exec_mode: 'cluster',    // Use Node.js cluster module
      instances: 4,             // Number of worker processes
      autorestart: true,        // Auto-restart on crash
      max_memory_restart: '500M', // Restart if memory exceeds 500MB
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      }
    },

    // Example 3: Development mode with file watching
    {
      name: 'dev-server',
      script: 'dev.js',
      watch: true,              // Watch for file changes and auto-restart
      args: '--verbose',        // Command-line arguments (string or array)
      env: {
        NODE_ENV: 'development',
        DEBUG: '*'
      }
    },

    // Example 4: Background worker with custom args
    {
      name: 'worker',
      script: 'worker.js',
      args: ['--queue', 'emails', '--concurrency', '5'], // Array of arguments
      autorestart: true,
      max_memory_restart: '1G', // 1 gigabyte memory limit
      env: {
        REDIS_URL: 'redis://localhost:6379',
        WORKER_TIMEOUT: '30000'
      }
    },

    // Example 5: Cron job (no auto-restart)
    {
      name: 'cron-job',
      script: 'tasks/daily.js',
      autorestart: false,       // Don't restart when job completes
      env: {
        NODE_ENV: 'production'
      }
    },

    // Example 6: Multiple environment configurations
    {
      name: 'multi-env-app',
      script: 'server.js',
      env: [
        // FVR uses the first environment by default
        {
          NODE_ENV: 'development',
          PORT: 3000,
          DB_HOST: 'localhost'
        },
        {
          NODE_ENV: 'production',
          PORT: 8080,
          DB_HOST: 'prod-db.example.com'
        }
      ]
    },

    // Example 7: Full configuration with all options
    {
      name: 'full-example',
      script: './src/index.js',
      cwd: '/path/to/app',      // Working directory (optional)
      exec_mode: 'cluster',
      instances: 2,
      watch: false,
      autorestart: true,
      max_memory_restart: '300M',
      args: '--port 4000 --host 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        HOST: '0.0.0.0',
        API_KEY: 'your-api-key-here',
        LOG_LEVEL: 'info'
      }
    }
  ]
};

// Notes:
// 1. All paths (script, cwd) can be relative or absolute
// 2. Relative paths are resolved from the config file location
// 3. Each app must have a unique name
// 4. exec_mode defaults to 'fork' if not specified
// 5. instances only applies in cluster mode
// 6. Watch mode is best for development, disable in production
// 7. Memory limits: use 'M' for megabytes, 'G' for gigabytes
// 8. Arguments can be a string or array of strings
