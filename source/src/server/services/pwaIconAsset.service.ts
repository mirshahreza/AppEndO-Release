import fs from 'fs';
import path from 'path';
import {
  resolvePwaIconUrlForSlot,
  type PwaSettings,
} from '../../shared/api/contracts/settings/pwa';
import {
  isPwaPlatformAssetUrl,
  pwaPlatformAssetUrlToRelativePath,
  type PwaIconSlot,
} from '../../shared/lib/pwaAssets';
import { getPwaAssetsRootPath } from './pwaAssets.service';

export function resolvePwaIconFilePath(
  settings: Partial<PwaSettings>,
  slot: PwaIconSlot,
  overrideUrl?: string,
): string | null {
  const trimmed = (overrideUrl?.trim() || resolvePwaIconUrlForSlot(settings, slot)).trim();
  if (!trimmed) {
    return null;
  }

  if (isPwaPlatformAssetUrl(trimmed)) {
    const relativePath = pwaPlatformAssetUrlToRelativePath(trimmed);
    if (!relativePath) {
      return null;
    }
    const runtimePath = path.join(getPwaAssetsRootPath(), relativePath);
    if (fs.existsSync(runtimePath)) {
      return runtimePath;
    }
    return null;
  }

  const publicPath = path.join(process.cwd(), 'public', trimmed.replace(/^\/+/, ''));
  if (fs.existsSync(publicPath)) {
    return publicPath;
  }

  return null;
}
