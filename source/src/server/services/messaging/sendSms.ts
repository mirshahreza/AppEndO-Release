import { logger } from '../../../core/logging/Logger';
import { isMessagingDevelopmentLogMode, readSmsGatewaySettings } from './messagingConfig';
import { normalizeSmsDestination, resolveSmsGatewayPort } from './smsPort';

export type SendSmsInput = {
  to: string;
  /** Text delivered to the handset. */
  messageToSend: string;
  /** Text stored in logs / outbox (defaults to messageToSend). */
  messageToLog?: string;
  /** Legacy HWY_BaseInformation subject id (e.g. 111225 self-registration). */
  subjectId?: number;
  actor?: string | null;
};

export type SendSmsResult = {
  delivered: boolean;
  mode: 'gateway' | 'log';
  port: string | null;
  responseStatus: string;
  responseContent: string;
};

const encodeGatewayContent = (message: string): string => encodeURIComponent(message);

export const buildSmsGatewayRequestUrl = (
  gatewayUrl: string,
  port: string,
  destination: string,
  message: string,
): string => `${gatewayUrl}&port=${port}&destination=${destination}&content=${encodeGatewayContent(message)}`;

/**
 * Platform SMS primitive — legacy Hawiety `MessagingUtils.SendSMS` parity.
 * When the gateway is disabled or unset, logs in development/test and returns `{ delivered: false, mode: 'log' }`.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const settings = await readSmsGatewaySettings();
  const destination = normalizeSmsDestination(input.to);
  const port = resolveSmsGatewayPort(destination);
  const messageToLog = input.messageToLog ?? input.messageToSend;

  if (!destination || !port) {
    throw new Error('Phone number is not valid.');
  }
  if (!input.messageToSend.trim()) {
    return {
      delivered: false,
      mode: 'log',
      port,
      responseStatus: 'skipped',
      responseContent: 'empty_message',
    };
  }

  if (!settings.enabled) {
    logger.info('SendSms', 'SMS queued (gateway disabled — dev log only)', {
      to: destination,
      port,
      subjectId: input.subjectId ?? null,
      actor: input.actor ?? null,
      message: messageToLog,
    });
    return {
      delivered: false,
      mode: 'log',
      port,
      responseStatus: 'disabled',
      responseContent: '',
    };
  }

  if (isMessagingDevelopmentLogMode() && process.env.SMS_FORCE_GATEWAY !== '1') {
    logger.info('SendSms', 'SMS (development log — set SMS_FORCE_GATEWAY=1 to hit gateway)', {
      to: destination,
      port,
      subjectId: input.subjectId ?? null,
      message: messageToLog,
    });
    return {
      delivered: false,
      mode: 'log',
      port,
      responseStatus: 'development',
      responseContent: '',
    };
  }

  const url = buildSmsGatewayRequestUrl(settings.gatewayUrl, port, destination, input.messageToSend);
  let responseStatus = ':(';
  let responseContent = '{}';
  try {
    const response = await fetch(url, { method: 'GET' });
    responseStatus = String(response.status);
    responseContent = await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('SendSms', `Gateway request failed: ${message}`, { to: destination });
    responseStatus = ':(';
    responseContent = message;
  }

  logger.info('SendSms', 'SMS gateway round-trip', {
    to: destination,
    port,
    subjectId: input.subjectId ?? null,
    actor: input.actor ?? null,
    responseStatus,
  });

  return {
    delivered: responseStatus !== ':(',
    mode: 'gateway',
    port,
    responseStatus,
    responseContent,
  };
}
