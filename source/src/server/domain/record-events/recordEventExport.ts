import crypto from 'node:crypto';
import { resolveCredentialMasterKey } from '../security/credentialVault/credentialCrypto';
import type { RecordEventPublicRow } from '../../../shared/api/contracts/record-events';

export const RECORD_EVENT_EXPORT_PURPOSE = 'record-event-export';

export const signRecordEventExport = (items: RecordEventPublicRow[]): {
  payload: string;
  signature: string;
  signedAt: string;
} => {
  const signedAt = new Date().toISOString();
  const payload = JSON.stringify({ purpose: RECORD_EVENT_EXPORT_PURPOSE, signedAt, items });
  const signature = crypto
    .createHmac('sha256', resolveCredentialMasterKey())
    .update(payload)
    .digest('hex');
  return { payload, signature, signedAt };
};

export const verifyRecordEventExport = (payload: string, signature: string): boolean => {
  const expected = crypto
    .createHmac('sha256', resolveCredentialMasterKey())
    .update(payload)
    .digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};
