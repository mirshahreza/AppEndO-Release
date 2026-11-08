/**
 * Machine-readable ecosystem fixture catalog — historical ecosystem ZIP phase-1 / phase-2 plans
 * Source of truth for fixtures/manifest.json and generate-ecosystem-test-suite.ts
 */
import {
  buildDuplicateUploadZip,
  buildInvalidPluginZip,
  buildInvalidVerticalAppZip,
  buildPackageZipBuffer,
  buildSmokeFailMissingEntryZip,
  buildStudioExportFullSpec,
  buildStudioExportPartialSpec,
  buildStudioFunctionExportSpec,
  buildStudioUploadParitySpec,
  buildVerticalAppZipBuffer,
  plApiAuthMatrixSpec,
  plApiConflictAllowSpec,
  plApiConflictDenySpec,
  plApiConflictOwnerSpec,
  plApiOnlySpec,
  plApiOnlyV11Spec,
  plDbConflictDenySpec,
  plDbConflictOwnerSpec,
  plDbObjectTypesSpec,
  plDbSafeSpec,
  plDbUnsafeSpec,
  plDepBaseSpec,
  plDepChildSpec,
  plFullStackSpec,
  plInstallFailMissingDepSpec,
  plInstallFailMcpConflictSpec,
  plMcpConflictDenySpec,
  plMcpManifestSpec,
  plMcpTransportsSpec,
  plPropsSchemaRefSpec,
  plSmokeFailUnknownSlotSpec,
  plUiConflictAllowSpec,
  plUiConflictDenySpec,
  plUiConflictOwnerSpec,
  plUiDashSpec,
  plUiRoutesSpec,
  plUiSlotSpec,
  vaAutoMiniSpec,
  vaDesignerLayoutsOnlySpec,
  vaExtensionDependencySpec,
  vaOwnerForPathConflictSpec,
  vaPathConflictSpec,
  vaProposeInventorySpec,
  vaReferenceInventorySpec,
  vaRtlJalaliSpec,
} from './ecosystemFixtures';

export type FixtureCategory = 'plugins' | 'vertical-apps' | 'studio-export' | 'negative';

export type EcosystemFixtureEntry = {
  id: string;
  fileName: string;
  category: FixtureCategory;
  /** Subfolder under fixtures/negative/ when category is negative */
  negativeGroup?: 'plugins' | 'vertical-apps';
  scenarioIds: string[];
  expectedUpload: boolean;
  /** When set, upload smoke expects a prior fixture upload (e.g. duplicate version). */
  uploadPrerequisite?: string;
  /** When set, upload smoke reuses a prior fixture artifact (same ZIP bytes). */
  uploadAliasOf?: string;
  /** Override upload routing for studio-export fixtures (default: package). */
  uploadKind?: 'package';
  build: () => Buffer;
  originalName?: string;
};

const SHARED_API_PATH = '/packages/eco-shared-zone/ping';
const SHARED_DB_OBJECT = 'eco_shared_table';
const VA_CONFLICT_PATH = '/eco-va-conflict-path';

function pluginUploadNegatives(): EcosystemFixtureEntry[] {
  const scenarios = [
    'unknown-key',
    'empty-caps',
    'bad-id',
    'bad-integrity',
    'missing-json',
    'zip-slip',
    'non-zip',
  ] as const;

  return scenarios.map((scenario, index) => {
    const built = buildInvalidPluginZip(scenario);
    return {
      id: `NEG-PL-${String(index + 1).padStart(2, '0')}`,
      fileName: built.originalName,
      category: 'negative' as const,
      negativeGroup: 'plugins' as const,
      scenarioIds: index === 0 ? ['SC-F2'] : [],
      expectedUpload: false,
      build: () => built.buffer,
      originalName: built.originalName,
    };
  });
}

