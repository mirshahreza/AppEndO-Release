export { sendSms, buildSmsGatewayRequestUrl, type SendSmsInput, type SendSmsResult } from './sendSms';
export {
  sendPushNotification,
  type SendPushNotificationInput,
  type SendPushNotificationResult,
} from './sendPushNotification';
export { resolveSmsGatewayPort, normalizeSmsDestination } from './smsPort';

/** Legacy HWY self-registration SMS subject (HWY_BaseInformation). */
export const HWY_SMS_SUBJECT_SELF_REGISTRATION = 111225;

/** Legacy push outbox subject. */
export const HWY_PUSH_SUBJECT_GENERAL = 111220;
