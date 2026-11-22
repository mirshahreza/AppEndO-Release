import { afterEach, describe, expect, it } from 'vitest';
import {
  collectStrictDevLinePorts,
  isOperatorDevPortStrict,
  OPERATOR_DEV_API_PORTS,
  portsForOperatorDevApi,
} from '../operatorDevPortPolicy';

describe('operatorDevPortPolicy', () => {
  afterEach(() => {
    delete process.env.APPENDO_DEV_PORT_STRICT;
  });

  it('defines fixed slots per deploy line', () => {
    expect(OPERATOR_DEV_API_PORTS.monorepo).toBe(3000);
    expect(OPERATOR_DEV_API_PORTS.releaseOss).toBe(3100);
    expect(OPERATOR_DEV_API_PORTS.portalx).toBe(3200);
  });

  it('maps api port to hmr and vite child offsets', () => {
    expect(portsForOperatorDevApi(3200)).toEqual({
      api: 3200,
      hmr: 3300,
      viteChild: 3400,
    });
  });

  it('strict mode is on by default', () => {
    expect(isOperatorDevPortStrict()).toBe(true);
    process.env.APPENDO_DEV_PORT_STRICT = '0';
    expect(isOperatorDevPortStrict()).toBe(false);
  });

  it('collects only the three ports for one line', () => {
    expect(collectStrictDevLinePorts(3100)).toEqual([3100, 3200, 3300]);
  });
});
