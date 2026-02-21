# Contributing to FVR

Thank you for your interest in contributing to FVR! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn
- Linux or macOS (for development)

### Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/vinitkumargoel/forv.git
cd forv
```

2. **Install dependencies**

```bash
npm install
```

3. **Link for local development**

```bash
npm link
```

Now you can use the `forv` command globally, and it will use your local development version.

4. **Run tests**

```bash
npm test
```

## 📝 Development Guidelines

### Code Style

- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Required
- **Quotes**: Single quotes for strings
- **Line length**: Max 100 characters (soft limit)
- **Comments**: Use comments for complex logic, but prefer self-documenting code

### Project Structure

```
fvr/
├── bin/
│   └── fvr.js              # CLI entry point
├── lib/
│   ├── daemon/             # Daemon and monitoring
│   │   ├── daemon.js
│   │   ├── ipc.js
│   │   └── monitor.js
│   ├── commands/           # CLI command handlers
│   │   ├── start.js
│   │   ├── stop.js
│   │   ├── restart.js
│   │   ├── delete.js
│   │   ├── list.js
│   │   └── logs.js
│   ├── core/               # Core functionality
│   │   ├── state.js
│   │   ├── config.js
│   │   ├── process-manager.js
│   │   └── logger.js
│   └── utils/              # Shared utilities
│       ├── constants.js
│       └── errors.js
├── test/                   # Tests
├── examples/               # Example configs
└── README.md
```

### Coding Conventions

1. **Error Handling**
   - Use custom error classes from `lib/utils/errors.js`
   - Always provide meaningful error messages
   - Use `exitWithError()` for CLI commands

2. **Async/Await**
   - Prefer async/await over callbacks
   - Always handle promise rejections

3. **Module Exports**
   - Use CommonJS (`module.exports`)
   - Export functions individually for testability

4. **Logging**
   - Use `console.log` for user-facing messages
   - Use `console.error` for errors
   - Prefix logs with `[FVR]` or `[FVR ERROR]`

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Place tests in the `test/` directory, mirroring the `lib/` structure
- Use descriptive test names
- Test both success and error cases
- Mock external dependencies (file system, child processes)

Example test structure:

```javascript
const { describe, it, expect } = require('vitest');
const { loadConfig } = require('../lib/core/config');

describe('config.js', () => {
  describe('loadConfig', () => {
    it('should load a valid config file', () => {
      const config = loadConfig('./examples/forv.config.js');
      expect(config).toBeDefined();
      expect(config.apps).toBeInstanceOf(Array);
    });

    it('should throw error for missing config', () => {
      expect(() => loadConfig('./nonexistent.js')).toThrow();
    });
  });
});
```

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. **FVR version**: `fvr --version`
2. **Node.js version**: `node --version`
3. **Operating system**: e.g., "Ubuntu 22.04", "macOS 14.0"
4. **Steps to reproduce**:
   - What commands did you run?
   - What config file did you use?
5. **Expected behavior**: What should have happened?
6. **Actual behavior**: What actually happened?
7. **Error messages**: Full error output, including stack traces
8. **Logs**: Contents of `~/.fvr/logs/` if applicable

## ✨ Suggesting Features

We welcome feature suggestions! Please open an issue with:

1. **Clear description**: What feature would you like to see?
2. **Use case**: Why is this feature needed?
3. **Proposed solution**: How should it work?
4. **Alternatives**: Any alternative approaches you've considered?

## 📬 Submitting Changes

### Pull Request Process

1. **Create a feature branch**

```bash
git checkout -b feature/my-feature
```

2. **Make your changes**
   - Write clear, concise commit messages
   - Follow the code style guidelines
   - Add tests for new features
   - Update documentation if needed

3. **Test your changes**

```bash
npm test
```

4. **Commit your changes**

```bash
git add .
git commit -m "feat: add new feature"
```

Use conventional commit messages:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions or changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

5. **Push to your fork**

```bash
git push origin feature/my-feature
```

6. **Open a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your feature branch
   - Fill out the PR template
   - Wait for review

### PR Guidelines

- **One feature per PR**: Keep PRs focused and manageable
- **Description**: Clearly describe what your PR does
- **Tests**: Include tests for new functionality
- **Documentation**: Update README if adding user-facing features
- **No breaking changes**: Unless absolutely necessary and discussed first
- **Clean history**: Squash commits if needed

## 🎯 Good First Issues

Looking for somewhere to start? Check out issues labeled:
- `good first issue` - Easy to tackle, great for newcomers
- `help wanted` - We'd love your help on these
- `documentation` - Improve our docs

## 💬 Questions?

- **GitHub Discussions**: Ask questions, share ideas
- **Issues**: For bug reports and feature requests

## 📜 Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards others

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling, insulting, or personal attacks
- Publishing others' private information
- Any conduct that could reasonably be considered inappropriate

## 🏆 Recognition

Contributors will be:
- Added to the contributors list
- Mentioned in release notes for significant contributions
- Credited in the project README

## 📄 License

By contributing to FVR, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to FVR! 🎉
