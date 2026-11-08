/**
 * p-49 install wizard API smoke — full run from capabilities → complete.
 * Usage: npx tsx scripts/p49-install-smoke.ts [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:3000';

const db = {
  provider: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'AppEnd',
  username: 'postgres',
  password: '1',
  encrypt: true,
  trustServerCertificate: true,
  overrideExistingObjects: true,
  seedSampleData: true,
};

async function post(path: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const steps: Array<[string, string, Record<string, unknown>]> = [
    ['capabilities', '/api/install/capabilities', { capabilities: ['service', 'platform', 'worker'], nodeName: 'node-1' }],
    ['database/save', '/api/install/database/save', db],
    ['database/init', '/api/install/database/init', {}],
    ['cache/save', '/api/install/cache/save', { driver: 'memory' }],
    [
      'email/save',
      '/api/install/email/save',
      {
        smtpHost: 'smtp.son.ir',
        smtpPort: 587,
        smtpUser: 'm.mirshahreza',
        smtpPass: 'P#ssC0de',
        smtpFromEmail: 'm.mirshahreza@son.ir',
        smtpFromName: 'AppEndO',
        smtpSecure: false,
        skipVerification: true,
      },
    ],
    [
      'admin',
      '/api/install/admin',
      {
        username: 'Admin',
        email: 'm.mirshahreza@son.ir',
        password: 'MyP#ssC0de',
        confirmPassword: 'MyP#ssC0de',
        firstName: 'Sys',
        lastName: 'Admin',
      },
    ],
    ['complete', '/api/install/complete', {}],
  ];

  for (const [name, path, body] of steps) {
    console.log(`→ ${name}`);
    const result = await post(path, body);
    console.log(`  ${result.status}`, JSON.stringify(result.data).slice(0, 240));
    if (!result.ok || result.data.success === false) {
      process.exitCode = 1;
      throw new Error(`Step failed: ${name}`);
    }
  }

  console.log('OK — full install completed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(process.exitCode ?? 1);
});
