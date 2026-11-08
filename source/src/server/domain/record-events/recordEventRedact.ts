import {
  encryptCredential,
  decryptCredential,
  isCredentialEncryptedBlob,
  type CredentialEncryptedBlob,
} from '../security/credentialVault/credentialCrypto';

export const RECORD_EVENT_REDACT_PREFIX = 'enc:v1:';
export const RECORD_EVENT_MASKED_VALUE = { redacted: true as const };

const encodeBlob = (blob: CredentialEncryptedBlob): string => (
  RECORD_EVENT_REDACT_PREFIX + Buffer.from(JSON.stringify(blob), 'utf8').toString('base64')
);

const decodeBlob = (stored: string): CredentialEncryptedBlob | null => {
  if (!stored.startsWith(RECORD_EVENT_REDACT_PREFIX)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(stored.slice(RECORD_EVENT_REDACT_PREFIX.length), 'base64').toString('utf8'),
    ) as unknown;
    return isCredentialEncryptedBlob(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const isRedactedRecordEventValue = (stored: string | null | undefined): boolean => (
  typeof stored === 'string' && stored.startsWith(RECORD_EVENT_REDACT_PREFIX)
);

export const encryptRecordEventValue = (plaintextJson: string): string => (
  encodeBlob(encryptCredential(plaintextJson))
);

export const decryptRecordEventValue = (stored: string): string => {
  const blob = decodeBlob(stored);
  if (!blob) {
    return stored;
  }
  return decryptCredential(blob);
};

export const maskRecordEventStoredValue = (stored: string | null): unknown => {
  if (stored == null) {
    return null;
  }
  if (isRedactedRecordEventValue(stored)) {
    return RECORD_EVENT_MASKED_VALUE;
  }
  try {
    return JSON.parse(stored) as unknown;
  } catch {
    return stored;
  }
};

export const parseRecordEventStoredValue = (stored: string | null, unmask: boolean): unknown => {
  if (stored == null) {
    return null;
  }
  if (isRedactedRecordEventValue(stored)) {
    if (!unmask) {
      return RECORD_EVENT_MASKED_VALUE;
    }
    try {
      return JSON.parse(decryptRecordEventValue(stored)) as unknown;
    } catch {
      return RECORD_EVENT_MASKED_VALUE;
    }
  }
  try {
    return JSON.parse(stored) as unknown;
  } catch {
    return stored;
  }
};
