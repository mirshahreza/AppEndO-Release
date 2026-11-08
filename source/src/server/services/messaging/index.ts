export { sendSms, buildSmsGatewayRequestUrl, type SendSmsInput, type SendSmsResult } from './sendSms';
export {
  sendPushNotification,
  type SendPushNotificationInput,
  type SendPushNotificationResult,
} from './sendPushNotification';
export { resolveSmsGatewayPort, normalizeSmsDestination } from './smsPort';

/** Legacy VX self-registration SMS subject (VX_BaseInformation). */
export const VX_SMS_SUBJECT_SELF_REGISTRATION = 111225;

/** Legacy push outbox subject. */
export const VX_PUSH_SUBJECT_GENERAL = 111220;
