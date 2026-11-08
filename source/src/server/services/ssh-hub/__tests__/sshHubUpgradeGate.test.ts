import type { Duplex, IncomingMessage } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../remote-hubs/remoteHubsRuntime', () => ({
  isRemoteHubsRuntimeEnabled: () => false,
}));

import { handleSshHubUpgrade, SSH_HUB_SESSION_PATH } from '../sshHubSession';

describe('SSH Hub upgrade gate', () => {
  it('rejects SSH session upgrades when Remote Hubs is not installed', () => {
    const writes: string[] = [];
    const socket = {
      write: (chunk: string) => {
        writes.push(chunk);
      },
      destroy: () => undefined,
    };
    const handled = handleSshHubUpgrade(
      { url: SSH_HUB_SESSION_PATH } as IncomingMessage,
      socket as unknown as Duplex,
      Buffer.alloc(0),
    );
    expect(handled).toBe(true);
    expect(writes[0]).toContain('404');
  });

  it('ignores upgrades for other paths', () => {
    const handled = handleSshHubUpgrade(
      { url: '/api/other' } as IncomingMessage,
      { write: () => undefined, destroy: () => undefined } as unknown as Duplex,
      Buffer.alloc(0),
    );
    expect(handled).toBe(false);
  });
});
