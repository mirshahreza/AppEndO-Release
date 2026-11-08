import 'dotenv/config';

import { defineConfig } from 'prisma/config';

const resolveDatabaseUrl = (): string =>
  process.env.DATABASE_URL?.trim()
  || 'postgresql://postgres:postgres@localhost:5432/appendo_prisma_generate';

/**
 * Prisma CLI configuration (p-45 PRM-1).
 * Runtime adapters are created in src/server/db/prismaControlPlane.ts.
 *
 * Provider matrix (v1 control plane):
 * - postgresql — primary dev/prod (schema provider below)
 * - mysql      — set DATABASE_URL + swap schema provider to `mysql` for push/migrate smoke
 * - sqlite     — file:./data/appendo-control.db
 * - sqlserver  — encrypt/trustServerCertificate in connection string
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
