import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CapabilityDbObject } from './PackageManifestValidator';
import type { VerticalAppDeploymentRoute } from '../../shared/api/contracts/package-manifest/verticalApp';
import {
  HAWIETY_MOUNT_PATH_PREFIX,
  HAWIETY_PACKAGE_ID,
  HAWIETY_PACKAGE_NAME,
  HAWIETY_PACKAGE_VERSION,
  HAWIETY_PORTAL_SEGMENT,
  isHawietyHostPageKey,
  isHawietyRoutePattern,
} from './hawietyPackage';
import type { VerticalAppPackageSpec } from './testkit/verticalAppPackageBuilder';
import { buildHwyCultureKeysEn } from '../../../scripts/hwy-phase3/hwyCultureKeysCatalog';
import { findLegacyEdgeParityPackSqlOrderIssues } from '../../domain/hwy/hwyLegacyEdgeParityPackSql';

export const HAWIETY_CULTURE_KEYS_ENTRY = 'culture/keys.json';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const hwyInstallSqlDir = path.join(repoRoot, 'scripts/hwy-phase1/db/install');
const hwyUninstallSchemaPath = path.join(repoRoot, 'scripts/hwy-phase1/db/uninstall/hwy_schema.sqlserver.sql');
const routeBindingsDir = path.join(repoRoot, 'workspace/platform-registry/route-bindings');

/** Core Studio pages re-exported into the package runtime (host modules stay build-time deps). */
export const HAWIETY_CORE_UI_PAGE_EXPORTS: Array<{ pageKey: string; title: string; modulePath: string }> = [
  { pageKey: 'hwy-etl-console', title: 'ETL Console', modulePath: '@/features/hwy-etl-console/HwyEtlConsolePage' },
  {
    pageKey: 'hwy-business-rules-reference',
    title: 'Business rules reference',
    modulePath: '@/features/hwy-business-rules-reference/HwyBusinessRulesReferencePage',
  },
  {
    pageKey: 'hwy-identity-components',
    title: 'Identity components catalog',
    modulePath: '@/features/hwy-identity-components/HwyIdentityComponentsPage',
  },
  {
    pageKey: 'hwy-org-membership-transfer',
    title: 'Org membership transfer',
    modulePath: '@/features/hwy-org-membership-transfer/HwyOrgMembershipTransferPage',
  },
  {
    pageKey: 'hwy-geo-responsibility',
    title: 'Geo responsibility',
    modulePath: '@/features/hwy-geo-responsibility/HwyGeoResponsibilityPage',
  },
  {
    pageKey: 'hwy-card-flow',
    title: 'Badge management',
    modulePath: '@/features/hwy-card-flow/HwyCardFlowPage',
  },
  {
    pageKey: 'hwy-meetings-management',
    title: 'Meetings management',
    modulePath: '@/features/hwy-meetings/HwyMeetingsManagementPage',
  },
  {
    pageKey: 'hwy-employees-list',
    title: 'Employees list',
    modulePath: '@/features/hwy-employees-list/HwyEmployeesListPage',
  },
  {
    pageKey: 'hwy-payment-documents',
    title: 'Payment documents',
    modulePath: '@/features/hwy-payment-documents/HwyPaymentDocumentsPage',
  },
  {
    pageKey: 'hwy-payment-documents-members',
    title: 'Grant receipt details',
    modulePath: '@/features/hwy-payment-documents-members/HwyPaymentDocumentsMembersPage',
  },
  {
    pageKey: 'hwy-masoolin-performance',
    title: 'Masoolin performance',
    modulePath: '@/features/hwy-masoolin-performance/HwyMasoolinPerformancePage',
  },
  {
    pageKey: 'hwy-members-social-screens',
    title: 'Social screens',
    modulePath: '@/features/hwy-members-social-screens/HwyMembersSocialScreensPage',
  },
  {
    pageKey: 'hwy-courses-activities',
    title: 'Courses & activities',
    modulePath: '@/features/hwy-courses-activities/HwyCoursesActivitiesPage',
  },
  {
    pageKey: 'hwy-targhin-requests',
    title: 'Targhin admin',
    modulePath: '@/features/hwy-targhin-admin/HwyMemberTarghinAdminPage',
  },
  {
    pageKey: 'hwy-phone-requests',
    title: 'Phone requests',
    modulePath: '@/features/hwy-phone-requests-admin/HwyMemberPhoneRequestsAdminPage',
  },
  {
    pageKey: 'hwy-members-targhin',
    title: 'Targhin members',
    modulePath: '@/features/hwy-members-targhin/HwyMemberTarghinMembersListPage',
  },
  {
    pageKey: 'hwy-member-dossier',
    title: 'Member dossier',
    modulePath: '@/features/hwy-member-dossier/HwyMemberDossierPage',
  },
  {
    pageKey: 'hwy-member-dossier-view',
    title: 'Member dossier (view)',
    modulePath: '@/features/hwy-member-dossier/HwyMemberDossierViewPage',
  },
  {
    pageKey: 'hwy-member-dossier-edit',
    title: 'Member dossier (edit)',
    modulePath: '@/features/hwy-member-dossier/HwyMemberDossierEditPage',
  },
];

