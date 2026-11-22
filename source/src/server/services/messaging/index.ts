export { sendSms, buildSmsGatewayRequestUrl, type SendSmsInput, type SendSmsResult } from './sendSms';
export {
  sendPushNotification,
  type SendPushNotificationInput,
  type SendPushNotificationResult,
} from './sendPushNotification';
export { resolveSmsGatewayPort, normalizeSmsDestination } from './smsPort';

/** Legacy EXTX self-registration SMS subject (EXTX_BaseInformation). */
export const EXTX_SMS_SUBJECT_SELF_REGISTRATION = 111225;

/** Legacy push outbox subject. */
export const EXTX_PUSH_SUBJECT_GENERAL = 111220;
