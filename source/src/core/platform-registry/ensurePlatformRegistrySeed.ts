import {
  ensurePlatformRegistryDirs,
  platformRegistryIsSeeded,
  touchPlatformRegistryIndex,
  withPlatformRegistryLock,
} from './PlatformRegistryFileStore';
import { copyPlatformRegistryDefaults } from './platformRegistryDefaults';

export function ensurePlatformRegistrySeed(): void {
  ensurePlatformRegistryDirs();
  if (platformRegistryIsSeeded()) {
    return;
  }

  withPlatformRegistryLock(() => {
    if (platformRegistryIsSeeded()) {
      return;
    }

    copyPlatformRegistryDefaults();
    touchPlatformRegistryIndex();
  });
}
