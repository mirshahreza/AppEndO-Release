export type SmtpEncryptionMode = 'starttls' | 'implicitTls';

export const SMTP_ENCRYPTION_OPTIONS: ReadonlyArray<{
  value: SmtpEncryptionMode;
  title: string;
  description: string;
  shortDescription: string;
  typicalPort: number;
}> = [
  {
    value: 'starttls',
    title: 'STARTTLS',
    description: 'Connect in plain text, then upgrade to TLS before authentication. Typical for port 465; also used on port 587.',
    shortDescription: 'Plain connect, then upgrade to TLS (ports 465/587).',
    typicalPort: 465,
  },
  {
    value: 'implicitTls',
    title: 'SSL/TLS (implicit)',
    description: 'TLS from the first byte (SMTPS). Use when the server expects immediate encryption — typically port 587.',
    shortDescription: 'TLS from the first byte; typical port 587.',
    typicalPort: 587,
  },
];

export const smtpSecureToEncryption = (secure: boolean): SmtpEncryptionMode =>
  (secure ? 'implicitTls' : 'starttls');

export const smtpEncryptionToSecure = (mode: SmtpEncryptionMode): boolean =>
  mode === 'implicitTls';

export const smtpEncryptionLabel = (secure: boolean): string => {
  const mode = smtpSecureToEncryption(secure);
  return SMTP_ENCRYPTION_OPTIONS.find((option) => option.value === mode)?.title ?? mode;
};
