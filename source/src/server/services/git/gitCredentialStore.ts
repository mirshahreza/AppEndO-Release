import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { REDACTED_GIT_TOKEN } from '../../../shared/api/contracts/git/constants';
import type { GitAuthSettings } from '../../../shared/api/contracts/git/types';
import { normalizeGitAuthSettings } from '../../../shared/api/contracts/git/validators';
import { resolveGitToken } from './gitConnection';
import {
  LEGACY_GIT_SECRET_ERROR,
  deleteGitCredentialToken,
  getGitCredentialToken,
  isLegacyGitTokenField,
  setGitCredentialToken,
} from './gitCredentialVault';

const execFileAsync = promisify(execFile);

const CREDENTIAL_FILE_NAME = '.appendo-git-credentials.json';

const resolveCredentialPath = (): string => (
  path.join(process.cwd(), CREDENTIAL_FILE_NAME)
);

type GitCredentialsFile = Omit<GitAuthSettings, 'token'> & {
  hasToken?: boolean;
  token?: unknown;
};

const incomingToken = (auth: GitAuthSettings): string => {
  const trimmed = auth.token?.trim() ?? '';
  if (!trimmed || trimmed === REDACTED_GIT_TOKEN) {
    return '';
  }
  return trimmed;
};

const assertNoLegacyTokenField = (raw: GitCredentialsFile): void => {
  if (isLegacyGitTokenField(raw.token)) {
    throw new Error(LEGACY_GIT_SECRET_ERROR);
  }
};

const readCredentialFile = (): GitCredentialsFile | null => {
  const filePath = resolveCredentialPath();
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const raw = parsed as GitCredentialsFile;
    assertNoLegacyTokenField(raw);
    const { token: _token, ...rest } = raw;
    return { ...rest, hasToken: Boolean(raw.hasToken) };
  } catch (error) {
    if (error instanceof Error && error.message === LEGACY_GIT_SECRET_ERROR) {
      throw error;
    }
    return null;
  }
};

const persistCredentialFile = (auth: GitAuthSettings, hasToken: boolean): void => {
  const { token: _token, ...rest } = auth;
  const filePath = resolveCredentialPath();
  const record: GitCredentialsFile = {
    ...rest,
    hasToken,
  };
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
};

const approveHttpsCredential = async (auth: GitAuthSettings): Promise<void> => {
  if (auth.kind !== 'https_pat') {
    return;
  }

  const token = resolveGitToken(auth);
  if (!token) {
    return;
  }

  const username = auth.username?.trim() || 'x-access-token';
  const input = `protocol=https\nhost=github.com\nusername=${username}\npassword=${token}\n\n`;
  await execFileAsync('git', ['credential', 'approve'], { input, encoding: 'utf8' });
};

export const readGitCredentials = async (): Promise<GitAuthSettings> => {
  const stored = readCredentialFile();
  if (!stored) {
    return { kind: 'none' };
  }
  const token = stored.hasToken ? await getGitCredentialToken() : null;
  return normalizeGitAuthSettings({
    ...stored,
    token: token ?? undefined,
  });
};

export const writeGitCredentials = async (auth: GitAuthSettings): Promise<void> => {
  const normalized = normalizeGitAuthSettings(auth);
  const existing = readCredentialFile();
  const nextToken = incomingToken(normalized);
  let hasToken = Boolean(existing?.hasToken);

  if (normalized.kind === 'https_pat') {
    if (nextToken) {
      await setGitCredentialToken(nextToken);
      hasToken = true;
    }
  } else if (hasToken) {
    await deleteGitCredentialToken();
    hasToken = false;
  }

  persistCredentialFile(normalized, hasToken);
  const hydrated: GitAuthSettings = {
    ...normalized,
    token: nextToken || (hasToken ? await getGitCredentialToken() ?? undefined : undefined),
  };
  void approveHttpsCredential(hydrated);
};

export const clearGitCredentials = async (): Promise<void> => {
  const filePath = resolveCredentialPath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  await deleteGitCredentialToken();
};

export const hasGitCredential = (): boolean => {
  const stored = readCredentialFile();
  if (!stored) {
    return false;
  }
  if (stored.kind === 'https_pat') {
    return Boolean(stored.hasToken || stored.tokenEnvKey?.trim());
  }
  if (stored.kind === 'ssh_key_path') {
    return Boolean(stored.sshKeyPath?.trim());
  }
  return false;
};
