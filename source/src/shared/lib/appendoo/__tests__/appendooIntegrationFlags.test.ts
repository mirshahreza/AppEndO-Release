import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('appendooIntegrationFlags live rollout', () => {
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    envBackup.VITEST = process.env.VITEST;
    envBackup.NODE_ENV = process.env.NODE_ENV;
    envBackup.APPENDOO_TEST_MODE = process.env.APPENDOO_TEST_MODE;
    envBackup.APPENDOO_LIVE_RUNTIME_ACTIVATION = process.env.APPENDOO_LIVE_RUNTIME_ACTIVATION;
    envBackup.APPENDOO_DISABLE_LIVE_PIPELINE = process.env.APPENDOO_DISABLE_LIVE_PIPELINE;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.VITEST = envBackup.VITEST;
    process.env.NODE_ENV = envBackup.NODE_ENV;
    process.env.APPENDOO_TEST_MODE = envBackup.APPENDOO_TEST_MODE;
    process.env.APPENDOO_LIVE_RUNTIME_ACTIVATION = envBackup.APPENDOO_LIVE_RUNTIME_ACTIVATION;
    process.env.APPENDOO_DISABLE_LIVE_PIPELINE = envBackup.APPENDOO_DISABLE_LIVE_PIPELINE;
    vi.resetModules();
  });

  it('defaults live runtime on in vitest under cutover', async () => {
    process.env.VITEST = 'true';
    delete process.env.APPENDOO_LIVE_RUNTIME_ACTIVATION;
    delete process.env.APPENDOO_DISABLE_LIVE_PIPELINE;

    const { isLiveRuntimeActivationEnabled } = await import('../appendooIntegrationFlags');
    expect(isLiveRuntimeActivationEnabled()).toBe(true);
  });

  it('honors explicit live runtime opt-out during vitest', async () => {
    process.env.VITEST = 'true';
    process.env.APPENDOO_LIVE_RUNTIME_ACTIVATION = '0';

    const { isLiveRuntimeActivationEnabled } = await import('../appendooIntegrationFlags');
    expect(isLiveRuntimeActivationEnabled()).toBe(false);
  });

  it('defaults live runtime on outside test when cutover is active', async () => {
    delete process.env.VITEST;
    process.env.NODE_ENV = 'development';
    delete process.env.APPENDOO_LIVE_RUNTIME_ACTIVATION;
    delete process.env.APPENDOO_DISABLE_LIVE_PIPELINE;

    const { isLiveRuntimeActivationEnabled } = await import('../appendooIntegrationFlags');
    expect(isLiveRuntimeActivationEnabled()).toBe(true);
  });

  it('respects master live pipeline kill switch', async () => {
    delete process.env.VITEST;
    process.env.NODE_ENV = 'development';
    process.env.APPENDOO_DISABLE_LIVE_PIPELINE = '1';

    const { isLiveRuntimeActivationEnabled } = await import('../appendooIntegrationFlags');
    expect(isLiveRuntimeActivationEnabled()).toBe(false);
  });

  it('probes live runtime activation depth under cutover', async () => {
    process.env.VITEST = 'true';
    delete process.env.APPENDOO_LIVE_RUNTIME_ACTIVATION;
    delete process.env.APPENDOO_LIVE_DESIGNER_PUBLISH;

    const { probeLiveRuntimeActivationDepth } = await import('../appendooIntegrationFlags');
    expect(probeLiveRuntimeActivationDepth().ok).toBe(true);
  });
});