function packageLifecycleNegatives(): EcosystemFixtureEntry[] {
  const duplicate = buildDuplicateUploadZip();
  const missingEntry = buildSmokeFailMissingEntryZip();

  return [
    {
      id: 'NEG-PL-08',
      fileName: duplicate.originalName,
      category: 'negative',
      negativeGroup: 'plugins',
      scenarioIds: ['SC-C14'],
      expectedUpload: false,
      uploadPrerequisite: 'PL-01',
      build: () => duplicate.buffer,
      originalName: duplicate.originalName,
    },
    {
      id: 'NEG-PL-09',
      fileName: 'eco-smoke-unknown-slot-1.0.0.zip',
      category: 'negative',
      negativeGroup: 'plugins',
      scenarioIds: ['SC-B10'],
      expectedUpload: true,
      build: () => buildPackageZipBuffer(plSmokeFailUnknownSlotSpec()),
    },
    {
      id: 'NEG-PL-10',
      fileName: missingEntry.originalName,
      category: 'negative',
      negativeGroup: 'plugins',
      scenarioIds: ['SC-F4'],
      expectedUpload: true,
      build: () => missingEntry.buffer,
      originalName: missingEntry.originalName,
    },
    {
      id: 'NEG-PL-11',
      fileName: 'eco-install-missing-dep-1.0.0.zip',
      category: 'negative',
      negativeGroup: 'plugins',
      scenarioIds: ['SC-C11'],
      expectedUpload: true,
      build: () => buildPackageZipBuffer(plInstallFailMissingDepSpec()),
    },
    {
      id: 'NEG-PL-12',
      fileName: 'eco-mcp-conflict-deny-1.0.0.zip',
      category: 'negative',
      negativeGroup: 'plugins',
      scenarioIds: ['SC-C12'],
      expectedUpload: true,
      uploadAliasOf: 'PL-25',
      build: () => buildPackageZipBuffer(plInstallFailMcpConflictSpec()),
    },
  ];
}

function vaNegatives(): EcosystemFixtureEntry[] {
  const scenarios = ['unknown-key', 'bad-kind', 'zip-slip', 'bad-integrity'] as const;
  return scenarios.map((scenario, index) => {
    const built = buildInvalidVerticalAppZip(scenario);
    return {
      id: `NEG-VA-${String(index + 1).padStart(2, '0')}`,
      fileName: built.originalName,
      category: 'negative' as const,
      negativeGroup: 'vertical-apps' as const,
      scenarioIds: ['SC-F3'],
      expectedUpload: false,
      build: () => built.buffer,
      originalName: built.originalName,
    };
  });
}

