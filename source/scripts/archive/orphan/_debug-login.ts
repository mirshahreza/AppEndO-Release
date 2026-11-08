import { Pool } from 'pg';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
const ds = settings.dataSources.find((d: { isDefault?: boolean }) => d.isDefault) ?? settings.dataSources[0];
const pool = new Pool({
  host: ds.host,
  port: ds.port,
  database: ds.database,
  user: ds.username,
  password: ds.password,
});

const authSection = await pool.query(
  `SELECT value FROM base_settings_sections WHERE section_key = 'auth' LIMIT 1`,
);
console.log('auth settings:', JSON.stringify(authSection.rows[0]?.value ?? null, null, 2));

const admin = await pool.query<{ password_hash: string }>(
  `SELECT password_hash FROM base_users WHERE username = 'admin' LIMIT 1`,
);
const hash = admin.rows[0]?.password_hash ?? '';
console.log('hash prefix:', hash.slice(0, 7));

// Simulate configureAdmin update with a known password and verify round-trip
const testPassword = 'InstallTest!234';
const testHash = bcrypt.hashSync(testPassword, 10);
await pool.query(
  `UPDATE base_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE username = 'admin'`,
  [testHash],
);
const verify = await pool.query<{ password_hash: string }>(
  `SELECT password_hash FROM base_users WHERE username = 'admin' LIMIT 1`,
);
console.log('round-trip bcrypt works:', bcrypt.compareSync(testPassword, verify.rows[0].password_hash));

await pool.end();
