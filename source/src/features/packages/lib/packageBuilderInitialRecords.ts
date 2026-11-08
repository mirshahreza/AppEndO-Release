import type { CapabilityDbObject } from '../../../core/packages/PackageManifestValidator';

export const REQUIRED_INSTALL_SQL_ENTRY = 'db/install/schema.sql';
export const REQUIRED_UNINSTALL_SQL_ENTRY = 'db/uninstall/schema.sql';
export const OPTIONAL_INSTALL_SQL_ENTRY = 'db/seed/optional-records.sql';
export const OPTIONAL_UNINSTALL_SQL_ENTRY = 'db/uninstall/optional-records.sql';

export type InitialRecordsCaptureTarget = 'required' | 'optional';

export function areSqlScriptsPaired(installSql: string, uninstallSql: string): boolean {
  return installSql.trim().length > 0 === uninstallSql.trim().length > 0;
}

export function buildPackageBuilderDbObjects(input: {
  packageId: string;
  installSql: string;
  uninstallSql: string;
  includeInitialRecords: boolean;
  optionalInstallSql: string;
  optionalUninstallSql: string;
}): CapabilityDbObject[] {
  const objects: CapabilityDbObject[] = [];
  const packageId = input.packageId.trim() || 'package';

  if (input.installSql.trim()) {
    objects.push({
      objectType: 'seed',
      objectName: `${packageId.replace(/[^a-z0-9_]/g, '_').slice(0, 80)}_install`,
      installScript: REQUIRED_INSTALL_SQL_ENTRY,
      uninstallScript: input.uninstallSql.trim() ? REQUIRED_UNINSTALL_SQL_ENTRY : undefined,
      installMode: 'required',
    });
  }

  if (input.includeInitialRecords && input.optionalInstallSql.trim()) {
    objects.push({
      objectType: 'seed',
      objectName: `${packageId.replace(/[^a-z0-9_]/g, '_').slice(0, 80)}_initial_records`,
      installScript: OPTIONAL_INSTALL_SQL_ENTRY,
      uninstallScript: input.optionalUninstallSql.trim() ? OPTIONAL_UNINSTALL_SQL_ENTRY : undefined,
      installMode: 'optional',
    });
  }

  return objects;
}
