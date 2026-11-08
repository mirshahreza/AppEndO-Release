/**
 * Dev helper: lock the login account linked to a Hawiety member (for dossier UI QA).
 * Usage: npx tsx --import ./scripts/tsx-css-register.mjs scripts/dev-lock-hwy-member-user.ts [memberKey] [--unlock]
 */
import { QueryTypes } from 'sequelize';

import { getControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize';

const args = process.argv.slice(2).filter((a) => a !== '--');
const unlock = args.includes('--unlock');
const memberKey = args.find((a) => a !== '--unlock') ?? '630960';

async function main() {
  const sequelize = getControlPlaneSequelize();
  const rows = await sequelize.query<{ id: number; user_id: number | null; username: string }>(
    `SELECT TOP 1 id, user_id, username FROM dbo.hwy_members WHERE id = :id OR username = :key`,
    {
      replacements: { id: Number(memberKey) || 0, key: memberKey },
      type: QueryTypes.SELECT,
    },
  );
  if (!rows.length) {
    console.error(`Member not found: ${memberKey}`);
    process.exit(1);
  }
  const row = rows[0];
  if (!row.user_id) {
    console.error(`Member ${row.id} (${row.username}) has no linked user_id.`);
    process.exit(1);
  }
  const userId = Number(row.user_id);
  const before = await sequelize.query<{ locked: number }>(
    'SELECT locked FROM dbo.base_users WHERE id = :id',
    { replacements: { id: userId }, type: QueryTypes.SELECT },
  );
  console.log(`Member ${row.id} (${row.username}) → user ${userId}, locked before: ${before[0]?.locked ?? '?'}`);
  if (unlock) {
    await sequelize.query(
      `UPDATE dbo.base_users SET locked = 0, unlocked_at = SYSUTCDATETIME() WHERE id = :id`,
      { replacements: { id: userId }, type: QueryTypes.UPDATE },
    );
  } else {
    await sequelize.query(
      `UPDATE dbo.base_users SET locked = 1, locked_at = SYSUTCDATETIME(), login_fail_count = 0 WHERE id = :id`,
      { replacements: { id: userId }, type: QueryTypes.UPDATE },
    );
  }
  const after = await sequelize.query<{ locked: number }>(
    'SELECT locked FROM dbo.base_users WHERE id = :id',
    { replacements: { id: userId }, type: QueryTypes.SELECT },
  );
  console.log(`Locked after: ${after[0]?.locked ?? '?'}`);
  console.log(unlock ? 'Account unlocked.' : 'Account locked — refresh the member dossier to see the badge.');
  await sequelize.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
