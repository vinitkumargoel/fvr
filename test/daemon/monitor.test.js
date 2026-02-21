const { describe, it, expect } = require('vitest');
const { parseMemoryLimit, checkCrashLoop, recordRestart } = require('../../lib/daemon/monitor');

describe('daemon/monitor.js', () => {
  describe('parseMemoryLimit', () => {
    it('should parse megabytes correctly', () => {
      expect(parseMemoryLimit('200M')).toBe(200 * 1024 * 1024);
      expect(parseMemoryLimit('500M')).toBe(500 * 1024 * 1024);
      expect(parseMemoryLimit('1M')).toBe(1024 * 1024);
    });

    it('should parse gigabytes correctly', () => {
      expect(parseMemoryLimit('1G')).toBe(1 * 1024 * 1024 * 1024);
      expect(parseMemoryLimit('2G')).toBe(2 * 1024 * 1024 * 1024);
    });

    it('should return null for invalid formats', () => {
      expect(parseMemoryLimit('invalid')).toBeNull();
      expect(parseMemoryLimit('200')).toBeNull();
      expect(parseMemoryLimit('M')).toBeNull();
      expect(parseMemoryLimit('')).toBeNull();
      expect(parseMemoryLimit(null)).toBeNull();
    });

    it('should handle edge cases', () => {
      expect(parseMemoryLimit('0M')).toBe(0);
      expect(parseMemoryLimit('1000G')).toBe(1000 * 1024 * 1024 * 1024);
    });
  });

  describe('checkCrashLoop', () => {
    it('should return false for apps with no restart history', () => {
      const app = { restart_history: [] };
      expect(checkCrashLoop(app)).toBe(false);
    });

    it('should return false for apps with few restarts', () => {
      const app = {
        restart_history: [
          new Date().toISOString(),
          new Date().toISOString()
        ]
      };
      expect(checkCrashLoop(app)).toBe(false);
    });

    it('should return true for crash loop (5 restarts in 60s)', () => {
      const now = Date.now();
      const app = {
        restart_history: [
          new Date(now - 50000).toISOString(), // 50s ago
          new Date(now - 40000).toISOString(), // 40s ago
          new Date(now - 30000).toISOString(), // 30s ago
          new Date(now - 20000).toISOString(), // 20s ago
          new Date(now - 10000).toISOString()  // 10s ago
        ]
      };
      expect(checkCrashLoop(app)).toBe(true);
    });

    it('should return false if restarts are spread over time', () => {
      const now = Date.now();
      const app = {
        restart_history: [
          new Date(now - 300000).toISOString(), // 5 min ago
          new Date(now - 200000).toISOString(), // 3.3 min ago
          new Date(now - 100000).toISOString(), // 1.6 min ago
          new Date(now - 50000).toISOString(),  // 50s ago
          new Date(now - 10000).toISOString()   // 10s ago
        ]
      };
      expect(checkCrashLoop(app)).toBe(false);
    });
  });

  describe('recordRestart', () => {
    it('should increment restart count', () => {
      const app = { restart_count: 0, restart_history: [] };
      const updated = recordRestart(app);
      expect(updated.restart_count).toBe(1);
    });

    it('should add timestamp to restart history', () => {
      const app = { restart_count: 0, restart_history: [] };
      const updated = recordRestart(app);
      expect(updated.restart_history.length).toBe(1);
      expect(updated.restart_history[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    });

    it('should keep only last 10 restarts', () => {
      const app = {
        restart_count: 10,
        restart_history: new Array(10).fill(new Date().toISOString())
      };
      const updated = recordRestart(app);
      expect(updated.restart_history.length).toBe(10);
      expect(updated.restart_count).toBe(11);
    });
  });
});
