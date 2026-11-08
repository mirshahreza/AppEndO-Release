import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../../shared/api/contracts/platform/mountConstants';
import {
  DEFAULT_APPEARANCE_SWATCH_ID,
  findAccentMatrixSwatchByHex,
  isAccentMatrixSwatchId,
} from '../../../shared/theme/accentPalettes';

export function parseAppearanceEditId(pathSuffix: string | undefined): string | null {
  const segments = pathSuffix?.split('/').filter(Boolean) ?? [];
  if (segments[0] === 'edit' && segments[1]) {
    return segments[1].trim();
  }
  return null;
}

export function parseAppearanceSwatchId(pathSuffix: string | undefined): string | null {
  const editId = parseAppearanceEditId(pathSuffix);
  if (!editId || !isAccentMatrixSwatchId(editId)) {
    return null;
  }
  return editId;
}

export function resolveAppearanceRouteSuffix(rawSuffix: string | undefined): string | undefined {
  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];
  if (segments.length === 0) {
    return undefined;
  }

  const index = segments.lastIndexOf('appearance');
  if (index >= 0) {
    const after = segments.slice(index + 1);
    return after.length > 0 ? after.join('/') : undefined;
  }

  return segments.join('/');
}

export function resolveActiveAppearanceSwatchId(accentHex?: string): string {
  return findAccentMatrixSwatchByHex(accentHex ?? '')?.id ?? DEFAULT_APPEARANCE_SWATCH_ID;
}

export function buildAppearanceListRelativePath(mountId: string = STUDIO_MOUNT_ID): string {
  const sectionPath = 'appearance';
  if (mountId === STUDIO_MOUNT_ID) {
    return sectionPath;
  }
  return toPortalRoutePattern(sectionPath);
}

export { DEFAULT_APPEARANCE_SWATCH_ID };
