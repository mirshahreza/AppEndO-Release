type PasswordCredentialInit = {
  id: string;
  password: string;
  name?: string;
};

type PasswordCredentialCtor = new (data: PasswordCredentialInit) => Credential;

const getPasswordCredentialCtor = (): PasswordCredentialCtor | undefined => {
  const ctor = (globalThis as typeof globalThis & { PasswordCredential?: PasswordCredentialCtor }).PasswordCredential;
  return typeof ctor === 'function' ? ctor : undefined;
};

/**
 * Ask Chromium browsers to save sign-in credentials after a successful SPA login.
 * Firefox/Safari rely on the login form's method=post + autocomplete tokens instead.
 * Never writes the password to localStorage / sessionStorage.
 */
export const storeBrowserLoginCredentials = async (
  username: string,
  password: string,
): Promise<void> => {
  const id = username.trim();
  if (!id || !password) {
    return;
  }

  const PasswordCredential = getPasswordCredentialCtor();
  const credentials = typeof navigator === 'undefined' ? undefined : navigator.credentials;
  if (!PasswordCredential || typeof credentials?.store !== 'function') {
    return;
  }

  try {
    await credentials.store(new PasswordCredential({
      id,
      password,
      name: id,
    }));
  } catch {
    // Operator declined, insecure context, or browser policy — native form save may still run.
  }
};