export const ECOSYSTEM_FIXTURE_CATALOG: EcosystemFixtureEntry[] = [
  // Extension plugins — valid
  {
    id: 'PL-01',
    fileName: 'eco-pl-api-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-B1', 'SC-B7', 'SC-B8', 'SC-B9', 'SC-E1', 'SC-G2', 'SC-G3'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plApiOnlySpec()),
  },
  {
    id: 'PL-02',
    fileName: 'eco-pl-dash-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-B2', 'SC-C13', 'SC-E1', 'SC-E5', 'SC-G4'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plUiDashSpec()),
  },
  {
    id: 'PL-03',
    fileName: 'eco-pl-slot-navigation-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-B3', 'SC-E3', 'SC-E7'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plUiSlotSpec('core.sidebar.navigation')),
  },
  {
    id: 'PL-04',
    fileName: 'eco-pl-slot-sections-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-B3', 'SC-E7'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plUiSlotSpec('core.settings.sections')),
  },
  {
    id: 'PL-05',
    fileName: 'eco-pl-slot-actions-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-B3', 'SC-E7'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plUiSlotSpec('core.toolbar.actions')),
  },
  {
    id: 'PL-06',
    fileName: 'eco-pl-ui-routes-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-B4'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plUiRoutesSpec()),
  },
  {
    id: 'PL-07',
    fileName: 'eco-pl-db-safe-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-B5'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plDbSafeSpec()),
  },
  {
    id: 'PL-08',
    fileName: 'eco-pl-db-unsafe-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-B6'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plDbUnsafeSpec()),
  },
  {
    id: 'PL-09',
    fileName: 'eco-dep-base-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C1', 'SC-C2', 'SC-C4', 'SC-C12'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plDepBaseSpec()),
  },
  {
    id: 'PL-10',
    fileName: 'eco-dep-child-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C1', 'SC-C2', 'SC-C4', 'SC-C13'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plDepChildSpec()),
  },
  {
    id: 'PL-11',
    fileName: 'eco-conflict-owner-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C5', 'SC-C6'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plApiConflictOwnerSpec(SHARED_API_PATH)),
  },
  {
    id: 'PL-12',
    fileName: 'eco-conflict-deny-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C5'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plApiConflictDenySpec(SHARED_API_PATH)),
  },
  {
    id: 'PL-13',
    fileName: 'eco-conflict-allow-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C6'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plApiConflictAllowSpec(SHARED_API_PATH)),
  },
  {
    id: 'PL-14',
    fileName: 'eco-pl-fullstack-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-E4'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plFullStackSpec()),
  },
  {
    id: 'PL-15',
    fileName: 'eco-mcp-owner-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C10'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plMcpManifestSpec()),
  },
  {
    id: 'PL-16',
    fileName: 'eco-ui-conflict-owner-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C7', 'SC-C8'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plUiConflictOwnerSpec()),
  },
  {
    id: 'PL-17',
    fileName: 'eco-ui-conflict-deny-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C7'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plUiConflictDenySpec()),
  },
  {
    id: 'PL-18',
    fileName: 'eco-ui-conflict-allow-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C8'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plUiConflictAllowSpec()),
  },
  {
    id: 'PL-19',
    fileName: 'eco-pl-api-auth-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-G6'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plApiAuthMatrixSpec()),
  },
  {
    id: 'PL-20',
    fileName: 'eco-pl-db-types-1.0.0.zip',
    category: 'plugins',
    scenarioIds: [],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plDbObjectTypesSpec()),
  },
  {
    id: 'PL-21',
    fileName: 'eco-pl-api-1.1.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-G1'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plApiOnlyV11Spec()),
  },
  {
    id: 'PL-22',
    fileName: 'eco-mcp-transports-1.0.0.zip',
    category: 'plugins',
    scenarioIds: [],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plMcpTransportsSpec()),
  },
  {
    id: 'PL-23',
    fileName: 'eco-db-conflict-owner-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C9'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plDbConflictOwnerSpec(SHARED_DB_OBJECT)),
  },
  {
    id: 'PL-24',
    fileName: 'eco-db-conflict-deny-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C9'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plDbConflictDenySpec(SHARED_DB_OBJECT)),
  },
  {
    id: 'PL-25',
    fileName: 'eco-mcp-conflict-deny-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C10'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plMcpConflictDenySpec()),
  },
  {
    id: 'PL-26',
    fileName: 'eco-pl-props-schema-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-G7'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(plPropsSchemaRefSpec()),
  },
  // Vertical apps — valid
  {
    id: 'VA-01',
    fileName: 'eco-va-reference-1.0.0.zip',
    category: 'vertical-apps',
    scenarioIds: ['SC-D4', 'SC-D5', 'SC-E3', 'SC-E4', 'SC-E5'],
    expectedUpload: true,
    build: () => buildVerticalAppZipBuffer(vaReferenceInventorySpec()),
  },
  {
    id: 'VA-02',
    fileName: 'eco-va-auto-mini-1.0.0.zip',
    category: 'vertical-apps',
    scenarioIds: ['SC-D2', 'SC-D5'],
    expectedUpload: true,
    build: () => buildVerticalAppZipBuffer(vaAutoMiniSpec()),
  },
  {
    id: 'VA-03',
    fileName: 'eco-va-designer-only-1.0.0.zip',
    category: 'vertical-apps',
    scenarioIds: ['SC-D3'],
    expectedUpload: true,
    build: () => buildVerticalAppZipBuffer(vaDesignerLayoutsOnlySpec()),
  },
  {
    id: 'VA-04',
    fileName: 'eco-va-propose-1.0.0.zip',
    category: 'vertical-apps',
    scenarioIds: ['SC-D1', 'SC-D7'],
    expectedUpload: true,
    build: () => buildVerticalAppZipBuffer(vaProposeInventorySpec()),
  },
  {
    id: 'VA-05',
    fileName: 'eco-va-rtl-1.0.0.zip',
    category: 'vertical-apps',
    scenarioIds: ['SC-E8'],
    expectedUpload: true,
    build: () => buildVerticalAppZipBuffer(vaRtlJalaliSpec()),
  },
  {
    id: 'VA-06-owner',
    fileName: 'eco-va-owner-1.0.0.zip',
    category: 'vertical-apps',
    scenarioIds: ['SC-D6'],
    expectedUpload: true,
    build: () => buildVerticalAppZipBuffer(vaOwnerForPathConflictSpec(VA_CONFLICT_PATH)),
  },
  {
    id: 'VA-06-conflict',
    fileName: 'eco-va-path-conflict-1.0.0.zip',
    category: 'vertical-apps',
    scenarioIds: ['SC-D6'],
    expectedUpload: true,
    build: () => buildVerticalAppZipBuffer(vaPathConflictSpec(VA_CONFLICT_PATH)),
  },
  {
    id: 'VA-07',
    fileName: 'eco-va-ext-dep-1.0.0.zip',
    category: 'vertical-apps',
    scenarioIds: ['SC-G4', 'SC-G5'],
    expectedUpload: true,
    build: () => buildVerticalAppZipBuffer(vaExtensionDependencySpec()),
  },
  // Studio export fixtures
  {
    id: 'ST-01',
    fileName: 'eco-studio-export-1.0.0.zip',
    category: 'studio-export',
    scenarioIds: ['SC-D8'],
    expectedUpload: true,
    build: () => buildVerticalAppZipBuffer(buildStudioExportFullSpec()),
  },
  {
    id: 'ST-02',
    fileName: 'eco-studio-partial-1.0.0.zip',
    category: 'studio-export',
    scenarioIds: [],
    expectedUpload: true,
    build: () => buildVerticalAppZipBuffer(buildStudioExportPartialSpec()),
  },
  {
    id: 'ST-03',
    fileName: 'eco-studio-fn-export-1.0.0.zip',
    category: 'studio-export',
    scenarioIds: ['SC-D9'],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(buildStudioFunctionExportSpec()),
  },
  {
    id: 'ST-04',
    fileName: 'eco-studio-upload-parity-1.0.0.zip',
    category: 'studio-export',
    scenarioIds: [],
    expectedUpload: true,
    build: () => buildPackageZipBuffer(buildStudioUploadParitySpec()),
  },
  ...pluginUploadNegatives(),
  ...packageLifecycleNegatives(),
  ...vaNegatives(),
];

