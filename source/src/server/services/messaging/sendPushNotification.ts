import { logger } from '../../../core/logging/Logger';
import { isMessagingDevelopmentLogMode, readPushGatewaySettings } from './messagingConfig';
import { getFirebaseMessagingClient } from './firebaseMessagingClient';

export type SendPushNotificationInput = {
  /** Legacy uses member phone as FCM topic, or `x in topics` condition string. */
  toOrTopics: string;
  title: string;
  body: string;
  actor?: string | null;
  /** When set, legacy deep-link payload is attached (page + id). */
  pageName?: string;
  entityId?: number;
};

export type SendPushNotificationResult = {
  delivered: boolean;
  mode: 'fcm' | 'log';
  responseStatus: string;
  responseContent: string;
};

const buildTopicCondition = (toOrTopics: string, topicNamespace: string): string => {
  const trimmed = toOrTopics.trim();
  if (!trimmed) {
    throw new Error('Push destination is required.');
  }
  if (trimmed.includes(' in topics')) {
    return `'${topicNamespace}' in topics && (${trimmed})`;
  }
  return `'${topicNamespace}' in topics && '${trimmed}' in topics`;
};

const parseBadgeBody = (body: string): number | null => {
  const trimmed = body.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};

/**
 * Platform push primitive — legacy Hawiety `MessagingUtils.SendNotification` / `SendNotificationShorter` parity.
 */
export async function sendPushNotification(
  input: SendPushNotificationInput,
): Promise<SendPushNotificationResult> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title && !body) {
    return {
      delivered: false,
      mode: 'log',
      responseStatus: 'skipped',
      responseContent: 'empty_payload',
    };
  }

  const settings = readPushGatewaySettings();
  const badgeCount = parseBadgeBody(body);

  if (!settings.enabled) {
    logger.info('PushNotification', 'Push queued (FCM disabled — log only)', {
      to: input.toOrTopics,
      title,
      body,
      actor: input.actor ?? null,
    });
    return {
      delivered: false,
      mode: 'log',
      responseStatus: 'disabled',
      responseContent: '',
    };
  }

  if (isMessagingDevelopmentLogMode() && process.env.PUSH_FORCE_FCM !== '1') {
    logger.info('PushNotification', 'Push (development log — set PUSH_FORCE_FCM=1 to hit FCM)', {
      to: input.toOrTopics,
      title,
      body,
    });
    return {
      delivered: false,
      mode: 'log',
      responseStatus: 'development',
      responseContent: '',
    };
  }

  const messaging = await getFirebaseMessagingClient();
  if (!messaging) {
    return {
      delivered: false,
      mode: 'log',
      responseStatus: 'no_client',
      responseContent: '',
    };
  }

  const condition = buildTopicCondition(input.toOrTopics, settings.topicNamespace);
  let responseStatus = '';
  let responseContent = '{}';

  try {
    if (badgeCount != null) {
      responseContent = await messaging.send({
        condition,
        notification: { title: '', body: '' },
        data: {
          content_available: 'true',
          badge: String(badgeCount),
          silent: 'true',
          id: '',
          page: '',
        },
        android: { data: { badge: String(badgeCount) } },
        apns: { payload: { aps: { badge: badgeCount } } },
      });
    } else {
      responseContent = await messaging.send({
        condition,
        notification: { title, body },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('PushNotification', `FCM send failed: ${message}`, { to: input.toOrTopics });
    responseStatus = ':(';
    responseContent = message;
  }

  return {
    delivered: responseStatus !== ':(',
    mode: 'fcm',
    responseStatus,
    responseContent,
  };
}
