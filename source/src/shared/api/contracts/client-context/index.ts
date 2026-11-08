import { z } from 'zod';

export const CLIENT_CONTEXT_ENVELOPE_MAX_BYTES = 4096;
export const CLIENT_CLOCK_SKEW_WARN_MINUTES = 5;
export const APPENDO_INSTALL_ID_STORAGE_KEY = 'appendo_install_id';
export const APPENDO_CLIENT_HEADER = 'X-AppEndO-Client';
export const CHANGE_REASON_CODE_HEADER = 'X-AppEndO-Change-Reason-Code';
export const CHANGE_REASON_TEXT_HEADER = 'X-AppEndO-Change-Reason-Text';

export const CLIENT_CONTEXT_BODY_KEY = '__client';
export const CHANGE_REASON_CODE_BODY_KEY = '__changeReasonCode';
export const CHANGE_REASON_TEXT_BODY_KEY = '__changeReasonText';

export const clientContextModeSchema = z.enum(['off', 'record', 'require']);
export type ClientContextMode = z.infer<typeof clientContextModeSchema>;

export const clientChannelSchema = z.enum(['web', 'pwa', 'ios', 'android', 'desktop', 'server']);
export type ClientChannel = z.infer<typeof clientChannelSchema>;

export const clientRuntimeSchema = z.enum(['browser', 'webview', 'native', 'server']);
export type ClientRuntime = z.infer<typeof clientRuntimeSchema>;

export type ClientContextSource = 'observed' | 'claimed';

export type ClientContextCatalogEntry = {
  id: string;
  source: ClientContextSource;
  label: string;
  group: 'identity' | 'time' | 'location' | 'device' | 'connection' | 'page';
};

export const CLIENT_CONTEXT_CATALOG: readonly ClientContextCatalogEntry[] = [
  { id: 'ip', source: 'observed', label: 'IP address', group: 'connection' },
  { id: 'geoipCountry', source: 'observed', label: 'GeoIP country', group: 'connection' },
  { id: 'userAgent', source: 'observed', label: 'User-Agent', group: 'connection' },
  { id: 'serverOccurredAt', source: 'observed', label: 'Server time', group: 'time' },
  { id: 'requestId', source: 'observed', label: 'Request id', group: 'connection' },
  { id: 'channel', source: 'observed', label: 'Server channel', group: 'identity' },
  { id: 'tlsProtocol', source: 'observed', label: 'TLS protocol', group: 'connection' },
  { id: 'httpVersion', source: 'observed', label: 'HTTP version', group: 'connection' },
  { id: 'secChUa', source: 'observed', label: 'sec-ch-ua', group: 'device' },
  { id: 'secChUaMobile', source: 'observed', label: 'sec-ch-ua-mobile', group: 'device' },
  { id: 'secChUaPlatform', source: 'observed', label: 'sec-ch-ua-platform', group: 'device' },
  { id: 'acceptLanguage', source: 'observed', label: 'Accept-Language', group: 'page' },
  { id: 'clockSkewMinutes', source: 'observed', label: 'Clock skew (minutes)', group: 'time' },
  { id: 'channel', source: 'claimed', label: 'Channel', group: 'identity' },
  { id: 'runtime', source: 'claimed', label: 'Runtime', group: 'identity' },
  { id: 'appId', source: 'claimed', label: 'App id', group: 'identity' },
  { id: 'appVersion', source: 'claimed', label: 'App version', group: 'identity' },
  { id: 'appBuild', source: 'claimed', label: 'App build', group: 'identity' },
  { id: 'sdkVersion', source: 'claimed', label: 'SDK version', group: 'identity' },
  { id: 'installId', source: 'claimed', label: 'Install id', group: 'identity' },
  { id: 'vendorId', source: 'claimed', label: 'Vendor id', group: 'identity' },
  { id: 'clientOccurredAt', source: 'claimed', label: 'Client occurred at', group: 'time' },
  { id: 'timeZone', source: 'claimed', label: 'Time zone', group: 'time' },
  { id: 'utcOffsetMinutes', source: 'claimed', label: 'UTC offset (minutes)', group: 'time' },
  { id: 'location', source: 'claimed', label: 'Location', group: 'location' },
  { id: 'locationPermission', source: 'claimed', label: 'Location permission', group: 'location' },
  { id: 'deviceModel', source: 'claimed', label: 'Device model', group: 'device' },
  { id: 'deviceManufacturer', source: 'claimed', label: 'Device manufacturer', group: 'device' },
  { id: 'osName', source: 'claimed', label: 'OS name', group: 'device' },
  { id: 'osVersion', source: 'claimed', label: 'OS version', group: 'device' },
  { id: 'formFactor', source: 'claimed', label: 'Form factor', group: 'device' },
  { id: 'locale', source: 'claimed', label: 'Locale', group: 'device' },
  { id: 'screen', source: 'claimed', label: 'Screen', group: 'device' },
  { id: 'network', source: 'claimed', label: 'Network', group: 'device' },
  { id: 'pageKey', source: 'claimed', label: 'Page key', group: 'page' },
  { id: 'portalId', source: 'claimed', label: 'Portal id', group: 'page' },
  { id: 'ext', source: 'claimed', label: 'Custom extension', group: 'page' },
] as const;