export type EcosystemScenarioEntry = {
  id: string;
  fixtureIds: string[];
  layer: string;
  phase: 'P0' | 'P1' | 'P2';
};

export const ECOSYSTEM_SCENARIO_CATALOG: EcosystemScenarioEntry[] = [
  { id: 'SC-B1', fixtureIds: ['PL-01'], layer: 'install', phase: 'P0' },
  { id: 'SC-B2', fixtureIds: ['PL-02'], layer: 'runtime', phase: 'P0' },
  { id: 'SC-B3', fixtureIds: ['PL-03', 'PL-04', 'PL-05'], layer: 'runtime', phase: 'P2' },
  { id: 'SC-B4', fixtureIds: ['PL-06'], layer: 'install+runtime', phase: 'P2' },
  { id: 'SC-B5', fixtureIds: ['PL-07'], layer: 'install', phase: 'P2' },
  { id: 'SC-B6', fixtureIds: ['PL-08'], layer: 'install', phase: 'P2' },
  { id: 'SC-B7', fixtureIds: ['PL-01'], layer: 'install', phase: 'P2' },
  { id: 'SC-B8', fixtureIds: ['PL-01'], layer: 'install', phase: 'P2' },
  { id: 'SC-B9', fixtureIds: ['PL-01'], layer: 'install', phase: 'P1' },
  { id: 'SC-B10', fixtureIds: ['NEG-PL-09'], layer: 'install', phase: 'P2' },
  { id: 'SC-C1', fixtureIds: ['PL-10', 'PL-09'], layer: 'install', phase: 'P1' },
  { id: 'SC-C2', fixtureIds: ['PL-09', 'PL-10'], layer: 'install', phase: 'P1' },
  { id: 'SC-C3', fixtureIds: ['PL-09', 'PL-10'], layer: 'install', phase: 'P2' },
  { id: 'SC-C4', fixtureIds: ['PL-09', 'PL-10'], layer: 'install', phase: 'P1' },
  { id: 'SC-C5', fixtureIds: ['PL-11', 'PL-12'], layer: 'install', phase: 'P0' },
  { id: 'SC-C6', fixtureIds: ['PL-11', 'PL-13'], layer: 'install', phase: 'P2' },
  { id: 'SC-C7', fixtureIds: ['PL-16', 'PL-17'], layer: 'install', phase: 'P0' },
  { id: 'SC-C8', fixtureIds: ['PL-16', 'PL-18'], layer: 'install', phase: 'P2' },
  { id: 'SC-C9', fixtureIds: ['PL-23', 'PL-24'], layer: 'install', phase: 'P2' },
  { id: 'SC-C10', fixtureIds: ['PL-15', 'PL-25'], layer: 'install', phase: 'P2' },
  { id: 'SC-C11', fixtureIds: ['NEG-PL-11'], layer: 'install', phase: 'P2' },
  { id: 'SC-C12', fixtureIds: ['NEG-PL-12', 'PL-09'], layer: 'install', phase: 'P2' },
  { id: 'SC-C13', fixtureIds: ['PL-02', 'PL-10'], layer: 'runtime', phase: 'P2' },
  { id: 'SC-C14', fixtureIds: ['NEG-PL-08'], layer: 'upload', phase: 'P2' },
  { id: 'SC-D1', fixtureIds: ['VA-04'], layer: 'install', phase: 'P0' },
  { id: 'SC-D2', fixtureIds: ['VA-02'], layer: 'install', phase: 'P2' },
  { id: 'SC-D3', fixtureIds: ['VA-03'], layer: 'runtime', phase: 'P2' },
  { id: 'SC-D4', fixtureIds: ['VA-01'], layer: 'runtime', phase: 'P2' },
  { id: 'SC-D5', fixtureIds: ['VA-01', 'VA-02'], layer: 'cross', phase: 'P2' },
  { id: 'SC-D6', fixtureIds: ['VA-06-owner', 'VA-06-conflict'], layer: 'install', phase: 'P1' },
  { id: 'SC-D7', fixtureIds: ['VA-04'], layer: 'install', phase: 'P1' },
  { id: 'SC-D8', fixtureIds: ['ST-01'], layer: 'cross', phase: 'P2' },
  { id: 'SC-D9', fixtureIds: ['ST-03'], layer: 'install', phase: 'P2' },
  { id: 'SC-E1', fixtureIds: ['PL-01', 'PL-02'], layer: 'cross', phase: 'P0' },
  { id: 'SC-E3', fixtureIds: ['VA-01', 'PL-03'], layer: 'cross', phase: 'P2' },
  { id: 'SC-E4', fixtureIds: ['PL-14', 'VA-01'], layer: 'cross', phase: 'P2' },
  { id: 'SC-E5', fixtureIds: ['PL-02', 'VA-01'], layer: 'cross', phase: 'P2' },
  { id: 'SC-E7', fixtureIds: ['PL-02', 'PL-03', 'PL-04', 'PL-05'], layer: 'cross', phase: 'P2' },
  { id: 'SC-E8', fixtureIds: ['VA-05'], layer: 'cross', phase: 'P2' },
  { id: 'SC-F2', fixtureIds: ['NEG-PL-01'], layer: 'upload', phase: 'P0' },
  { id: 'SC-F3', fixtureIds: ['NEG-VA-01', 'NEG-VA-02', 'NEG-VA-03', 'NEG-VA-04'], layer: 'upload', phase: 'P2' },
  { id: 'SC-F4', fixtureIds: ['NEG-PL-10'], layer: 'upload', phase: 'P2' },
  { id: 'SC-G1', fixtureIds: ['PL-01', 'PL-21'], layer: 'install', phase: 'P1' },
  { id: 'SC-G2', fixtureIds: ['PL-01'], layer: 'runtime', phase: 'P2' },
  { id: 'SC-G3', fixtureIds: ['PL-01'], layer: 'install', phase: 'P2' },
  { id: 'SC-G4', fixtureIds: ['VA-07', 'PL-02'], layer: 'install', phase: 'P2' },
  { id: 'SC-G5', fixtureIds: ['VA-07'], layer: 'install', phase: 'P2' },
  { id: 'SC-G6', fixtureIds: ['PL-19'], layer: 'runtime', phase: 'P2' },
  { id: 'SC-G7', fixtureIds: ['PL-26'], layer: 'runtime', phase: 'P2' },
];

export function resolveFixtureOutputPath(rootDir: string, entry: EcosystemFixtureEntry): string {
  if (entry.category === 'negative') {
    const group = entry.negativeGroup ?? 'plugins';
    return `${rootDir}/negative/${group}/${entry.fileName}`;
  }
  if (entry.category === 'studio-export') {
    return `${rootDir}/studio-export/${entry.fileName}`;
  }
  return `${rootDir}/${entry.category}/${entry.fileName}`;
}
