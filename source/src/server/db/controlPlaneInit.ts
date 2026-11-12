import { closePrismaControlPlane, initPrismaControlPlane, isPrismaControlPlaneReady } from './prismaControlPlane';
import { readControlPlaneDatabaseSettings } from './controlPlaneDatabase';
import { pushControlPlaneSchema, reconcilePrismaClientAfterSchemaOperation } from './controlPlaneSchemaPush';
import { seedControlPlaneReferenceData, type ControlPlaneSeedOptions } from './controlPlaneSeed';
import { ensureControlPlaneRuntimePatches } from './controlPlaneRuntimePatches';

let controlPlaneInitPromise: Promise<void> | null = null;

type ControlPlaneInitOptions = ControlPlaneSeedOptions & {
  /** When false, skip additive schema sync (schema already present). */
  pushSchema?: boolean;
  /** Install-time empty SQL Server: use prisma db push (migrate-diff execute is brittle on greenfield). */
  sqlServerGreenfieldPush?: boolean;
};

export function resetControlPlaneInitState(): void {
  controlPlaneInitPromise = null;
}

const ensurePrismaReadyForControlPlaneInit = async (settingsPath: string): Promise<void> => {
  if (isPrismaControlPlaneReady()) {
    return;
  }

  await initPrismaControlPlane(settingsPath);
};

const runControlPlaneInit = async (
  settingsPath: string,
  options: ControlPlaneInitOptions = {},
): Promise<void> => {
  const settings = readControlPlaneDatabaseSettings(settingsPath);
  const shouldPush = options.pushSchema !== false;
  let restoreSchema: (() => void) | undefined;

  // SQLite holds an exclusive writer lock — close the adapter before `prisma db push`.
  if (shouldPush && settings.provider === 'sqlite' && isPrismaControlPlaneReady()) {
    await closePrismaControlPlane();
  }

  if (shouldPush && settings.provider === 'sqlite') {
    restoreSchema = pushControlPlaneSchema(settings);
    await initPrismaControlPlane(settingsPath);
  } else if (shouldPush && settings.provider === 'sqlserver') {
    if (isPrismaControlPlaneReady()) {
      await closePrismaControlPlane();
    }
    restoreSchema = pushControlPlaneSchema(settings, {
      destructive: options.sqlServerGreenfieldPush === true,
    });
    await ensurePrismaReadyForControlPlaneInit(settingsPath);
  } else {
    await ensurePrismaReadyForControlPlaneInit(settingsPath);
    if (shouldPush) {
      restoreSchema = pushControlPlaneSchema(settings);
    }
  }

  const patchRestore = await ensureControlPlaneRuntimePatches(settings, { force: shouldPush });
  if (patchRestore) {
    restoreSchema = patchRestore;
  }

  try {
    await seedControlPlaneReferenceData({ seedSampleData: options.seedSampleData });
  } finally {
    restoreSchema?.();
    if (shouldPush || restoreSchema) {
      reconcilePrismaClientAfterSchemaOperation(settings);
    }
  }
};

/** Idempotent control-plane bootstrap: Prisma schema push + reference/sample seed (p-45 PRM-4). */
export async function ensureControlPlaneInitialized(
  settingsPath: string,
  options: ControlPlaneInitOptions = {},
): Promise<void> {
  if (controlPlaneInitPromise && !isPrismaControlPlaneReady()) {
    resetControlPlaneInitState();
  }

  // Re-run when schema must be pushed (greenfield / reinstall) — stale resolved promises skip db push.
  if (controlPlaneInitPromise && options.pushSchema !== false) {
    resetControlPlaneInitState();
  }

  if (!controlPlaneInitPromise) {
    controlPlaneInitPromise = runControlPlaneInit(settingsPath, options).catch((error) => {
      controlPlaneInitPromise = null;
      throw error;
    });
  }

  await controlPlaneInitPromise;
}
