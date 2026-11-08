import { logger } from '../../../core/logging/Logger';
import type { LoggingSettings } from '../../../core/logging/PinoRuntime';
import { DEFAULT_SETTINGS } from '../../../shared/api/contracts/settings/constants';
import {
  AUTH_AUDIT_DISCARD_MESSAGE,
  isAuthAuditDiscard,
  parseLogRetentionSettings,
} from '../../../shared/api/contracts/settings/retention';
import { sanitizeMethodLogConfigs } from '../../utils/httpLogging';
import type { ActorContext } from '../../types/requestContext';
import { HttpError } from '../../errors/HttpError';
import {
  getCachedEdgeAutoLogging,
  getCachedFlatSettings,
  getCachedLoggingSettings,
  getCachedPwaSettings,
  getCachedSection,
  mergeCachedFlatSettings,
  replaceCachedLoggingMethodConfigs,
} from './appSettingsCache';

export type AuthLockoutSettings = {
  enabled: boolean;
  maxFailures: number;
  windowMs: number;
  lockMs: number;
};

export function readAppSettingsSnapshot(): Record<string, unknown> {
  return getCachedFlatSettings();
}

export function readAppLoggingSettings(): LoggingSettings {
  return getCachedLoggingSettings();
}

export function readAppEdgeAutoLoggingEnabled(): boolean {
  return getCachedEdgeAutoLogging();
}

export function readAppPwaSettings() {
  return getCachedPwaSettings();
}

export function readAuthLockoutSettings(): AuthLockoutSettings {
  const authSection = getCachedSection('auth');
  const enabled = authSection.authLockoutEnabled !== false;
  const maxFailuresRaw = authSection.authLockoutMaxFailures;
  const windowSecondsRaw = authSection.authLockoutWindowSeconds;
  const maxFailures = typeof maxFailuresRaw === 'number' && maxFailuresRaw > 0
    ? maxFailuresRaw
    : DEFAULT_SETTINGS.authLockoutMaxFailures;
  const windowSeconds = typeof windowSecondsRaw === 'number' && windowSecondsRaw > 0
    ? windowSecondsRaw
    : DEFAULT_SETTINGS.authLockoutWindowSeconds;
  const windowMs = windowSeconds * 1000;

  return {
    enabled,
    maxFailures,
    windowMs,
    lockMs: windowMs,
  };
}

export function applyAppSettingsRuntimeEffects(): void {
  logger.setDefaultMethodLoggingEnabled(readAppEdgeAutoLoggingEnabled());
}

export async function saveAppSettings(
  actor: ActorContext | null,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const nextPayload = { ...payload };
  if ('logRetention' in nextPayload || 'logRetentionDays' in nextPayload) {
    const rawRetention = nextPayload.logRetention;
    if (rawRetention && typeof rawRetention === 'object' && !Array.isArray(rawRetention)
      && isAuthAuditDiscard(rawRetention as { authAudit?: { action?: unknown } })) {
      throw new HttpError(400, AUTH_AUDIT_DISCARD_MESSAGE);
    }
    const parsed = parseLogRetentionSettings(rawRetention, nextPayload.logRetentionDays);
    nextPayload.logRetention = parsed;
    nextPayload.logRetentionDays = parsed.appLogs.olderThanDays ?? DEFAULT_SETTINGS.logRetentionDays;
  }
  const actorId = actor?.userId ?? null;
  const saved = await mergeCachedFlatSettings(nextPayload, actorId);
  applyAppSettingsRuntimeEffects();
  return saved;
}

export async function saveAppLoggingMethodConfigs(
  actor: ActorContext | null,
  methodConfigs: unknown,
): Promise<Record<string, unknown>> {
  const sanitized = sanitizeMethodLogConfigs(methodConfigs);

  logger.setMethodConfigs(sanitized);
  await replaceCachedLoggingMethodConfigs(
    logger.getMethodConfigs() as Record<string, unknown>,
    actor?.userId ?? null,
  );

  return logger.getMethodConfigs() as Record<string, unknown>;
}
