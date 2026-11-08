import crypto from 'crypto';
import type { InstallStateV1 } from './types';

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeOperationId(): string {
  return `op-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

export function makeBaseState(packageId: string): InstallStateV1 {
  return {
    schema: 'package-install-state',
    schemaVersion: '1.0.0',
    packageId,
    status: 'not_installed',
    activeVersion: null,
    updatedAt: nowIso(),
    history: [],
  };
}

export function isNotFoundError(message: string): boolean {
  return message.toLowerCase().includes('not found');
}
