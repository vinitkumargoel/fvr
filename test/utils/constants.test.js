const { describe, it, expect } = require('vitest');
const constants = require('../../lib/utils/constants');

describe('utils/constants.js', () => {
  it('should export FVR_HOME path', () => {
    expect(constants.FVR_HOME).toBeDefined();
    expect(typeof constants.FVR_HOME).toBe('string');
    expect(constants.FVR_HOME).toContain('.fvr');
  });

  it('should export STATE_FILE path', () => {
    expect(constants.STATE_FILE).toBeDefined();
    expect(constants.STATE_FILE).toContain('state.json');
  });

  it('should export LOGS_DIR path', () => {
    expect(constants.LOGS_DIR).toBeDefined();
    expect(constants.LOGS_DIR).toContain('logs');
  });

  it('should export CONFIG_FILES array', () => {
    expect(constants.CONFIG_FILES).toBeInstanceOf(Array);
    expect(constants.CONFIG_FILES).toContain('fvr.config.js');
  });

  it('should export DEFAULTS object', () => {
    expect(constants.DEFAULTS).toBeDefined();
    expect(constants.DEFAULTS.exec_mode).toBe('fork');
    expect(constants.DEFAULTS.instances).toBe(1);
    expect(constants.DEFAULTS.autorestart).toBe(true);
  });

  it('should export TIMEOUTS object', () => {
    expect(constants.TIMEOUTS).toBeDefined();
    expect(constants.TIMEOUTS.gracefulShutdown).toBe(5000);
    expect(constants.TIMEOUTS.restartDelay).toBe(1000);
  });

  it('should export APP_STATUS enum', () => {
    expect(constants.APP_STATUS).toBeDefined();
    expect(constants.APP_STATUS.ONLINE).toBe('online');
    expect(constants.APP_STATUS.STOPPED).toBe('stopped');
    expect(constants.APP_STATUS.ERRORED).toBe('errored');
  });

  it('should export EXEC_MODES enum', () => {
    expect(constants.EXEC_MODES).toBeDefined();
    expect(constants.EXEC_MODES.FORK).toBe('fork');
    expect(constants.EXEC_MODES.CLUSTER).toBe('cluster');
  });
});
