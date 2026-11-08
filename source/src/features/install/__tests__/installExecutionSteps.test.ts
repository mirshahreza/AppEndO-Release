import { describe, expect, it } from 'vitest';
import type { InstallStatusResponse } from '../../../shared/api/contracts/install/types';
import { resolveInstallExecutionSkipFlags } from '../installExecutionSteps';

const baseStatus = (): InstallStatusResponse => ({
  success: true,
  apiVersion: 2,
  install: {
    pending: true,
    completed: false,
  },
});

describe('resolveInstallExecutionSkipFlags', () => {
  it('skips database and schema when the control plane is already initialized', () => {
    const skip = resolveInstallExecutionSkipFlags({
      ...baseStatus(),
      install: {
        pending: true,
        completed: false,
        capabilities: ['service'],
        nodeName: 'all-in-one',
        databaseInitialized: true,
      },
    });

    expect(skip.capabilities).toBe(true);
    expect(skip.database).toBe(true);
    expect(skip.schema).toBe(true);
    expect(skip.cache).toBe(false);
    expect(skip.admin).toBe(false);
  });

  it('skips email when outbound mail is already configured', () => {
    const skip = resolveInstallExecutionSkipFlags({
      ...baseStatus(),
      install: {
        pending: true,
        completed: false,
        emailConfigured: true,
      },
      defaultCache: { driver: 'memory' },
    });

    expect(skip.cache).toBe(true);
    expect(skip.email).toBe(true);
  });
});
