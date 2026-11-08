import { describe, expect, it } from 'vitest';
import { buildSshHubClientConnectAuth, decodeSshHubWsMessage } from '../sshHubSession';

describe('decodeSshHubWsMessage', () => {
  it('reads strings, buffers, and fragmented buffer arrays', () => {
    expect(decodeSshHubWsMessage('{"type":"authenticate"}')).toBe('{"type":"authenticate"}');
    expect(decodeSshHubWsMessage(Buffer.from('{"type":"resize"}'))).toBe('{"type":"resize"}');
    expect(decodeSshHubWsMessage([Buffer.from('{"type":"'), Buffer.from('authenticate"}')])).toBe(
      '{"type":"authenticate"}',
    );
  });
});

describe('buildSshHubClientConnectAuth', () => {
  it('uses password auth without keyboard-interactive, matching File Hub SFTP', () => {
    expect(buildSshHubClientConnectAuth({
      authMethod: 'password',
      password: 'secret',
    })).toEqual({
      password: 'secret',
    });
  });

  it('does not enable keyboard-interactive for private keys', () => {
    expect(buildSshHubClientConnectAuth({
      authMethod: 'privateKey',
      privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
      passphrase: 'phrase',
    })).toEqual({
      privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
      passphrase: 'phrase',
    });
  });
});
