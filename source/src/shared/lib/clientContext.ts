import {
  APPENDO_INSTALL_ID_STORAGE_KEY,
  APPENDO_CLIENT_HEADER,
  CHANGE_REASON_CODE_HEADER,
  CHANGE_REASON_TEXT_HEADER,
} from '../api/contracts/client-context';

const INSTALL_COOKIE = APPENDO_INSTALL_ID_STORAGE_KEY;

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

const writeCookie = (name: string, value: string): void => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
};

export const getOrCreateInstallId = (): string => {
  if (typeof window === 'undefined') return '';
  const fromCookie = readCookie(INSTALL_COOKIE);
  if (fromCookie) return fromCookie;
  try {
    const fromStorage = window.localStorage.getItem(APPENDO_INSTALL_ID_STORAGE_KEY);
    if (fromStorage) {
      writeCookie(INSTALL_COOKIE, fromStorage);
      return fromStorage;
    }
  } catch {
    // ignore storage failures
  }
  const created = crypto.randomUUID();
  try {
    window.localStorage.setItem(APPENDO_INSTALL_ID_STORAGE_KEY, created);
  } catch {
    // ignore
  }
  writeCookie(INSTALL_COOKIE, created);
  return created;
};

export const buildWebIdentityClaimed = (): Record<string, unknown> => {
  const timeZone = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : undefined;
  return {
    channel: 'web',
    runtime: 'browser',
    appId: typeof window !== 'undefined' ? window.location.origin : undefined,
    installId: getOrCreateInstallId(),
    timeZone,
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
    clientOccurredAt: new Date().toISOString(),
    locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
  };
};

const mergeClientHeader = (
  headers: Headers,
  extra: Record<string, unknown>,
): void => {
  const existingRaw = headers.get(APPENDO_CLIENT_HEADER);
  let existing: Record<string, unknown> = {};
  if (existingRaw) {
    try {
      existing = JSON.parse(existingRaw) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }
  headers.set(APPENDO_CLIENT_HEADER, JSON.stringify({ ...existing, ...extra }));
};

export const attachIdentityClientHeader = (headers: Headers): void => {
  if (typeof window === 'undefined') return;
  if (headers.has(APPENDO_CLIENT_HEADER)) return;
  headers.set(APPENDO_CLIENT_HEADER, JSON.stringify(buildWebIdentityClaimed()));
};

export type AttachClientContextOptions = {
  location?: 'off' | 'record' | 'require';
  reasonCode?: string | null;
  reasonText?: string | null;
};

const readLocation = async (
  mode: 'off' | 'record' | 'require',
): Promise<Record<string, unknown>> => {
  if (mode === 'off' || typeof navigator === 'undefined' || !navigator.geolocation) {
    return mode === 'require'
      ? { locationPermission: 'unavailable' }
      : {};
  }
  const permission = navigator.permissions
    ? await navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((status) => status.state).catch(() => 'prompt')
    : 'prompt';
  if (mode === 'record' && permission !== 'prompt' && permission !== 'granted') {
    return { locationPermission: permission };
  }
  if (mode === 'record' && permission === 'granted') {
    // still capture a fix on Save
  } else if (mode === 'record' && permission !== 'prompt') {
    return { locationPermission: permission };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          locationPermission: 'granted',
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyM: position.coords.accuracy,
            altitudeM: position.coords.altitude,
            speed: position.coords.speed,
            heading: position.coords.heading,
            fixAt: new Date(position.timestamp).toISOString(),
            source: 'gps',
          },
        });
      },
      () => {
        resolve({ locationPermission: 'denied' });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  });
};

export const attachClientContext = async (
  init: RequestInit = {},
  options: AttachClientContextOptions = {},
): Promise<RequestInit> => {
  const headers = new Headers(init.headers ?? undefined);
  const claimed = buildWebIdentityClaimed();
  if (options.location && options.location !== 'off') {
    Object.assign(claimed, await readLocation(options.location));
  }
  mergeClientHeader(headers, claimed);
  if (options.reasonCode) {
    headers.set(CHANGE_REASON_CODE_HEADER, options.reasonCode);
  }
  if (options.reasonText) {
    headers.set(CHANGE_REASON_TEXT_HEADER, options.reasonText);
  }
  return { ...init, headers };
};
