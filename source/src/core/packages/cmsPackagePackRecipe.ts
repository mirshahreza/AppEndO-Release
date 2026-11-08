/** CMS packing recipe for Package Builder — schema files + seed capture presets.
 * CMS REST operations live in `capabilities.edge_apis`, not `capabilities.apis`.
 */

export const CMS_SCHEMA_INSTALL_POSTGRES = 'cms-phase1/db/install/cms_schema.sql';
export const CMS_SCHEMA_INSTALL_SQLSERVER = 'cms-phase1/db/install/cms_schema.sqlserver.sql';
export const CMS_SCHEMA_UNINSTALL_POSTGRES = 'cms-phase1/db/uninstall/cms_schema.sql';
export const CMS_SCHEMA_UNINSTALL_SQLSERVER = 'cms-phase1/db/uninstall/cms_schema.sqlserver.sql';

/** Matches `CMS_BASE_INFO_ROOT_TITLE` in `src/server/domain/cms-package-seed/cmsBaseInfoCatalog.ts` */
export const CMS_PACKAGE_VOCAB_ROOT_TITLE = 'CMS';

export const CMS_CONTENT_RELATED_TABLES = [
  'cms_content_revisions',
  'cms_content_assets',
  'cms_content_tags',
  'cms_content_relations',
  'cms_settings',
] as const;

export const CMS_PACKAGE_VOCAB_CAPTURE = {
  tableName: 'base_info',
  where: `(title = '${CMS_PACKAGE_VOCAB_ROOT_TITLE}' OR title_en = '${CMS_PACKAGE_VOCAB_ROOT_TITLE}')`,
  parentColumn: 'parent_id',
  includeDescendants: true,
  includeBinary: false,
} as const;

export const CMS_PACKAGE_CONTENT_CAPTURE = {
  tableName: 'cms_contents',
  relatedTables: [...CMS_CONTENT_RELATED_TABLES],
  parentColumn: 'parent_content_id',
  includeDescendants: true,
  includeBinary: true,
} as const;

export function cmsSchemaInstallPath(sourceType: string): string | null {
  const normalized = sourceType.trim().toLowerCase();
  if (normalized.includes('postgres')) return CMS_SCHEMA_INSTALL_POSTGRES;
  if (normalized.includes('sql server') || normalized.includes('mssql')) return CMS_SCHEMA_INSTALL_SQLSERVER;
  return null;
}

export function cmsSchemaUninstallPath(sourceType: string): string | null {
  const normalized = sourceType.trim().toLowerCase();
  if (normalized.includes('postgres')) return CMS_SCHEMA_UNINSTALL_POSTGRES;
  if (normalized.includes('sql server') || normalized.includes('mssql')) return CMS_SCHEMA_UNINSTALL_SQLSERVER;
  return null;
}