function hawietyUiPageStubSource(modulePath: string): string {
  const exportName = modulePath.split('/').pop()?.replace(/\.tsx?$/, '') ?? 'Page';
  return `export { ${exportName} as default } from '${modulePath}';\n`;
}

export function buildHawietyUiSourceFiles(): Array<{ entry: string; source: string }> {
  return HAWIETY_CORE_UI_PAGE_EXPORTS.map((page) => {
    const fileStem = page.pageKey.replace(/-/g, '_');
    return {
      entry: `ui/pages/${fileStem}.tsx`,
      source: hawietyUiPageStubSource(page.modulePath),
    };
  });
}

export function buildHawietyCultureKeys(): Record<string, string> {
  return {
    'nav.group.hawiety': 'Hawiety',
    ...buildHwyCultureKeysEn(),
  };
}

const SQL_INSTALL_PRIORITY = [
  'hwy_schema.sqlserver.sql',
  'hwy_member_phone_requests.sqlserver.sql',
  'hwy_geo_responsibility.sqlserver.sql',
  'hwy_courses_activities.sqlserver.sql',
  'hwy_registration_state_columns.sqlserver.sql',
  'hwy_nakhebin_phone_columns.sqlserver.sql',
  'hwy_member_after_create_columns.sqlserver.sql',
  'hwy_member_kasb_links.sqlserver.sql',
  'hwy_institutes_logo_url.sqlserver.sql',
  'hwy_institutes_logo_content.sqlserver.sql',
  'hwy_db_functions_geo_member.sqlserver.sql',
  'hwy_member_registration_files_unified.sqlserver.sql',
  'hwy_db_procedures_writes.sqlserver.sql',
  'hwy_db_procedures_writes_drafts.sqlserver.sql',
  'hwy_db_procedures_writes_member.sqlserver.sql',
  'hwy_db_procedures_writes_membership.sqlserver.sql',
  'hwy_db_procedures_reads.sqlserver.sql',
  'hwy_db_procedures_reads_misc.sqlserver.sql',
  'hwy_db_procedures_reads_geo.sqlserver.sql',
  'hwy_db_procedures_reads_geo_nomination.sqlserver.sql',
  'hwy_db_procedures_reads_targhin.sqlserver.sql',
  'hwy_activities_tajammoat_columns.sqlserver.sql',
  'hwy_db_procedures_reads_courses.sqlserver.sql',
  'hwy_db_procedures_reads_dossier.sqlserver.sql',
  'hwy_db_procedures_reads_employees.sqlserver.sql',
  'hwy_member_stat_columns.sqlserver.sql',
  'hwy_member_pipeline_snake_columns.sqlserver.sql',
  'hwy_pipeline_member_pascal_compat.sqlserver.sql',
  'hwy_member_stats_recalc_support.sqlserver.sql',
  'hwy_member_passed_necessary_dorat.sqlserver.sql',
  'hwy_legacy_edge_parity_table_rename.sqlserver.sql',
  'hwy_legacy_edge_parity_column_rename.sqlserver.sql',
  'hwy_member_stats_recalc.sqlserver.sql',
  'hwy_legacy_edge_pipeline_compat.sqlserver.sql',
  'hwy_legacy_edge_area_limit_agg_functions.sqlserver.sql',
  'hwy_geo_responsibility_member_area_limits.sqlserver.sql',
  'hwy_ref_mirror_members_gender_limits.sqlserver.sql',
  'hwy_ref_mirror_pipeline_reference.sqlserver.sql',
  'vw_hwy_members_legacy_row.sqlserver.sql',
  'hwy_members_drop_oath_row_columns.sqlserver.sql',
  'vw_hwy_members_no_admin.sqlserver.sql',
  'hwy_legacy_pipeline_views.sqlserver.sql',
  'hwy_legacy_edge_function_retire.sqlserver.sql',
  'hwy_member_card_flow_columns.sqlserver.sql',
  'hwy_candidate_pipeline_indexes.sqlserver.sql',
  'hwy_candidate_pipeline.sqlserver.sql',
  'hwy_card_flow.sqlserver.sql',
  'hwy_members_legacy_pascal_retire.sqlserver.sql',
  'hwy_members_drop_pascal_computed_aliases.sqlserver.sql',
  'hwy_meetings.sqlserver.sql',
  'hwy_member_masooliat_star_columns.sqlserver.sql',
  'hwy_members_chief_masool_rename.sqlserver.sql',
  'hwy_finance_greenfield_compat.sqlserver.sql',
  'hwy_finance_ref_compat.sqlserver.sql',
  'hwy_finance_edge_table_rename.sqlserver.sql',
  'hwy_finance_edge_column_rename.sqlserver.sql',
  'hwy_finance_edge_functions.sqlserver.sql',
  'hwy_db_procedures_finance_payment.sqlserver.sql',
  'hwy_db_procedures_reads_finance.sqlserver.sql',
  'hwy_db_procedures_writes_finance.sqlserver.sql',
  'hwy_db_views_finance_payment.sqlserver.sql',
  'hwy_db_procedures_finance_masoolin_process.sqlserver.sql',
  'hwy_db_views_finance_masoolin.sqlserver.sql',
  'hwy_db_procedures_finance_masoolin.sqlserver.sql',
  'hwy_db_procedures_finance_deferred.sqlserver.sql',
  'hwy_db_procedures_finance_legacy_retire.sqlserver.sql',
  'vw_hwy_members.sqlserver.sql',
  'hwy_geo_responsibility_montadhemin_sql.sqlserver.sql',
  'hwy_geo_sql_functions.sqlserver.sql',
  'hwy_geo_rename_region_maktab.sqlserver.sql',
  'base_info_title_path.sqlserver.sql',
] as const;

