import { Pool } from 'pg';
import { SEED_USER_COUNT } from '../src/core/db/database';
import { toPgPoolConfig } from '../src/server/config/env';

const main = async () => {
  const pool = new Pool(toPgPoolConfig());

  try {
    const users = await pool.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM base_users');
    const roles = await pool.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM base_user_roles');
    const profiles = await pool.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM base_user_profiles');
    const images = await pool.query<{ c: number }>(`
      SELECT COUNT(*)::int AS c
      FROM base_user_profiles
      WHERE profile_image_body IS NOT NULL AND profile_image_body_xs IS NOT NULL
    `);
    const personTypes = await pool.query(`
      SELECT person_type_code, COUNT(*)::int AS count
      FROM base_user_profiles
      GROUP BY person_type_code
      ORDER BY person_type_code
    `);
    const admin = await pool.query(`
      SELECT u.username, u.email, ur.role_name, p.person_type_code,
             (p.profile_image_body IS NOT NULL) AS has_image
      FROM base_users u
      LEFT JOIN base_user_roles ur ON ur.user_id = u.id
      LEFT JOIN base_user_profiles p ON p.user_id = u.id
      WHERE u.is_builtin = true
    `);

    const userCount = users.rows[0]?.c ?? 0;
    const ok = userCount === SEED_USER_COUNT
      && (profiles.rows[0]?.c ?? 0) === SEED_USER_COUNT
      && (images.rows[0]?.c ?? 0) === SEED_USER_COUNT;

    console.log('[verify-seed] users:', userCount, `(expected ${SEED_USER_COUNT})`);
    console.log('[verify-seed] roles:', roles.rows[0]?.c);
    console.log('[verify-seed] profiles:', profiles.rows[0]?.c);
    console.log('[verify-seed] profiles with images:', images.rows[0]?.c);
    console.log('[verify-seed] person types:', personTypes.rows);
    console.log('[verify-seed] admin:', admin.rows[0]);
    console.log(ok ? '[verify-seed] OK' : '[verify-seed] FAILED');

    if (!ok) process.exit(1);
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error('[verify-seed] failed:', error?.message || error);
  process.exit(1);
});
