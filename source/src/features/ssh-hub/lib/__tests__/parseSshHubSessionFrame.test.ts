import { describe, expect, it } from 'vitest';
import { parseSshHubSessionControl } from '../parseSshHubSessionFrame';

describe('parseSshHubSessionControl', () => {
  it('reads JSON control frames from text and binary payloads', () => {
    expect(parseSshHubSessionControl('{"type":"ready"}')).toEqual({ type: 'ready', message: undefined });
    expect(parseSshHubSessionControl('{"type":"error","message":"denied"}')).toEqual({
      type: 'error',
      message: 'denied',
    });
    expect(parseSshHubSessionControl(new TextEncoder().encode('{"type":"exit"}'))).toEqual({
      type: 'exit',
      message: undefined,
    });
  });

  it('ignores terminal bytes and invalid JSON', () => {
    expect(parseSshHubSessionControl('ls -la')).toBeNull();
    expect(parseSshHubSessionControl('{not-json')).toBeNull();
    expect(parseSshHubSessionControl(new Uint8Array([0, 1, 2]).buffer)).toBeNull();
  });
});
