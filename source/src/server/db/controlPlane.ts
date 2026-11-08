import type { Pool } from 'pg';

const GLOBAL_POOL_KEY = '__appendControlPlanePool' as const;

type GlobalPoolHost = typeof globalThis & {
  [GLOBAL_POOL_KEY]?: Pool;
};

let cpPool: Pool | undefined;

const readGlobalPool = (): Pool | undefined =>
  (globalThis as GlobalPoolHost)[GLOBAL_POOL_KEY];

const writeGlobalPool = (pool: Pool | undefined): void => {
  (globalThis as GlobalPoolHost)[GLOBAL_POOL_KEY] = pool;
};

const resolveActivePool = (): Pool | undefined => cpPool ?? readGlobalPool();

export const isControlPlanePoolReady = (): boolean => resolveActivePool() !== undefined;

export const initControlPlanePool = (pool: Pool): void => {
  cpPool = pool;
  writeGlobalPool(pool);
};

export const getControlPlanePool = (): Pool => {
  const pool = resolveActivePool();
  if (!pool) {
    throw new Error('Control plane pool is not initialized.');
  }
  cpPool = pool;
  return pool;
};

/** When `expectedPool` is passed, only close if it is still the active pool (avoids install races). */
export const closeControlPlanePool = async (expectedPool?: Pool): Promise<void> => {
  const active = resolveActivePool();
  if (!active) {
    return;
  }
  if (expectedPool && active !== expectedPool) {
    return;
  }
  cpPool = undefined;
  writeGlobalPool(undefined);
  // Prisma shutdown may have already ended this pool when both share the same pg instance.
  if (active.ending) {
    return;
  }
  await active.end();
};
