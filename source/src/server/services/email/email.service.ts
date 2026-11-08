import nodemailer from 'nodemailer';
import { logger } from '../../../core/logging/Logger';
import { readRuntimeSettings } from '../../config/settingsFile';
import { DEFAULT_SETTINGS } from '../../../shared/api/contracts/settings/constants';
import { smtpSecureToEncryption, type SmtpEncryptionMode } from '../../../shared/api/contracts/settings/smtpEncryption';
import { getCachedSection } from '../settings/appSettingsCache';
import {
  assertEmailSectionHasNoPlaintextSecret,
  hydrateSmtpPassword,
} from '../../domain/security/credentialVault/platformSettingsSecrets';

export type SmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
};

const SMTP_VERIFY_TIMEOUT_MS = 12_000;

export const isGmailSmtpHost = (host: string): boolean =>
  /^smtp\.gmail\.com$/i.test(host.trim());

export const isOffice365SmtpHost = (host: string): boolean =>
  /^(?:smtp\.office365\.com|smtp-mail\.outlook\.com|smtp\.outlook\.com)$/i.test(host.trim());

/** Gmail app passwords are 16 chars, often copied with spaces; username is case-insensitive. */
export const normalizeSmtpAuth = (
  host: string,
  user: string,
  pass: string,
): { user: string; pass: string } => {
  const trimmedUser = user.trim();
  if (!isGmailSmtpHost(host)) {
    return { user: trimmedUser, pass };
  }
  return {
    user: trimmedUser.toLowerCase(),
    pass: pass.replace(/\s+/g, ''),
  };
};

export const formatSmtpVerifyError = (
  message: string,
  host: string,
): string => {
  const lower = message.toLowerCase();
  if (
    isGmailSmtpHost(host)
    && (
      lower.includes('535')
      || lower.includes('badcredentials')
      || lower.includes('username and password not accepted')
    )
  ) {
    return [
      'Gmail rejected the login.',
      'Use your full @gmail.com address as Username and a Google App Password (not your regular Google password).',
      'Enable 2-Step Verification, then create an App Password at https://myaccount.google.com/apppasswords',
      'and paste the 16-character code (spaces are optional).',
    ].join(' ');
  }
  if (lower.includes('534') && lower.includes('application-specific')) {
    return 'This mailbox requires a Google App Password — regular account passwords cannot be used for SMTP.';
  }
  if (
    lower.includes('5.7.60')
    || lower.includes('does not have permissions to send as this sender')
    || lower.includes('send as')
  ) {
    return [
      'SMTP rejected the message: the From address is not allowed for this mailbox.',
      'Set From email to the same address as the SMTP username,',
      'or grant Send As permission for that address in your mail admin console.',
    ].join(' ');
  }
  return message;
};

/** Map explicit encryption mode to nodemailer TLS options. */
export const resolveSmtpTransportTls = (
  mode: SmtpEncryptionMode,
): { secure: boolean; requireTLS: boolean } => {
  if (mode === 'implicitTls') {
    return { secure: true, requireTLS: false };
  }
  return { secure: false, requireTLS: true };
};

export const readSmtpSettings = async (): Promise<SmtpSettings> => {
  const section = getCachedSection('email');
  assertEmailSectionHasNoPlaintextSecret(section);
  const portRaw = section.smtpPort;
  const hasPassword = section.smtpHasPassword === true;
  const pass = hasPassword ? await hydrateSmtpPassword() : '';

  return {
    enabled: section.smtpEnabled === true,
    host: typeof section.smtpHost === 'string' ? section.smtpHost.trim() : DEFAULT_SETTINGS.smtpHost,
    port: typeof portRaw === 'number' && portRaw > 0 ? portRaw : DEFAULT_SETTINGS.smtpPort,
    secure: section.smtpSecure === true,
    user: typeof section.smtpUser === 'string' ? section.smtpUser : DEFAULT_SETTINGS.smtpUser,
    pass,
    fromEmail: typeof section.smtpFromEmail === 'string' ? section.smtpFromEmail.trim() : DEFAULT_SETTINGS.smtpFromEmail,
    fromName: typeof section.smtpFromName === 'string' ? section.smtpFromName.trim() : DEFAULT_SETTINGS.smtpFromName,
  };
};

export const buildSmtpTransport = (settings: SmtpSettings) => {
  if (!settings.host) {
    throw new Error('SMTP host is not configured.');
  }

  const tls = resolveSmtpTransportTls(smtpSecureToEncryption(settings.secure));
  const auth = normalizeSmtpAuth(settings.host, settings.user, settings.pass);

  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: tls.secure,
    requireTLS: tls.requireTLS,
    auth: auth.user ? { user: auth.user, pass: auth.pass } : undefined,
    connectionTimeout: SMTP_VERIFY_TIMEOUT_MS,
    greetingTimeout: SMTP_VERIFY_TIMEOUT_MS,
    socketTimeout: SMTP_VERIFY_TIMEOUT_MS,
  });
};

export const verifySmtpSettings = async (
  settings: SmtpSettings,
): Promise<{ success: boolean; message: string }> => {
  if (!settings.host.trim()) {
    return { success: false, message: 'SMTP host is required.' };
  }
  if (!settings.fromEmail.trim()) {
    return { success: false, message: 'From email is required.' };
  }

  const auth = normalizeSmtpAuth(settings.host, settings.user, settings.pass);
  if (isGmailSmtpHost(settings.host)) {
    const fromEmail = settings.fromEmail.trim().toLowerCase();
    if (fromEmail !== auth.user) {
      return {
        success: false,
        message: 'Gmail requires the From email to match the SMTP username (same @gmail.com address).',
      };
    }
  }

  if (isOffice365SmtpHost(settings.host)) {
    const fromEmail = settings.fromEmail.trim().toLowerCase();
    if (fromEmail !== auth.user) {
      return {
        success: false,
        message: 'Office 365 / Outlook requires the From email to match the SMTP username unless Send As is granted in admin.',
      };
    }
  }

  try {
    const transport = buildSmtpTransport({ ...settings, enabled: true });
    await transport.verify();
    return { success: true, message: 'SMTP connection verified.' };
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'SMTP connection failed.';
    return { success: false, message: formatSmtpVerifyError(raw, settings.host) };
  }
};

export const sendEmail = async (input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ delivered: boolean; mode: 'smtp' | 'log' }> => {
  const settings = await readSmtpSettings();
  const fromAddress = settings.fromEmail || settings.user || 'noreply@append.local';
  const from = settings.fromName ? `"${settings.fromName}" <${fromAddress}>` : fromAddress;

  if (!settings.enabled) {
    logger.info('EmailService', 'Email queued (SMTP disabled — dev log only)', {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { delivered: false, mode: 'log' };
  }

  const transport = buildSmtpTransport(settings);
  try {
    await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html || input.text.replace(/\n/g, '<br/>'),
    });
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'Failed to send email.';
    throw new Error(formatSmtpVerifyError(raw, settings.host));
  }

  return { delivered: true, mode: 'smtp' };
};

export const buildAppLink = (path: string): string => {
  const fromEnv = (process.env.APP_URL || '').trim();
  const fromSettings = (readRuntimeSettings().appUrl || '').trim();
  const base = (fromEnv || fromSettings).replace(/\/+$/, '');
  if (base) {
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }
  return path;
};
