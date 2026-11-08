import { Pool } from 'pg';
import { initDB } from '../src/core/db/database';
import { toPgPoolConfig } from '../src/server/config/env';

const main = async () => {
  const pool = new Pool(toPgPoolConfig());

  try {
    await pool.query('SELECT 1');
    console.log('[db-reset] Clearing user data...');

    await pool.query('DELETE FROM base_user_roles');
    await pool.query('DELETE FROM base_user_profiles');
    await pool.query('DELETE FROM base_otp_challenges');
    await pool.query('DELETE FROM base_auth_refresh_tokens');
    await pool.query('DELETE FROM base_logs_auth_audit');
    await pool.query('UPDATE base_info SET created_by = NULL, updated_by = NULL');
    await pool.query('UPDATE base_roles SET created_by = NULL, updated_by = NULL');
    await pool.query('UPDATE base_logs_app SET created_by = NULL, updated_by = NULL');
    await pool.query('DELETE FROM base_users');

    console.log('[db-reset] Re-initializing schema and seed...');
    await initDB(pool);

    const count = await pool.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM base_users');
    const sample = await pool.query(`
      SELECT
        u.username,
        u.email,
        p.firstname,
        p.lastname,
        p.person_type_code,
        p.nickname,
        (p.profile_image_body IS NOT NULL) AS has_profile_image
      FROM base_users u
      LEFT JOIN base_user_profiles p ON p.user_id = u.id
      WHERE u.is_builtin = false
      ORDER BY u.id
      LIMIT 5
    `);

    console.log('[db-reset] Done. User count:', count.rows[0]?.c);
    console.log('[db-reset] Sample users:', sample.rows);
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error('[db-reset] failed:', error?.message || error);
  process.exit(1);
});
