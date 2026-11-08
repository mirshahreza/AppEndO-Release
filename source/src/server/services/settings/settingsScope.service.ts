import { buildPlatformSettingsExportPayload } from './platformSettingsCache';
import { readRuntimeSettings, writeSettingsObject, readSettingsObject } from '../../config/settingsFile';
import { getSecuritySettings, saveSecuritySettingsAsync } from '../../db/securitySettingsStore';
import type { ActorContext } from '../../types/requestContext';
import { resolveActiveNodeCapabilities, resolveActiveNodeName } from '../../../shared/nodeCapabilities';
import type { SettingsNodeEnv } from '../../../shared/api/contracts/settings/authPolicy';

export type NodeSettingsSnapshot = {
  nodeName: string;
  capabilities: string[];
  nodeEnv: SettingsNodeEnv;
  port: number;
  logLevel: string;
  disableHmr: boolean;
  hmrPort: number;
  appUrl: string | undefined;
};

export const readNodeSettings = (settingsPath: string): NodeSettingsSnapshot => {
  const runtime = readRuntimeSettings(settingsPath);
  return {
    nodeName: resolveActiveNodeName(runtime.nodeName),
    capabilities: resolveActiveNodeCapabilities({ capabilities: runtime.capabilities }),
    nodeEnv: runtime.nodeEnv,
    port: runtime.port,
    logLevel: runtime.logLevel,
    disableHmr: runtime.disableHmr,
    hmrPort: runtime.hmrPort,
    appUrl: runtime.appUrl,
  };
};

export const mergeNodeSettings = (
  settingsPath: string,
  patch: Partial<NodeSettingsSnapshot>,
): NodeSettingsSnapshot => {
  const settings = readSettingsObject(settingsPath);
  const runtime = readRuntimeSettings(settingsPath);
  const nextRuntime = {
    ...runtime,
    ...(patch.nodeName !== undefined ? { nodeName: patch.nodeName.trim() || runtime.nodeName } : {}),
    ...(patch.capabilities !== undefined ? { capabilities: patch.capabilities } : {}),
    ...(patch.port !== undefined ? { port: patch.port } : {}),
    ...(patch.logLevel !== undefined ? { logLevel: patch.logLevel } : {}),
    ...(patch.disableHmr !== undefined ? { disableHmr: patch.disableHmr } : {}),
    ...(patch.hmrPort !== undefined ? { hmrPort: patch.hmrPort } : {}),
    ...(patch.appUrl !== undefined ? { appUrl: patch.appUrl } : {}),
  };
  settings.runtime = nextRuntime;
  writeSettingsObject(settingsPath, settings);
  return readNodeSettings(settingsPath);
};

export const readPlatformSecuritySettings = (settingsPath: string) => {
  const security = getSecuritySettings(settingsPath);
  return {
    hasAccessTokenSecret: Boolean(security.accessTokenSecret),
    hasRefreshTokenSecret: Boolean(security.refreshTokenSecret),
    accessTokenSecretPreview: security.accessTokenSecret.slice(0, 4) + '…',
    refreshTokenSecretPreview: security.refreshTokenSecret.slice(0, 4) + '…',
  };
};

export const updatePlatformSecuritySettings = async (
  settingsPath: string,
  payload: { accessTokenSecret?: string; refreshTokenSecret?: string },
  actor: ActorContext | null,
) => {
  const current = getSecuritySettings(settingsPath);
  const next = {
    accessTokenSecret: payload.accessTokenSecret?.trim() || current.accessTokenSecret,
    refreshTokenSecret: payload.refreshTokenSecret?.trim() || current.refreshTokenSecret,
  };
  await saveSecuritySettingsAsync(next, actor?.userId ?? null);
  return readPlatformSecuritySettings(settingsPath);
};

export const exportPlatformSettings = () => ({
  version: 1 as const,
  exportedAt: new Date().toISOString(),
  platform: buildPlatformSettingsExportPayload(),
});

export const importPlatformSettings = async (
  payload: { platform?: Record<string, unknown> },
  actor: ActorContext | null,
): Promise<{ imported: string[] }> => {
  const { replaceCachedPlatformBlob } = await import('./platformSettingsCache');
  const imported: string[] = [];
  const platform = payload.platform;
  if (!platform || typeof platform !== 'object') {
    return { imported };
  }

  for (const [key, value] of Object.entries(platform)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    await replaceCachedPlatformBlob(
      key as import('../../../shared/api/contracts/settings/scopes').PlatformBlobSectionKey,
      value as Record<string, unknown>,
      actor?.userId ?? null,
    );
    imported.push(key);
  }

  return { imported };
};
