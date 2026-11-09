import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { readControlPlaneDatabaseSettings } from '../src/server/db/controlPlaneDatabase';
import {
  CONTROL_PLANE_SCHEMA_PUSH_DESTRUCTIVE_ENV,
  pushControlPlaneSchema,
  reconcilePrismaClientAfterSchemaOperation,
} from '../src/server/db/controlPlaneSchemaPush';

const USAGE = `
Sync the AppEndO control-plane schema (Prisma models → live database).

Safe default (recommended on customer / project instances):
  npm run db:sync-schema

This uses prisma migrate diff and applies only additive / Prisma-owned changes.
Tables that exist in the database but are NOT in prisma/schema.prisma are left
untouched — including domain/package tables (hwy_*, ETL maps, and any other
non-Prisma objects). Extra columns on those tables are also left alone.

Do NOT run raw \`prisma db push --accept-data-loss\` (or the old npm run prisma:push
behavior) on a database that holds vertical-app data. That command DROPS every
table that is not in the Prisma schema and has caused production data loss.

Dangerous opt-in (drops unknown tables — install wipe / explicit operator consent):
  npm run db:sync-schema -- --destructive
  ${CONTROL_PLANE_SCHEMA_PUSH_DESTRUCTIVE_ENV}=1 npm run db:sync-schema

Optional extra table lists:
  CONTROL_PLANE_SCHEMA_PROTECTED_TABLES=foo,bar   never drop these names
  CONTROL_PLANE_SCHEMA_ALLOW_DROP_TABLES=old_tmp  allow standalone DROP of these names only

Non-Prisma layers (Sequelize features, hwy_*, cms_*) — canonical upgrade:
  npm run schema:install-extensions
  npm run schema:install-extensions -- --hwy   (SQL Server + Hawiety)

Greenfield / empty databases still receive the full control-plane schema.
`.trim();

const parseArgs = (argv: string[]): { help: boolean; destructive: boolean } => {
  const args = argv.filter((arg) => arg !== '--');
  return {
    help: args.includes('--help') || args.includes('-h'),
    destructive: args.includes('--destructive'),
  };
};

const main = () => {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log(USAGE);
    return;
  }

  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  if (flags.destructive) {
    process.env[CONTROL_PLANE_SCHEMA_PUSH_DESTRUCTIVE_ENV] = '1';
    console.log(`Syncing control-plane schema (${settings.provider}) with DESTRUCTIVE prisma db push...`);
  } else {
    console.log(
      `Syncing control-plane schema (${settings.provider}) — additive apply; `
      + 'tables not in the Prisma schema are left untouched.',
    );
  }

  const restore = pushControlPlaneSchema(settings, { destructive: flags.destructive });
  restore();
  reconcilePrismaClientAfterSchemaOperation(settings);

  console.log('Control-plane schema sync completed.');
};

try {
  main();
} catch (error) {
  console.error('sync-control-plane-schema failed:', (error as Error)?.message || error);
  process.exit(1);
}