export function listHawietyPackageDbInstallFiles(): string[] {
  if (!fs.existsSync(hwyInstallSqlDir)) return [];
  const onDisk = fs
    .readdirSync(hwyInstallSqlDir)
    .filter((name) => name.endsWith('.sqlserver.sql'));
  const priority = SQL_INSTALL_PRIORITY.filter((name) => onDisk.includes(name));
  const rest = onDisk.filter((name) => !priority.includes(name)).sort();
  const ordered = [...priority, ...rest];
  const parityIssues = findLegacyEdgeParityPackSqlOrderIssues(ordered);
  if (parityIssues.length > 0) {
    throw new Error(`Hawiety package DB install order: ${parityIssues.join('; ')}`);
  }
  return ordered;
}

export function buildHawietyPackageDbObjects(): CapabilityDbObject[] {
  return listHawietyPackageDbInstallFiles().map((fileName, index) => {
    const installScript = `db/install/${fileName}`;
    const objectName = fileName.replace(/\.sqlserver\.sql$/i, '');
    const objectType: CapabilityDbObject['objectType'] =
      index === 0 ? 'table' : fileName.startsWith('vw_') ? 'view' : 'function';
    return {
      objectType,
      objectName,
      installScript,
      uninstallScript: index === 0 ? 'db/uninstall/hwy_schema.sqlserver.sql' : undefined,
    };
  });
}

