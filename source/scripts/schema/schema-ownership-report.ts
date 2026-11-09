/**
 * Report live dbo objects against schema ownership layers.
 *
 *   npm run schema:ownership-report
 *   npm run schema:ownership-report -- --json
 */
import {
  CONTROL_PLANE_NON_PRISMA_TABLE_PREFIXES,
  CONTROL_PLANE_SCHEMA_OWNERSHIP_LAYERS,
  isNonPrismaProtectedTableName,
} from '../../src/config/controlPlaneSchemaOwnership';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized } from '../../src/server/db/controlPlaneInit';
import { listPrismaMappedTableNames } from '../../src/server/db/controlPlaneSchemaDiff';
import { readControlPlaneDatabaseSettings } from '../../src/server/db/controlPlaneDatabase';
import { getControlPlaneSequelize } from '../../src/server/db/controlPlaneSequelize';
import fs from 'fs';
import path from 'path';
import { QueryTypes } from 'sequelize';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';

const jsonOnly = process.argv.includes('--json');

const main = async (): Promise<void> => {
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const { provider } = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  if (provider !== 'sqlserver') {
    throw new Error(`schema:ownership-report currently supports sqlserver only (got ${provider}).`);
  }
  const prismaTables = listPrismaMappedTableNames(
    fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8'),
  );

  const sequelize = getControlPlaneSequelize();
  const tableRows = await sequelize.query<{ name: string }>(
    `SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo') ORDER BY name`,
    { type: QueryTypes.SELECT },
  );
  const viewRows = await sequelize.query<{ name: string }>(
    `SELECT name FROM sys.views WHERE schema_id = SCHEMA_ID(N'dbo') ORDER BY name`,
    { type: QueryTypes.SELECT },
  );
  const procRows = await sequelize.query<{ name: string }>(
    `
    SELECT name FROM sys.procedures
    WHERE schema_id = SCHEMA_ID(N'dbo') AND is_ms_shipped = 0
    ORDER BY name
    `,
    { type: QueryTypes.SELECT },
  );
  const tableNames = tableRows.map((r) => r.name);
  const viewNames = viewRows.map((r) => r.name);
  const procedureNames = procRows.map((r) => r.name);

  const byOwner: Record<string, string[]> = {
    prisma: [],
    'non-prisma-prefix': [],
    'base-other': [],
  };

  for (const name of tableNames) {
    const lower = name.toLowerCase();
    if (prismaTables.has(lower)) {
      byOwner.prisma.push(name);
      continue;
    }
    if (isNonPrismaProtectedTableName(lower)) {
      byOwner['non-prisma-prefix'].push(name);
      continue;
    }
    if (lower.startsWith('base_')) {
      byOwner['base-other'].push(name);
      continue;
    }
    byOwner['base-other'].push(name);
  }

  const countByPrefixes = (names: string[]): Record<string, number> => (
    Object.fromEntries(
      CONTROL_PLANE_NON_PRISMA_TABLE_PREFIXES.map((prefix) => [
        prefix,
        names.filter((n) => n.toLowerCase().startsWith(prefix)).length,
      ]),
    )
  );

  const prefixCounts = countByPrefixes(tableNames);
  const viewPrefixCounts = countByPrefixes(viewNames);
  const hwyProcedureCount = procedureNames.filter((n) => n.toLowerCase().startsWith('hwy_')).length;

  const report = {
    provider,
    tableCount: tableNames.length,
    viewCount: viewNames.length,
    procedureCount: procedureNames.length,
    hwyProcedureCount,
    layers: CONTROL_PLANE_SCHEMA_OWNERSHIP_LAYERS.map((layer) => ({
      id: layer.id,
      title: layer.title,
      upgradeCommand: layer.upgradeCommand,
      source: layer.source,
    })),
    classification: {
      prismaMappedTableCount: byOwner.prisma.length,
      nonPrismaPrefixTableCount: byOwner['non-prisma-prefix'].length,
      otherTableCount: byOwner['base-other'].length,
      prefixCounts,
      viewPrefixCounts,
    },
    sampleOtherTables: byOwner['base-other'].slice(0, 25),
    sampleViews: viewNames.filter((n) => isNonPrismaProtectedTableName(n.toLowerCase())).slice(0, 20),
  };

  if (jsonOnly) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`[schema:ownership-report] provider=${provider} dbo tables=${report.tableCount} views=${report.viewCount} procs=${report.procedureCount}`);
  console.log(`  Prisma-mapped tables: ${report.classification.prismaMappedTableCount}`);
  console.log(`  Non-Prisma prefix tables: ${report.classification.nonPrismaPrefixTableCount}`);
  console.log(`  Other tables (Sequelize features, CMS, misc): ${report.classification.otherTableCount}`);
  console.log(`  dbo.hwy_* procedures: ${report.hwyProcedureCount}`);
  console.log('  Table prefix counts:', prefixCounts);
  console.log('  View prefix counts:', viewPrefixCounts);
  console.log('\nUpgrade paths:');
  for (const layer of report.layers) {
    console.log(`  [${layer.id}] ${layer.upgradeCommand}`);
    console.log(`    source: ${layer.source}`);
  }
  if (report.sampleOtherTables.length > 0) {
    console.log('\nSample “other” tables (not in schema.prisma):');
    console.log(`  ${report.sampleOtherTables.join(', ')}`);
  }
  if (report.sampleViews.length > 0) {
    console.log('\nSample protected views:');
    console.log(`  ${report.sampleViews.join(', ')}`);
  }
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[schema:ownership-report] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
    await getControlPlaneSequelize().close().catch(() => undefined);
  });
