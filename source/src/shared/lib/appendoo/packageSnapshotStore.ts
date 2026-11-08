import type { PackageSnapshot } from '../../api/contracts/appendoo/promotion.types';

/** In-memory package snapshot store for post-DEPLOYED validation (Phase 19). */
export class PackageSnapshotStore {
  private snapshots = new Map<string, PackageSnapshot>();

  save(snapshot: PackageSnapshot): PackageSnapshot {
    this.snapshots.set(snapshot.snapshotId, snapshot);
    return snapshot;
  }

  read(snapshotId: string): PackageSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  resetForTests(): void {
    this.snapshots.clear();
  }
}

export const packageSnapshotStore = new PackageSnapshotStore();