function normalizeMountRelativeRoute(routePattern: string): string {
  const trimmed = routePattern.trim().replace(/^\/+/, '');
  if (trimmed.startsWith(`${HAWIETY_PORTAL_SEGMENT}/`)) {
    return trimmed.slice(HAWIETY_PORTAL_SEGMENT.length + 1);
  }
  return trimmed;
}

export function collectHawietyDeploymentRoutesFromRegistry(): VerticalAppDeploymentRoute[] {
  if (!fs.existsSync(routeBindingsDir)) return [];
  const seen = new Set<string>();
  const routes: VerticalAppDeploymentRoute[] = [];

  for (const fileName of fs.readdirSync(routeBindingsDir)) {
    if (!fileName.endsWith('.json')) continue;
    const raw = JSON.parse(fs.readFileSync(path.join(routeBindingsDir, fileName), 'utf8')) as {
      routePattern?: string;
      pageKey?: string;
      nav?: VerticalAppDeploymentRoute['nav'];
      enabled?: boolean;
    };
    if (raw.enabled === false) continue;
    if (!raw.pageKey || !raw.routePattern) continue;
    if (!isHawietyHostPageKey(raw.pageKey) && !isHawietyRoutePattern(raw.routePattern)) continue;
    const routePattern = normalizeMountRelativeRoute(raw.routePattern);
    const dedupeKey = `${routePattern}::${raw.pageKey}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    routes.push({
      routePattern,
      pageKey: raw.pageKey,
      nav: raw.nav ?? undefined,
    });
  }

  routes.sort((a, b) => a.routePattern.localeCompare(b.routePattern));
  return routes;
}

export type HawietyPackageUiPackaging = 'host-stub' | 'prebuilt-bundle';

export type HawietyPrecompiledUiFileSpec = {
  pageKey: string;
  path: string;
  content: string;
};

export function buildHawietyVerticalAppPackageSpec(options?: {
  uiPackaging?: HawietyPackageUiPackaging;
  precompiledUiFiles?: HawietyPrecompiledUiFileSpec[];
}): VerticalAppPackageSpec {
  const uiPackaging = options?.uiPackaging ?? 'host-stub';
  const precompiled = options?.precompiledUiFiles ?? [];
  const precompiledByPageKey = new Map(precompiled.map((file) => [file.pageKey, file]));

  const pages = HAWIETY_CORE_UI_PAGE_EXPORTS.map((page) => {
    const bundled = precompiledByPageKey.get(page.pageKey);
    const fileStem = page.pageKey.replace(/-/g, '_');
    return {
      pageKey: page.pageKey,
      title: page.title,
      entry: bundled?.path ?? `ui/pages/${fileStem}.tsx`,
    };
  });
  const corePageKeys = new Set(pages.map((page) => page.pageKey));
  const routesFromRegistry = collectHawietyDeploymentRoutesFromRegistry().filter((route) =>
    corePageKeys.has(route.pageKey),
  );
  const defaultRoutePatterns: Record<string, string> = {
    'hwy-etl-console': 'etl-console',
    'hwy-business-rules-reference': 'business-rules/*',
    'hwy-identity-components': 'identity-components/*',
    'hwy-org-membership-transfer': 'members-org-membership-transfer',
    'hwy-geo-responsibility': 'geo-responsibility/*',
    'hwy-card-flow': 'card-flow/*',
    'hwy-meetings-management': 'meetings-management',
    'hwy-employees-list': 'employees-list',
    'hwy-payment-documents': 'finance/payment-documents',
    'hwy-payment-documents-members': 'finance/payment-documents-members',
    'hwy-masoolin-performance': 'masoolin-performance',
    'hwy-members-social-screens': 'members-social-screens',
    'hwy-courses-activities': 'courses-activities/*',
    'hwy-targhin-requests': 'targhin-requests/*',
    'hwy-members-targhin': 'members-targhin/*',
    'hwy-member-dossier-view': 'members-all/view/*',
    'hwy-member-dossier-edit': 'members-all/edit/*',
  };
  const routes = routesFromRegistry.length > 0
    ? routesFromRegistry
    : pages.map((page, index) => ({
        routePattern: defaultRoutePatterns[page.pageKey] ?? page.pageKey.replace(/^hwy-/, ''),
        pageKey: page.pageKey,
        nav: { label: page.title, order: index + 1 },
      }));

  const dbObjects = buildHawietyPackageDbObjects();
  const uiSourceFiles =
    uiPackaging === 'prebuilt-bundle'
      ? precompiled.map((file) => ({ path: file.path, content: file.content }))
      : buildHawietyUiSourceFiles().map((file) => ({
          path: file.entry,
          content: file.source,
        }));

  if (uiPackaging === 'prebuilt-bundle' && uiSourceFiles.length !== HAWIETY_CORE_UI_PAGE_EXPORTS.length) {
    throw new Error(
      `Hawiety prebuilt UI packaging requires ${HAWIETY_CORE_UI_PAGE_EXPORTS.length} bundled page(s); got ${uiSourceFiles.length}.`,
    );
  }

  const extraFiles: VerticalAppPackageSpec['extraFiles'] = [
    {
      path: HAWIETY_CULTURE_KEYS_ENTRY,
      content: `${JSON.stringify(buildHawietyCultureKeys(), null, 2)}\n`,
    },
    ...uiSourceFiles,
  ];

  for (const fileName of listHawietyPackageDbInstallFiles()) {
    extraFiles.push({
      path: `db/install/${fileName}`,
      content: fs.readFileSync(path.join(hwyInstallSqlDir, fileName), 'utf8'),
    });
  }
  if (fs.existsSync(hwyUninstallSchemaPath)) {
    extraFiles.push({
      path: 'db/uninstall/hwy_schema.sqlserver.sql',
      content: fs.readFileSync(hwyUninstallSchemaPath, 'utf8'),
    });
  }

  extraFiles.push({
    path: 'api/health.js',
    content: `module.exports = async function handler(_req, res) {
  return res.json({ success: true, packageId: '${HAWIETY_PACKAGE_ID}', dataPolicy: 'etl-not-seed' });
};
`,
  });

  extraFiles.push({
    path: 'ui/shell/AppShell.js',
    content: `export default function hawietyShell() {
  return { type: 'div', props: { 'data-shell': '${HAWIETY_PORTAL_SEGMENT}' }, children: 'Hawiety portal shell' };
}
`,
  });

  return {
    packageId: HAWIETY_PACKAGE_ID,
    name: HAWIETY_PACKAGE_NAME,
    version: HAWIETY_PACKAGE_VERSION,
    pathPrefix: HAWIETY_MOUNT_PATH_PREFIX,
    description: 'Hawiety membership portal — schema via install; member data via ETL only.',
    createdBy: 'AppEndO',
    applyPolicy: 'propose',
    defaultRoute: routes.find((r) => r.pageKey === 'hwy-members-all')?.routePattern ?? 'members-all',
    experienceConfig: {
      locale: 'iq',
      calendar: 'gregorian',
      direction: 'rtl',
      timezone: 'Asia/Baghdad',
    },
    pages,
    routes: routes.length > 0 ? routes : [
      { routePattern: 'members-all', pageKey: 'hwy-members-all', nav: { label: 'All People', order: 1 } },
      { routePattern: 'etl-console', pageKey: 'hwy-etl-console', nav: { label: 'ETL Console', order: 99 } },
    ],
    apis: [
      {
        id: 'hawiety.health',
        method: 'GET',
        path: '/packages/hawiety/health',
        entry: 'api/health.js',
        auth: 'public',
      },
    ],
    dbObjects,
    extraFiles,
  };
}
