import { Pool } from 'pg';
import { toPgPoolConfig } from '../src/server/config/env';
import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { initControlPlanePool, closeControlPlanePool } from '../src/server/db/controlPlane';
import { bindPrismaToPgPool } from '../src/server/db/prismaControlPlane';
import { ensureControlPlaneInitialized } from '../src/server/db/controlPlaneInit';
import { prisma } from '../src/server/domain/users/prismaHelpers';

const main = async () => {
  const pool = new Pool(toPgPoolConfig());
  initControlPlanePool(pool);

  try {
    await pool.query('SELECT 1');
    await bindPrismaToPgPool(pool);
    await ensureControlPlaneInitialized(SETTINGS_PATH);

    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    const users = await prisma().baseUser.findMany({
      take: 5,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        email: true,
        userRoles: { select: { roleName: true } },
      },
    });

    console.log('Database initialized successfully.');
    console.log('Tables:', tables.rows.map((x) => x.table_name));
    console.log('Seed users:', users.map((user) => ({
      id: String(user.id),
      email: user.email,
      roles: user.userRoles.map((role) => role.roleName),
    })));
  } finally {
    await closeControlPlanePool(pool);
  }
};

main().catch((error) => {
  console.error('db:init failed:', error?.message || error);
  process.exit(1);
});
