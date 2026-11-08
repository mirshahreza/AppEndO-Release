import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'fs';

const settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
const ds = settings.dataSources.find((d: { isDefault?: boolean }) => d.isDefault) ?? settings.dataSources[0];
const pool = new Pool({
  host: ds.host,
  port: ds.port,
  database: ds.database,
  user: ds.username,
  password: ds.password,
});

const res = await pool.query(
  `SELECT u.id, u.username, u.email, u.password_hash, u.email_verified_at, u.is_builtin
   FROM base_users u
   INNER JOIN base_user_roles ur ON ur.user_id = u.id
   WHERE ur.role_name = 'ADMIN'
   ORDER BY u.id
   LIMIT 3`,
);

console.log('Admin users:', JSON.stringify(res.rows, null, 2));

for (const row of res.rows) {
  for (const testPwd of ['admin123', 'Admin123', 'password', '1', '123456']) {
    const ok = bcrypt.compareSync(testPwd, row.password_hash);
    if (ok) console.log(`MATCH: user=${row.username} password=${testPwd}`);
  }
}

await pool.end();
