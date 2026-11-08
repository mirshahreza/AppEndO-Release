import {
  acquirePackageLock,
  appendPackageEvent,
  readPackageIndex,
  releasePackageLock,
  writePackageIndex,
} from '../../../core/packages/PackageFileStore';
import type { PackageIndex } from '../../../core/packages/PackageFileStore';

export interface PackageLockGateway {
  acquireIndexLock(): boolean;
  acquirePackageLock(packageId: string): boolean;
  releaseLock(lockKey: string): void;
}

export interface PackageEventGateway {
  append(event: Parameters<typeof appendPackageEvent>[0]): void;
}

export interface PackageIndexGateway {
  read(): PackageIndex;
  touch(): void;
}

export const createPackageLockGateway = (): PackageLockGateway => ({
  acquireIndexLock: () => acquirePackageLock('index'),
  acquirePackageLock: (packageId: string) => acquirePackageLock(`package-${packageId}`),
  releaseLock: (lockKey: string) => releasePackageLock(lockKey),
});

export const createPackageEventGateway = (): PackageEventGateway => ({
  append: (event) => appendPackageEvent(event),
});

export const createPackageIndexGateway = (): PackageIndexGateway => ({
  read: () => readPackageIndex(),
  touch: () => writePackageIndex(readPackageIndex()),
});
