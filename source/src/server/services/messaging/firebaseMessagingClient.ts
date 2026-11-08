import fs from 'node:fs';

import type { App } from 'firebase-admin/app';
import type { Messaging } from 'firebase-admin/messaging';

import { logger } from '../../../core/logging/Logger';
import { readPushGatewaySettings } from './messagingConfig';

let firebaseApp: App | null = null;
let messagingClient: Messaging | null = null;

export const resetFirebaseMessagingClientForTests = (): void => {
  firebaseApp = null;
  messagingClient = null;
};

export const getFirebaseMessagingClient = async (): Promise<Messaging | null> => {
  if (messagingClient) {
    return messagingClient;
  }
  const settings = readPushGatewaySettings();
  if (!settings.enabled || !settings.credentialsPath) {
    return null;
  }
  if (!fs.existsSync(settings.credentialsPath)) {
    logger.warn('PushNotification', `Firebase credentials file not found: ${settings.credentialsPath}`);
    return null;
  }

  const admin = await import('firebase-admin');
  if (!firebaseApp) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(settings.credentialsPath, 'utf8')) as Record<string, string>),
    });
  }
  messagingClient = admin.messaging();
  return messagingClient;
};
