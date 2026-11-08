import { describe, expect, it, beforeEach } from 'vitest';
import { LogLevel, logger } from '../../../core/logging/Logger';
import {
  buildDefaultMethodConfigsFromRoutes,
  applyBootstrapMethodLogConfigs,
} from '../methodLogConfig';

describe('buildDefaultMethodConfigsFromRoutes', () => {
  it('disables logging for logs API routes by default', () => {
    const configs = buildDefaultMethodConfigsFromRoutes([
      { method: 'GET', path: '/api/logs' },
      { method: 'GET', path: '/api/logs/:id' },
      { method: 'GET', path: '/api/data-sources' },
    ]);

    expect(configs['HTTP GET /api/logs']?.enabled).toBe(false);
    expect(configs['HTTP GET /api/logs/:id']?.enabled).toBe(false);
    expect(configs['HTTP GET /api/data-sources']?.enabled).toBe(true);
  });
});

describe('applyBootstrapMethodLogConfigs', () => {
  beforeEach(() => {
    logger.setDefaultMethodLoggingEnabled(true);
    logger.setMethodConfigs({});
  });

  it('registers route defaults and applies saved overrides', () => {
    applyBootstrapMethodLogConfigs(
      [{ method: 'GET', path: '/api/logs' }],
      { 'HTTP GET /api/logs': { enabled: true, minLevel: LogLevel.INFO } },
    );

    expect(logger.getMethodConfigRaw('HTTP GET /api/logs').enabled).toBe(true);
  });
});
