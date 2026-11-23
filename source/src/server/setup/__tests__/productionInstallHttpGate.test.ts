import { describe, expect, it } from 'vitest';
import { productionHttpInstallBlocked } from '../productionInstallHttpGate';

describe('productionHttpInstallBlocked', () => {
  it('leaves the wizard open outside production', () => {
    expect(productionHttpInstallBlocked('development', {})).toBe(false);
    expect(productionHttpInstallBlocked('test', {})).toBe(false);
  });

  it('blocks production HTTP install unless an explicit unlock is set', () => {
    expect(productionHttpInstallBlocked('production', {})).toBe(true);
    expect(productionHttpInstallBlocked('production', { APPENDO_ALLOW_HTTP_INSTALL: '1' })).toBe(false);
    expect(productionHttpInstallBlocked('production', { APPENDO_LOCAL_PROD_PUBLISH: '1' })).toBe(false);
  });
});