const UNIQUE_CLAIMED_IDS = [
  'channel', 'runtime', 'appId', 'appVersion', 'appBuild', 'sdkVersion', 'installId', 'vendorId',
  'clientOccurredAt', 'timeZone', 'utcOffsetMinutes',
  'location', 'locationPermission',
  'deviceModel', 'deviceManufacturer', 'osName', 'osVersion', 'formFactor', 'locale', 'screen', 'network',
  'pageKey', 'portalId', 'ext',
] as const;

const UNIQUE_OBSERVED_IDS = [
  'ip', 'geoipCountry', 'userAgent', 'serverOccurredAt', 'requestId', 'channel',
  'tlsProtocol', 'httpVersion', 'secChUa', 'secChUaMobile', 'secChUaPlatform',
  'acceptLanguage', 'clockSkewMinutes',
] as const;

export const claimedClientContextIdSchema = z.enum(UNIQUE_CLAIMED_IDS);
export const observedClientContextIdSchema = z.enum(UNIQUE_OBSERVED_IDS);

export const clientContextFieldSelectionSchema = z.object({
  id: z.string().min(1),
  mode: clientContextModeSchema,
}).strict();

export type ClientContextFieldSelection = z.infer<typeof clientContextFieldSelectionSchema>;

export const clientContextConfigSchema = z.object({
  fields: z.array(clientContextFieldSelectionSchema).default([]),
}).strict();

export type ClientContextConfig = z.infer<typeof clientContextConfigSchema>;

export const IDENTITY_WRITE_CLIENT_CONTEXT_FIELDS: ClientContextFieldSelection[] = [
  { id: 'channel', mode: 'record' },
  { id: 'runtime', mode: 'record' },
  { id: 'appId', mode: 'record' },
  { id: 'appVersion', mode: 'record' },
  { id: 'installId', mode: 'record' },
  { id: 'timeZone', mode: 'record' },
  { id: 'clientOccurredAt', mode: 'record' },
];

export const isKnownClientContextFieldId = (id: string, source?: ClientContextSource): boolean => {
  if (source === 'observed') {
    return (UNIQUE_OBSERVED_IDS as readonly string[]).includes(id);
  }
  if (source === 'claimed') {
    return (UNIQUE_CLAIMED_IDS as readonly string[]).includes(id);
  }
  return (UNIQUE_OBSERVED_IDS as readonly string[]).includes(id)
    || (UNIQUE_CLAIMED_IDS as readonly string[]).includes(id);
};

export const defaultWriteClientContext = (): ClientContextConfig => ({
  fields: IDENTITY_WRITE_CLIENT_CONTEXT_FIELDS.map((field) => ({ ...field })),
});
