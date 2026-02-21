const { describe, it, expect } = require('vitest');
const {
  FVRError,
  ConfigError,
  StateError,
  DaemonError,
  ProcessError,
  formatError,
  formatInfo,
  validateRequiredFields
} = require('../../lib/utils/errors');

describe('utils/errors.js', () => {
  describe('Custom Error Classes', () => {
    it('should create FVRError with message and code', () => {
      const error = new FVRError('Test error', 'TEST_CODE');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('FVRError');
    });

    it('should create ConfigError', () => {
      const error = new ConfigError('Config error');
      expect(error).toBeInstanceOf(FVRError);
      expect(error.name).toBe('ConfigError');
      expect(error.code).toBe('CONFIG_ERROR');
    });

    it('should create StateError', () => {
      const error = new StateError('State error');
      expect(error).toBeInstanceOf(FVRError);
      expect(error.name).toBe('StateError');
      expect(error.code).toBe('STATE_ERROR');
    });

    it('should create DaemonError', () => {
      const error = new DaemonError('Daemon error');
      expect(error).toBeInstanceOf(FVRError);
      expect(error.name).toBe('DaemonError');
      expect(error.code).toBe('DAEMON_ERROR');
    });

    it('should create ProcessError', () => {
      const error = new ProcessError('Process error');
      expect(error).toBeInstanceOf(FVRError);
      expect(error.name).toBe('ProcessError');
      expect(error.code).toBe('PROCESS_ERROR');
    });
  });

  describe('Message Formatting', () => {
    it('should format error messages', () => {
      const formatted = formatError('Something went wrong');
      expect(formatted).toBe('[FVR ERROR] Something went wrong');
    });

    it('should format info messages', () => {
      const formatted = formatInfo('Starting daemon');
      expect(formatted).toBe('[FVR] Starting daemon');
    });
  });

  describe('Validation', () => {
    it('should validate required fields', () => {
      const obj = { name: 'test', script: 'app.js' };
      expect(() => {
        validateRequiredFields(obj, ['name', 'script'], 'config');
      }).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const obj = { name: 'test' };
      expect(() => {
        validateRequiredFields(obj, ['name', 'script'], 'config');
      }).toThrow(ConfigError);
    });

    it('should list all missing fields', () => {
      const obj = {};
      try {
        validateRequiredFields(obj, ['name', 'script'], 'config');
      } catch (error) {
        expect(error.message).toContain('name');
        expect(error.message).toContain('script');
      }
    });
  });
});
