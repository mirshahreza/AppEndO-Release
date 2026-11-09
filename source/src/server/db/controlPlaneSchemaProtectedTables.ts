import {
  CONTROL_PLANE_SCHEMA_PROTECTED_TABLE_NAMES,
  isNonPrismaProtectedTableName,
} from '../../config/controlPlaneSchemaOwnership';
import {
  CONTROL_PLANE_SCHEMA_PROTECTED_TABLES_ENV,
  parseCommaSeparatedTableNames,
  readSchemaDiffTableNameListsFromEnv,
} from './controlPlaneSchemaDiff';

export { isNonPrismaProtectedTableName };

/** Default belt-and-suspenders names plus env CONTROL_PLANE_SCHEMA_PROTECTED_TABLES. */
export const resolveControlPlaneSchemaProtectedTables = (
  env: NodeJS.ProcessEnv = process.env,
): Set<string> => {
  const fromEnv = readSchemaDiffTableNameListsFromEnv(env).protectedTables;
  const merged = new Set<string>([
    ...CONTROL_PLANE_SCHEMA_PROTECTED_TABLE_NAMES.map((n) => n.toLowerCase()),
    ...fromEnv,
  ]);
  return merged;
};

/** Document env var for operators (sync-control-plane-schema help text). */
export const controlPlaneSchemaProtectedTablesEnvKey = CONTROL_PLANE_SCHEMA_PROTECTED_TABLES_ENV;
