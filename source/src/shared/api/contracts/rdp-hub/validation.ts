import { LATIN_SLUG_RE, sanitizeLatinSlugInput, validateLatinSlug } from '../../../lib/latinSlug';
import { RDP_HUB_SECURITY_MODES, type RdpHubSecurityMode } from './types';

export const RDP_HUB_DEFAULT_PORT = 3389;
export const RDP_HUB_MIN_PORT = 1;
export const RDP_HUB_MAX_PORT = 65535;
export const RDP_HUB_MAX_NAME_LENGTH = 80;
export const RDP_HUB_MAX_NOTE_LENGTH = 240;
export const RDP_HUB_MAX_TAGS = 16;
export const RDP_HUB_MAX_TAG_LENGTH = 32;
export const RDP_HUB_DEFAULT_SECURITY: RdpHubSecurityMode = 'nla';
export const RDP_HUB_MIN_DISPLAY = 320;
export const RDP_HUB_MAX_DISPLAY = 7680;
export const RDP_HUB_DEFAULT_DISPLAY_WIDTH = 1280;
export const RDP_HUB_DEFAULT_DISPLAY_HEIGHT = 800;

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])\.?$/i;
const IPV6_RE = /^(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;
const USERNAME_RE = /^[A-Za-z0-9._@$-]{1,256}$/;
const DOMAIN_RE = /^[A-Za-z0-9._-]{0,64}$/;
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

export function stripHostBrackets(host: string): string {
  const trimmed = host.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function isWellFormedRdpHost(host: string): boolean {
  const normalized = stripHostBrackets(host);
  if (!normalized || CONTROL_CHARS_RE.test(normalized)) {
    return false;
  }
  if (IPV4_RE.test(normalized) || IPV6_RE.test(normalized)) {
    return true;
  }
  return HOSTNAME_RE.test(normalized);
}

export function isWellFormedRdpUsername(username: string): boolean {
  const trimmed = username.trim();
  return USERNAME_RE.test(trimmed) && !CONTROL_CHARS_RE.test(trimmed);
}

export function parseRdpHubPort(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isInteger(numeric) || numeric < RDP_HUB_MIN_PORT || numeric > RDP_HUB_MAX_PORT) {
    return null;
  }
  return numeric;
}

export function parseRdpHubSecurity(value: unknown): RdpHubSecurityMode | null {
  return typeof value === 'string' && (RDP_HUB_SECURITY_MODES as readonly string[]).includes(value)
    ? value as RdpHubSecurityMode
    : null;
}

export function parseRdpHubDisplaySize(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isInteger(numeric) || numeric < RDP_HUB_MIN_DISPLAY || numeric > RDP_HUB_MAX_DISPLAY) {
    return fallback;
  }
  return numeric;
}

export function sanitizeRdpHubDisplayName(raw: string): string {
  return raw.replace(CONTROL_CHARS_RE, '').trim().slice(0, RDP_HUB_MAX_NAME_LENGTH);
}

export function sanitizeRdpHubNote(raw: string): string {
  return raw.replace(CONTROL_CHARS_RE, '').trim().slice(0, RDP_HUB_MAX_NOTE_LENGTH);
}

export function sanitizeRdpHubDomain(raw: string): string {
  return raw.replace(CONTROL_CHARS_RE, '').trim().slice(0, 64);
}

export function sanitizeRdpHubTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      continue;
    }
    const tag = item.replace(CONTROL_CHARS_RE, '').trim().slice(0, RDP_HUB_MAX_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push(tag);
    if (tags.length >= RDP_HUB_MAX_TAGS) {
      break;
    }
  }
  return tags;
}

export function sanitizeRdpHubConnectionKey(raw: string): string {
  return sanitizeLatinSlugInput(raw).slice(0, 64);
}

export function validateRdpHubConnectionKey(value: string): string | null {
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

export function validateRdpHubHost(host: string): string | null {
  const normalized = stripHostBrackets(host);
  if (!normalized) {
    return 'Host is required.';
  }
  if (!isWellFormedRdpHost(normalized)) {
    return 'Host must be a valid hostname or IP address.';
  }
  return null;
}

export function validateRdpHubUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) {
    return 'Username is required.';
  }
  if (!isWellFormedRdpUsername(trimmed)) {
    return 'Username may only contain letters, numbers, dot, underscore, at, dollar, and dash.';
  }
  return null;
}

export function validateRdpHubDomain(domain: string): string | null {
  const trimmed = sanitizeRdpHubDomain(domain);
  if (!trimmed) {
    return null;
  }
  if (!DOMAIN_RE.test(trimmed) || CONTROL_CHARS_RE.test(trimmed)) {
    return 'Domain may only contain letters, numbers, dot, underscore, and dash.';
  }
  return null;
}

export function validateRdpHubDisplayName(name: string): string | null {
  const trimmed = sanitizeRdpHubDisplayName(name);
  if (!trimmed) {
    return 'Name is required.';
  }
  return null;
}
