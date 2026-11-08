import { afterEach, describe, expect, it, vi } from 'vitest';
import { storeBrowserLoginCredentials } from '../storeBrowserLoginCredentials';

describe('storeBrowserLoginCredentials', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores a PasswordCredential when the browser API is available', async () => {
    const store = vi.fn(async () => undefined);
    class PasswordCredential {
      id: string;
      password: string;
      name?: string;
      constructor(data: { id: string; password: string; name?: string }) {
        this.id = data.id;
        this.password = data.password;
        this.name = data.name;
      }
    }

    vi.stubGlobal('PasswordCredential', PasswordCredential);
    vi.stubGlobal('navigator', { credentials: { store } });

    await storeBrowserLoginCredentials('  admin  ', 'secret');

    expect(store).toHaveBeenCalledTimes(1);
    const [credential] = store.mock.calls[0] ?? [];
    expect(credential).toMatchObject({ id: 'admin', password: 'secret', name: 'admin' });
  });

  it('skips empty credentials and missing browser APIs', async () => {
    const store = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { credentials: { store } });

    await storeBrowserLoginCredentials('', 'secret');
    await storeBrowserLoginCredentials('admin', '');

    expect(store).not.toHaveBeenCalled();
  });
});
