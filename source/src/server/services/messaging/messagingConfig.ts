import fs from 'node:fs';
import path from 'node:path';

import { readRuntimeSettings } from '../../config/settingsFile';

export type SmsGatewaySettings = {
  enabled: boolean;
  /** Legacy-style URL prefix; gateway URL is built as `${gatewayUrl}&port=${port}&destination=${to}&content=${message}`. */
  gatewayUrl: string;
};

export type PushGatewaySettings = {
  enabled: boolean;
  /** Service account JSON file path (Firebase Admin). */
  credentialsPath: string;
  /** FCM topic namespace prefix (legacy uses `hawiety`). */
  topicNamespace: string;
};

const parseBool = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const n = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(n)) return true;
    if (['0', 'false', 'no', 'off'].includes(n)) return false;
  }
  return fallback;
};

const defaultFirebaseCredentialsPath = (): string => {
  const fromEnv = (process.env.MESSAGING_FIREBASE_CREDENTIALS_PATH ?? '').trim();
  if (fromEnv) return fromEnv;
  const legacyDefault = path.join(
    'C:',
    'Workspace',
    'Projects',
    'HawietySite',
    'HawietySite',
    'members-echosystem-firebase.json',
  );
  return fs.existsSync(legacyDefault) ? legacyDefault : '';
};

export const readSmsGatewaySettings = async (): Promise<SmsGatewaySettings> => {
  const gatewayUrl = (process.env.SMS_GATEWAY_URL ?? '').trim();
  const enabled = parseBool(process.env.SMS_ENABLED, Boolean(gatewayUrl));
  return { enabled: enabled && Boolean(gatewayUrl), gatewayUrl };
};

export const readPushGatewaySettings = (): PushGatewaySettings => {
  const credentialsPath = (
    (process.env.MESSAGING_FIREBASE_CREDENTIALS_PATH ?? '').trim()
    || defaultFirebaseCredentialsPath()
  );
  const topicNamespace = (process.env.MESSAGING_PUSH_TOPIC_NAMESPACE ?? '').trim() || 'hawiety';
  const enabled = parseBool(process.env.PUSH_ENABLED, Boolean(credentialsPath));
  return {
    enabled: enabled && Boolean(credentialsPath),
    credentialsPath,
    topicNamespace,
  };
};

export const isMessagingDevelopmentLogMode = (): boolean => {
  const nodeEnv = readRuntimeSettings().nodeEnv;
  return nodeEnv === 'development' || nodeEnv === 'test';
};
