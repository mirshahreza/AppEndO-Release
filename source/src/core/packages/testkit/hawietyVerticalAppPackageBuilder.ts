import type { VerticalAppPackageSpec } from './verticalAppPackageBuilder';
import {
  buildVerticalAppManifest,
  buildVerticalAppZipBuffer,
} from './verticalAppPackageBuilder';

/** p-15 Hawiety vertical-app stub — schema + ETL API contract, no member seed data. */
export const HAWIETY_VERTICAL_APP_SPEC: VerticalAppPackageSpec = {
  packageId: 'hawiety',
  name: 'Hawiety',
  version: '0.1.0',
  pathPrefix: '/hawiety',
  description:
    'Hawiety (هویتی) membership portal — installable vertical-app stub (p-15). Data via ETL only.',
  createdBy: 'AppEndO',
  applyPolicy: 'propose',
  defaultRoute: 'members-all',
  experienceConfig: {
    locale: 'iq',
    calendar: 'gregorian',
    direction: 'rtl',
    timezone: 'Asia/Baghdad',
  },
  branding: {
    logoAssetKey: 'logo',
  },
  designerLayouts: [
    {
      slug: 'hwy-members-all',
      title: 'All People',
      entry: 'ui/layouts/hwy_members_all.js',
    },
  ],
  pages: [
    {
      pageKey: 'hwy-etl-console',
      title: 'ETL Console',
      entry: 'ui/pages/hwy_etl_console.js',
    },
  ],
  routes: [
    {
      routePattern: 'members-all',
      pageKey: 'hwy-members-all',
      nav: { label: 'All People', group: 'Hawiety', order: 1 },
    },
    {
      routePattern: 'etl-console',
      pageKey: 'hwy-etl-console',
      nav: { label: 'ETL Console', group: 'Hawiety', order: 99 },
    },
  ],
  apis: [
    {
      id: 'hawiety.health',
      method: 'GET',
      path: '/packages/hawiety/health',
      entry: 'api/health.js',
      auth: 'public',
    },
    {
      id: 'hawiety.etl.status',
      method: 'GET',
      path: '/packages/hawiety/etl/status',
      entry: 'api/etl_status.js',
      auth: 'authenticated',
    },
  ],
  dbObjects: [
    {
      objectType: 'table',
      objectName: 'hwy_etl_geo_map',
      installScript: 'db/install/hwy_etl_geo_map.sql',
      uninstallScript: 'db/uninstall/hwy_etl_geo_map.sql',
    },
  ],
  staticAssets: [
    {
      assetKey: 'logo',
      path: 'assets/logo.svg',
      mime: 'image/svg+xml',
      public: true,
    },
  ],
  extraFiles: [
    {
      path: 'db/install/hwy_etl_geo_map.sql',
      content: `-- Hawiety package install (p-15 stub) — ETL map table only, no member seed.
IF OBJECT_ID(N'dbo.hwy_etl_geo_map', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.hwy_etl_geo_map (
    legacy_kind            NVARCHAR(64)  NOT NULL,
    legacy_id              BIGINT        NOT NULL,
    legacy_secondary_id    BIGINT        NOT NULL CONSTRAINT DF_hwy_etl_geo_map_sec DEFAULT (0),
    base_info_id           BIGINT        NOT NULL,
    CONSTRAINT PK_hwy_etl_geo_map PRIMARY KEY (legacy_kind, legacy_id, legacy_secondary_id)
  );
END
`,
    },
    {
      path: 'db/uninstall/hwy_etl_geo_map.sql',
      content: `-- Hawiety package uninstall (p-15 stub)
IF OBJECT_ID(N'dbo.hwy_etl_geo_map', N'U') IS NOT NULL
  DROP TABLE dbo.hwy_etl_geo_map;
`,
    },
    {
      path: 'assets/logo.svg',
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Hawiety">
  <rect width="64" height="64" rx="12" fill="#0f766e"/>
  <path d="M32 14c-6 0-11 4-11 9s5 9 11 9 11-4 11-9-5-9-11-9zm-14 28c0-4 6-7 14-7s14 3 14 7v4H18v-4z" fill="#fff"/>
</svg>
`,
    },
    {
      path: 'api/health.js',
      content: `module.exports = async function handler(_req, res) {
  return res.json({
    success: true,
    packageId: 'hawiety',
    status: 'ok',
    dataPolicy: 'etl-not-seed',
  });
};
`,
    },
    {
      path: 'api/etl_status.js',
      content: `module.exports = async function handler(_req, res) {
  return res.json({
    success: true,
    packageId: 'hawiety',
    etlReady: true,
    seededMemberRows: false,
  });
};
`,
    },
    {
      path: 'ui/layouts/hwy_members_all.js',
      content: `export default function HwyMembersAllLayout() {
  return {
    type: 'div',
    props: { 'data-layout': 'hwy-members-all', 'data-package': 'hawiety' },
    children: 'Hawiety members list (designer layout stub)',
  };
}
`,
    },
    {
      path: 'ui/pages/hwy_etl_console.js',
      content: `export default function HwyEtlConsolePage() {
  return {
    type: 'div',
    props: { 'data-page': 'hwy-etl-console', 'data-package': 'hawiety' },
    children: 'Hawiety ETL console (no seed on install)',
  };
}
`,
    },
    {
      path: 'ui/shell/AppShell.js',
      content: `export default function hawietyShell() {
  return {
    type: 'div',
    props: { 'data-shell': 'hawiety', 'data-surface': 'portal' },
    children: 'Hawiety portal shell',
  };
}
`,
    },
  ],
};

export function buildHawietyVerticalAppManifest(artifactHash?: string) {
  return buildVerticalAppManifest(HAWIETY_VERTICAL_APP_SPEC, artifactHash);
}

export function buildHawietyVerticalAppZipBuffer(): Buffer {
  return buildVerticalAppZipBuffer(HAWIETY_VERTICAL_APP_SPEC);
}
