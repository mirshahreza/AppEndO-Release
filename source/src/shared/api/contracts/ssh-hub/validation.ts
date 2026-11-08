import { LATIN_SLUG_RE, sanitizeLatinSlugInput, validateLatinSlug } from '../../../lib/latinSlug';
import { SSH_HUB_AUTH_METHODS, type SshHubAuthMethod } from './types';

export const SSH_HUB_DEFAULT_PORT = 22;
export const SSH_HUB_MIN_PORT = 1;
export const SSH_HUB_MAX_PORT = 65535;
export const SSH_HUB_MAX_NAME_LENGTH = 80;
export const SSH_HUB_MAX_NOTE_LENGTH = 240;
export const SSH_HUB_MAX_TAGS = 16;
export const SSH_HUB_MAX_TAG_LENGTH = 32;
export const SSH_HUB_MAX_PATH_LENGTH = 1024;
export const SSH_HUB_MAX_PATH_SEGMENT_LENGTH = 255;

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])\.?$/i;
const IPV6_RE = /^(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;
const USERNAME_RE = /^[A-Za-z0-9._@\\-]{1,64}$/;
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

export function stripHostBrackets(host: string): string {
  const trimmed = host.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function isWellFormedSshHost(host: string): boolean {
  const normalized = stripHostBrackets(host);
  if (!normalized || CONTROL_CHARS_RE.test(normalized)) {
    return false;
  }
  if (IPV4_RE.test(normalized) || IPV6_RE.test(normalized)) {
    return true;
  }
  return HOSTNAME_RE.test(normalized);
}

export function isWellFormedSshUsername(username: string): boolean {
  const trimmed = username.trim();
  return USERNAME_RE.test(trimmed) && !CONTROL_CHARS_RE.test(trimmed);
}

export function parseSshHubPort(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isInteger(numeric) || numeric < SSH_HUB_MIN_PORT || numeric > SSH_HUB_MAX_PORT) {
    return null;
  }
  return numeric;
}

export function parseSshHubAuthMethod(value: unknown): SshHubAuthMethod | null {
  return typeof value === 'string' && (SSH_HUB_AUTH_METHODS as readonly string[]).includes(value)
    ? value as SshHubAuthMethod
    : null;
}

export function sanitizeSshHubDisplayName(raw: string): string {
  return raw.replace(CONTROL_CHARS_RE, '').trim().slice(0, SSH_HUB_MAX_NAME_LENGTH);
}

export function sanitizeSshHubNote(raw: string): string {
  return raw.replace(CONTROL_CHARS_RE, '').trim().slice(0, SSH_HUB_MAX_NOTE_LENGTH);
}

export function sanitizeSshHubTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      continue;
    }
    const tag = item.replace(CONTROL_CHARS_RE, '').trim().slice(0, SSH_HUB_MAX_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push(tag);
    if (tags.length >= SSH_HUB_MAX_TAGS) {
      break;
    }
  }
  return tags;
}

export function sanitizeSshHubConnectionKey(raw: string): string {
  return sanitizeLatinSlugInput(raw).slice(0, 64);
}

export function validateSshHubConnectionKey(value: string): string | null {
  const trimmed = value.trim();
  const slugError = validateLatinSlug(trimmed, { required: true, fieldLabel: 'Key' });
  if (slugError) {
    return slugError;
  }
  if (trimmed.length > 64) {
    return 'Key must be 64 characters or fewer.';
  }
  if (!LATIN_SLUG_RE.test(trimmed)) {
    return 'Key must use lowercase letters, numbers, dash, dot, and underscore only.';
  }
  return null;
}

export function validateSshHubHost(host: string): string | null {
  const normalized = stripHostBrackets(host);
  if (!normalized) {
    return 'Host is required.';
  }
  if (!isWellFormedSshHost(normalized)) {
    return 'Host must be a valid hostname or IP address.';
  }
  return null;
}

export function validateSshHubUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) {
    return 'Username is required.';
  }
  if (!isWellFormedSshUsername(trimmed)) {
    return 'Username may only contain letters, numbers, dot, underscore, at, and dash.';
  }
  return null;
}

export function validateSshHubDisplayName(name: string): string | null {
  const trimmed = sanitizeSshHubDisplayName(name);
  if (!trimmed) {
    return 'Name is required.';
  }
  return null;
}

function normalizeSshPosixPath(raw: string): string | null {
  if (raw.includes('\0') || CONTROL_CHARS_RE.test(raw) || raw.includes('://') || /^[A-Za-z]:/.test(raw)) {
    return null;
  }
  if (raw.length > SSH_HUB_MAX_PATH_LENGTH) {
    return null;
  }
  const isAbsolute = raw.startsWith('/');
  if (!isAbsolute) {
    return null;
  }
  const stack: string[] = [];
  for (const part of raw.split('/')) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      if (stack.length === 0) {
        continue;
      }
      stack.pop();
      continue;
    }
    if (part.length > SSH_HUB_MAX_PATH_SEGMENT_LENGTH) {
      return null;
    }
    stack.push(part);
  }
  return stack.length === 0 ? '/' : `/${stack.join('/')}`;
}

/** Empty, `~`, `~/…`, or an absolute POSIX path used as the post-login working directory. */
export function sanitizeSshInitialPath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    return '';
  }
  const trimmed = raw.replace(/\\/g, '/').trim();
  if (trimmed === '~') {
    return '~';
  }
  if (trimmed.startsWith('~/')) {
    const rest = normalizeSshPosixPath(`/${trimmed.slice(2)}`);
    if (!rest) {
      return '';
    }
    return rest === '/' ? '~' : `~${rest}`;
  }
  return normalizeSshPosixPath(trimmed) ?? '';
}

function quotePosixShellSingle(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Shell input that `cd`s into the stored default path, or null when the session should stay in home. */
export function buildSshInitialCdInput(initialPath: string): string | null {
  const path = sanitizeSshInitialPath(initialPath);
  if (!path || path === '~') {
    return null;
  }
  if (path.startsWith('~/')) {
    return `cd -- ~/${quotePosixShellSingle(path.slice(2))}\n`;
  }
  return `cd -- ${quotePosixShellSingle(path)}\n`;
}
