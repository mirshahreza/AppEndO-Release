import type { AppBootResponse } from '../api/contracts/boot/types';
import type { PlatformRuntimeConfig } from '../api/contracts/platform/types';
import {
  HAWIETY_MOUNT_PATH_PREFIX,
  HAWIETY_PACKAGE_ID,
  HAWIETY_PORTAL_SEGMENT,
} from '../../core/packages/hawietyPackage';

export function isHawietyPackageEnabledOnBoot(boot: AppBootResponse | undefined): boolean {
  return boot?.enabledPackages?.includes(HAWIETY_PACKAGE_ID) ?? false;
}

/** True when boot/runtime config exposes the Hawiety mount (package installed + deployment applied). */
export function isHawietyPortalInRuntimeConfig(config: PlatformRuntimeConfig | undefined): boolean {
  if (!config?.mounts?.length) return false;
  return config.mounts.some(
    (mount) =>
      mount.id === HAWIETY_PORTAL_SEGMENT
      || mount.pathPrefix === HAWIETY_MOUNT_PATH_PREFIX
      || mount.pathPrefix?.endsWith(HAWIETY_MOUNT_PATH_PREFIX),
  );
}

export function isHawietyPublicPathname(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments.includes(HAWIETY_PORTAL_SEGMENT);
}
