/**
 * Prisma control-plane provider smoke harness (p-45 PRM-0).
 *
 * Usage:
 *   npm run prisma:smoke -- sqlite
 *   npm run prisma:smoke -- postgresql
 *   npm run prisma:smoke -- sqlserver   (requires local MSSQL + DATABASE_URL)
 */
import os from 'os';
import path from 'path';

import {
  buildSqliteControlPlaneUrl,
  removeSqliteControlPlaneFiles,
  type ControlPlaneDatabaseSettings,
} from '../src/server/db/controlPlaneDatabase';
import {
  pushControlPlaneSchema,
  restoreDefaultPrismaGenerate,
} from '../src/server/db/controlPlaneSchemaPush';
import {
  ROLE_ID_SEQUENCE_START,
  USER_ID_SEQUENCE_START,
} from '../src/core/db/database';

const providerArg = (process.argv[2] ?? 'sqlite').trim().toLowerCase();

const resolveSettings = (): ControlPlaneDatabaseSettings => {
  switch (providerArg) {
    case 'sqlite': {
      const filePath = path.join(os.tmpdir(), `appendo-prisma-smoke-${Date.now()}.db`);
      return {
        provider: 'sqlite',
        url: buildSqliteControlPlaneUrl(filePath),
        engine: 'prisma',
      };
    }
    case 'postgresql':
    case 'postgres': {
      const url = process.env.DATABASE_URL?.trim();
      if (!url) {
        throw new Error('Set DATABASE_URL for postgresql smoke.');
      }
      return { provider: 'postgresql', url, engine: 'prisma' };
    }
    case 'mysql': {
      const url = process.env.DATABASE_URL?.trim();
      if (!url) {
        throw new Error('Set DATABASE_URL for mysql smoke.');
      }
      return { provider: 'mysql', url, engine: 'prisma' };
    }
    case 'sqlserver':
    case 'mssql': {
      const url = process.env.DATABASE_URL?.trim();
      if (!url) {
        throw new Error('Set DATABASE_URL for sqlserver smoke.');
      }
      return { provider: 'sqlserver', url, engine: 'prisma' };
    }
    default:
      throw new Error(`Unsupported smoke provider: ${providerArg}`);
  }
};

const seedSmokeUser = async (): Promise<void> => {
  const { getPrismaControlPlane } = await import('../src/server/db/prismaControlPlane');
  const client = getPrismaControlPlane();

  for (const role of [
    { id: BigInt(ROLE_ID_SEQUENCE_START), name: 'ADMIN', note: 'System administrator' },
    { id: BigInt(ROLE_ID_SEQUENCE_START + 1), name: 'DEVELOPER', note: 'Developer access to platform APIs' },
  ]) {
    await client.baseRole.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  const user = await client.baseUser.upsert({
    where: { username: 'prisma_smoke' },
    update: {},
    create: {
      id: BigInt(USER_ID_SEQUENCE_START),
      username: 'prisma_smoke',
      email: 'prisma-smoke@appendo.local',
      passwordHash: 'hash',
      isBuiltin: false,
      locked: 0,
    },
  });

  await client.baseUserRole.upsert({
    where: { userId_roleName: { userId: user.id, roleName: 'DEVELOPER' } },
    update: {},
    create: { userId: user.id, roleName: 'DEVELOPER' },
  });
};

const main = async (): Promise<void> => {
  const settings = resolveSettings();
  console.log(`[prisma:smoke] provider=${settings.provider}`);

  const restoreSchema = pushControlPlaneSchema(settings);

  try {
    const { initPrismaControlPlaneFromSettings, closePrismaControlPlane, getPrismaControlPlane } = await import(
      '../src/server/db/prismaControlPlane'
    );

    await initPrismaControlPlaneFromSettings(settings);
    await seedSmokeUser();

    const found = await getPrismaControlPlane().baseUser.findFirst({
      where: { email: 'prisma-smoke@appendo.local' },
      select: { username: true },
    });
    if (!found || found.username !== 'prisma_smoke') {
      throw new Error('Prisma user read smoke failed.');
    }

    console.log('[prisma:smoke] OK — schema push + user read');
    await closePrismaControlPlane();
  } finally {
    restoreSchema();
    restoreDefaultPrismaGenerate();
  }

  if (settings.provider === 'sqlite') {
    removeSqliteControlPlaneFiles(settings.url);
  }
};

main().catch((error) => {
  console.error('[prisma:smoke] FAILED', error);
  process.exit(1);
});
