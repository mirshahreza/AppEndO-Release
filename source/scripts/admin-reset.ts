import path from 'node:path';
import { Pool } from 'pg';
import { initControlPlanePool, closeControlPlanePool } from '../src/server/db/controlPlane';
import { readControlPlaneDatabaseSettings } from '../src/server/db/controlPlaneDatabase';
import {
  bindPrismaToPgPool,
  closePrismaControlPlane,
  initPrismaControlPlane,
} from '../src/server/db/prismaControlPlane';
import { readPgPoolConfigFromSettings } from '../src/server/setup/installDatabase';
import {
  findAuthUserByUsername,
  updateUserPasswordHash,
  unlockUser,
  revokeUserRefreshTokens,
} from '../src/server/domain/users/userRepository';
import { hashPassword } from '../src/server/utils/bcryptAsync';
import { generateRandomPassword } from '../src/server/utils/usersHelpers';

const printUsage = () => {
  console.log(`Reset a control-plane user's password and clear any account lockout.

Usage:
  npm run install:adminreset
  npm run install:adminreset -- admin "NewP@ss123"
  npx tsx scripts/admin-reset.ts --username admin --password "NewP@ss123"

Options:
  --username <name>   Target username (default: admin)
  --password <value>  New password (min 8 chars). If omitted, a random
                       password is generated and printed once.
`);
};

const parseArgs = (argv: string[]) => {
  const args: { username?: string; password?: string } = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--username') args.username = argv[++i];
    else if (token === '--password') args.password = argv[++i];
    else if (token && !token.startsWith('-')) positional.push(token);
  }
  // npm treats `--username` / `--password` as its own config flags, so
  // `npm run install:adminreset -- --username admin --password x` often
  // arrives here as positional `admin x`. Accept that form too.
  if (!args.username && positional[0]) args.username = positional[0];
  if (!args.password && positional[1]) args.password = positional[1];
  return args;
};

const main = async () => {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  const { username = 'admin', password } = parseArgs(process.argv.slice(2));

  if (password && password.length < 8) {
    console.error('[install:adminreset] --password must be at least 8 characters.');
    process.exit(1);
  }

  const newPassword = password || generateRandomPassword();

  const settingsPath = path.join(process.cwd(), 'settings.json');
  const dbSettings = readControlPlaneDatabaseSettings(settingsPath);
  const usePrisma = dbSettings.engine === 'prisma' || dbSettings.provider !== 'postgresql';

  let pool: Pool | undefined;

  try {
    if (usePrisma) {
      const init = await initPrismaControlPlane(settingsPath);
      pool = init.pgPool;
      if (pool) {
        initControlPlanePool(pool);
      }
    } else {
      pool = new Pool({
        ...readPgPoolConfigFromSettings(settingsPath),
        max: 10,
        idleTimeoutMillis: 30000,
      });
      initControlPlanePool(pool);
      await pool.query('SELECT 1');
      await bindPrismaToPgPool(pool);
    }

    const user = await findAuthUserByUsername(username);
    if (!user) {
      console.error(`[install:adminreset] No user found with username "${username}".`);
      process.exit(1);
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await updateUserPasswordHash(passwordHash, user.id);
    await unlockUser(null, user.id);
    await revokeUserRefreshTokens(user.id);

    console.log(`[install:adminreset] Password reset for "${username}" (id=${user.id}).`);
    console.log('[install:adminreset] Account unlocked and failed-login counter cleared.');
    console.log('[install:adminreset] Existing sessions/refresh tokens revoked.');
    if (!password) {
      console.log(`[install:adminreset] Generated password: ${newPassword}`);
      console.log('[install:adminreset] Store this securely — it will not be shown again.');
    }
  } finally {
    await closePrismaControlPlane();
    if (pool) {
      await closeControlPlanePool(pool);
    }
  }
};

main().catch((error) => {
  console.error('[install:adminreset] failed:', error?.message || error);
  process.exit(1);
});
