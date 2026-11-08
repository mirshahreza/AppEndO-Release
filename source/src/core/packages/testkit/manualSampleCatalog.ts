/**
 * Phase-1 manual QA sample catalog — historical ecosystem ZIP phase-1 plan
 * Consumed by scripts/generate-packages-samples.ts → plugins-samples/
 */
import {
  buildInvalidPluginZip,
  buildPackageZipBuffer,
  buildVerticalAppZipBuffer,
  plApiConflictDenySpec,
  plApiConflictOwnerSpec,
  plApiOnlySpec,
  plApiOnlyV11Spec,
  plDepBaseSpec,
  plDepChildSpec,
  plUiConflictDenySpec,
  plUiConflictOwnerSpec,
  plUiDashSpec,
  vaOwnerForPathConflictSpec,
  vaPathConflictSpec,
  vaProposeInventorySpec,
} from './ecosystemFixtures';
import type { PackageZipSpec } from './packageZipBuilder';
import type { VerticalAppPackageSpec } from './verticalAppPackageBuilder';

const SHARED_API_PATH = '/packages/eco-shared-zone/ping';
const VA_CONFLICT_PATH = '/eco-va-conflict-path';

export type ManualSampleCategory = 'plugins' | 'vertical-apps' | 'negative';

export type ManualSampleEntry = {
  id: string;
  fileName: string;
  category: ManualSampleCategory;
  negativeGroup?: 'plugins' | 'vertical-apps';
  scenarioIds: string[];
  expectedUpload: boolean;
  manualQaFa: string;
  build: () => Buffer;
};

export type ManualScenarioGuide = {
  id: string;
  priority: 'P0' | 'P1';
  titleFa: string;
  fixtureIds: string[];
  stepsFa: string[];
  verifyFa: string[];
};

function qaFile(content: string): Array<{ path: string; content: string }> {
  return [{ path: 'MANUAL-QA.md', content }];
}

function withPluginQa(spec: PackageZipSpec, manualQaFa: string): PackageZipSpec {
  return {
    ...spec,
    description: manualQaFa.slice(0, 1000),
    extraFiles: qaFile(manualQaFa),
  };
}

function withVaQa(spec: VerticalAppPackageSpec, manualQaFa: string): VerticalAppPackageSpec {
  return {
    ...spec,
    description: manualQaFa.slice(0, 1000),
    extraFiles: [...(spec.extraFiles ?? []), ...qaFile(manualQaFa)],
  };
}

export const PHASE1_MANUAL_SCENARIO_GUIDE: ManualScenarioGuide[] = [
  {
    id: 'SC-B1',
    priority: 'P0',
    titleFa: 'Install API-only extension',
    fixtureIds: ['PL-01'],
    stepsFa: [
      'In Plugins, upload plugins/eco-pl-api-1.0.0.zip.',
      'Install the eco-pl-api plugin.',
    ],
    verifyFa: [
      'installed/enabled status appears in the Plugins grid.',
      'GET /api/packages/eco-pl-api/health → { success: true }',
      'The plugin details description field shows the MANUAL-QA guidance.',
    ],
  },
  {
    id: 'SC-B2',
    priority: 'P0',
    titleFa: 'Dashboard widget in slot',
    fixtureIds: ['PL-02'],
    stepsFa: [
      'Upload and install plugins/eco-pl-dash-1.0.0.zip.',
      'Open the main Admin dashboard.',
    ],
    verifyFa: [
      'Widget eco-pl-dash-widget renders in slot core.dashboard.widgets.',
      'In the DOM: data-package-id="eco-pl-dash" and data-component-key="eco-pl-dash-widget".',
    ],
  },
  {
    id: 'SC-D1',
    priority: 'P0',
    titleFa: 'Vertical App with propose → apply',
    fixtureIds: ['VA-04'],
    stepsFa: [
      'Upload vertical-apps/eco-va-propose-1.0.0.zip.',
      'Install — deployment should be pending.',
      'From the UI, confirm Apply Deployment / approve the proposed deployment.',
    ],
    verifyFa: [
      'After Install: deploymentStatus = pending.',
      'After Apply: deploymentStatus = applied.',
      'File packages-storage/deployments/eco-va-propose.deployment-applied.json is created.',
    ],
  },
  {
    id: 'SC-E1',
    priority: 'P0',
    titleFa: 'Theme plus two extensions',
    fixtureIds: ['TH-01', 'PL-01', 'PL-02'],
    stepsFa: [
      'Activate the admin-light theme (SC-A1).',
      'Install both the API and Dashboard extensions.',
    ],
    verifyFa: [
      'Theme stays active.',
      'Both plugins are installed.',
      'API health and dashboard widget both work.',
    ],
  },
  {
    id: 'SC-C5',
    priority: 'P0',
    titleFa: 'API conflict with policy=deny',
    fixtureIds: ['PL-11', 'PL-12'],
    stepsFa: [
      'Upload and install eco-conflict-owner-1.0.0.zip first.',
      'Then upload eco-conflict-deny-1.0.0.zip.',
      'Install the second package.',
    ],
    verifyFa: [
      'Owner install succeeds.',
      'Deny install must be rejected with conflict_denied.',
      'Shared path: GET /api/packages/eco-shared-zone/ping',
    ],
  },
  {
    id: 'SC-C7',
    priority: 'P0',
    titleFa: 'UI slot conflict with policy=deny',
    fixtureIds: ['PL-16', 'PL-17'],
    stepsFa: [
      'Install eco-ui-conflict-owner-1.0.0.zip first.',
      'Then install eco-ui-conflict-deny-1.0.0.zip.',
    ],
    verifyFa: [
      'Owner install succeeds — shared-widget appears on the dashboard.',
      'Deny install must return conflict_denied.',
    ],
  },
  {
    id: 'SC-F2',
    priority: 'P0',
    titleFa: 'Reject invalid extension uploads',
    fixtureIds: ['NEG-PL-01', 'NEG-PL-02', 'NEG-PL-03', 'NEG-PL-04', 'NEG-PL-05', 'NEG-PL-06', 'NEG-PL-07'],
    stepsFa: ['Upload each file under negative/packages/ in Plugins.'],
    verifyFa: ['All 7 uploads must fail (including artifact.bin which does not use a .zip extension).'],
  },
  {
    id: 'SC-C1',
    priority: 'P1',
    titleFa: 'Install child without base — dependency_missing',
    fixtureIds: ['PL-10'],
    stepsFa: [
      'Upload only eco-dep-child-1.0.0.zip (without base).',
      'Install it.',
    ],
    verifyFa: ['Install must be rejected with dependency_missing.'],
  },
  {
    id: 'SC-C2',
    priority: 'P1',
    titleFa: 'Dependency chain base → child',
    fixtureIds: ['PL-09', 'PL-10'],
    stepsFa: [
      'Upload and install eco-dep-base-1.0.0.zip first.',
      'Then install eco-dep-child-1.0.0.zip.',
    ],
    verifyFa: [
      'Both packages are installed.',
      'GET /api/packages/eco-dep-base/ping works.',
      'child-widget appears on the dashboard.',
    ],
  },
  {
    id: 'SC-C4',
    priority: 'P1',
    titleFa: 'Uninstall child then base',
    fixtureIds: ['PL-09', 'PL-10'],
    stepsFa: [
      'After SC-C2, uninstall eco-dep-child first.',
      'Then uninstall eco-dep-base.',
    ],
    verifyFa: [
      'Both uninstalls succeed.',
      'packages-storage/installed/ shows not_installed for both.',
    ],
  },
  {
    id: 'SC-B9',
    priority: 'P1',
    titleFa: 'Disable then Enable',
    fixtureIds: ['PL-01'],
    stepsFa: [
      'Install the eco-pl-api plugin.',
      'Disable it, then Enable it again.',
    ],
    verifyFa: [
      'After Disable: API /health should not respond (route inactive).',
      'After Enable: API returns 200 again.',
      'enabled changes in install-state.json.',
    ],
  },
  {
    id: 'SC-G1',
    priority: 'P1',
    titleFa: 'Upgrade version 1.0.0 → 1.1.0',
    fixtureIds: ['PL-01', 'PL-21'],
    stepsFa: [
      'Install eco-pl-api-1.0.0.zip.',
      'Upload eco-pl-api-1.1.0.zip.',
      'Reinstall / upgrade to 1.1.0.',
    ],
    verifyFa: [
      'Installed version becomes 1.1.0.',
      'GET /api/packages/eco-pl-api/version → success: true (new endpoint in 1.1.0).',
    ],
  },
  {
    id: 'SC-D7',
    priority: 'P1',
    titleFa: 'Uninstall VA — remove deployment overlay',
    fixtureIds: ['VA-04'],
    stepsFa: [
      'Install and Apply the propose VA (SC-D1).',
      'Then uninstall it.',
    ],
    verifyFa: [
      'File packages-storage/deployments/eco-va-propose.deployment-applied.json is removed.',
    ],
  },
  {
    id: 'SC-D6',
    priority: 'P1',
    titleFa: 'pathPrefix conflict in Vertical App',
    fixtureIds: ['VA-06-owner', 'VA-06-conflict'],
    stepsFa: [
      'Upload and install eco-va-owner-1.0.0.zip first (auto-apply).',
      'Then install eco-va-path-conflict-1.0.0.zip.',
    ],
    verifyFa: [
      'Owner installs with pathPrefix /eco-va-conflict-path and is applied.',
      'Conflict package must return conflict_denied (same pathPrefix).',
    ],
  },
];

export const PHASE1_MANUAL_SAMPLE_CATALOG: ManualSampleEntry[] = [
  {
    id: 'PL-01',
    fileName: 'eco-pl-api-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-B1', 'SC-B9', 'SC-E1', 'SC-G1'],
    expectedUpload: true,
    manualQaFa:
      'Scenarios SC-B1/SC-B9/SC-E1/SC-G1. Path: Admin → Plugins. Install then GET /api/packages/eco-pl-api/health. For SC-B9: Disable/Enable. For SC-G1: after uploading 1.1.0, Reinstall.',
    build: () => buildPackageZipBuffer(withPluginQa(plApiOnlySpec(), 'Scenario SC-B1. Plugins → Upload → Install eco-pl-api. Verify: GET /api/packages/eco-pl-api/health = 200.')),
  },
  {
    id: 'PL-02',
    fileName: 'eco-pl-dash-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-B2', 'SC-E1'],
    expectedUpload: true,
    manualQaFa:
      'Scenario SC-B2. Plugins → Install eco-pl-dash. Admin dashboard: widget with data-package-id=eco-pl-dash in slot core.dashboard.widgets.',
    build: () =>
      buildPackageZipBuffer(
        withPluginQa(plUiDashSpec(), 'Scenario SC-B2. Install → dashboard → eco-pl-dash-widget with data-component-key in the DOM.'),
      ),
  },
  {
    id: 'PL-09',
    fileName: 'eco-dep-base-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C2', 'SC-C4'],
    expectedUpload: true,
    manualQaFa: 'Scenarios SC-C2/SC-C4. Base dependency — install before child. API: GET /api/packages/eco-dep-base/ping.',
    build: () =>
      buildPackageZipBuffer(withPluginQa(plDepBaseSpec(), 'Scenario SC-C2. Install base first. API ping must return 200.')),
  },
  {
    id: 'PL-10',
    fileName: 'eco-dep-child-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C1', 'SC-C2', 'SC-C4'],
    expectedUpload: true,
    manualQaFa:
      'Scenario SC-C1: without base → dependency_missing. SC-C2: install after base. child-widget on dashboard.',
    build: () =>
      buildPackageZipBuffer(
        withPluginQa(plDepChildSpec(), 'Scenario SC-C1/C2. Depends on eco-dep-base. Without base → error. With base → install succeeds.'),
      ),
  },
  {
    id: 'PL-11',
    fileName: 'eco-conflict-owner-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C5'],
    expectedUpload: true,
    manualQaFa: 'Scenario SC-C5. Shared API owner. Install first. Path: GET /api/packages/eco-shared-zone/ping',
    build: () =>
      buildPackageZipBuffer(
        withPluginQa(plApiConflictOwnerSpec(SHARED_API_PATH), 'Scenario SC-C5. owner — install first. Shared API path.'),
      ),
  },
  {
    id: 'PL-12',
    fileName: 'eco-conflict-deny-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C5'],
    expectedUpload: true,
    manualQaFa: 'Scenario SC-C5. Second plugin with the same API and overridePolicy=deny — must return conflict_denied.',
    build: () =>
      buildPackageZipBuffer(
        withPluginQa(plApiConflictDenySpec(SHARED_API_PATH), 'Scenario SC-C5. Install after owner → must return conflict_denied.'),
      ),
  },
  {
    id: 'PL-16',
    fileName: 'eco-ui-conflict-owner-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C7'],
    expectedUpload: true,
    manualQaFa: 'Scenario SC-C7. Dashboard slot owner with componentKey=shared-widget.',
    build: () =>
      buildPackageZipBuffer(withPluginQa(plUiConflictOwnerSpec(), 'Scenario SC-C7. UI owner — install first. shared-widget on dashboard.')),
  },
  {
    id: 'PL-17',
    fileName: 'eco-ui-conflict-deny-1.0.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-C7'],
    expectedUpload: true,
    manualQaFa: 'Scenario SC-C7. UI conflict deny — after owner must return conflict_denied.',
    build: () =>
      buildPackageZipBuffer(withPluginQa(plUiConflictDenySpec(), 'Scenario SC-C7. After owner → conflict_denied.')),
  },
  {
    id: 'PL-21',
    fileName: 'eco-pl-api-1.1.0.zip',
    category: 'plugins',
    scenarioIds: ['SC-G1'],
    expectedUpload: true,
    manualQaFa: 'Scenario SC-G1. Version 1.1.0 with new /version endpoint. Upload and Reinstall after 1.0.0.',
    build: () =>
      buildPackageZipBuffer(
        withPluginQa(plApiOnlyV11Spec(), 'Scenario SC-G1. Upgrade to 1.1.0. GET /api/packages/eco-pl-api/version must work.'),
      ),
  },
  {
    id: 'VA-04',
    fileName: 'eco-va-propose-1.0.0.zip',
    category: 'vertical-apps',
    scenarioIds: ['SC-D1', 'SC-D7'],
    expectedUpload: true,
    manualQaFa:
      'Scenarios SC-D1/SC-D7. VA with applyPolicy=propose. Install → pending → Apply → deployment-applied.json. Uninstall → file removed.',
    build: () =>
      buildVerticalAppZipBuffer(
        withVaQa(vaProposeInventorySpec(), 'Scenario SC-D1. propose VA. Install=pending, Apply=applied, deployment overlay file.'),
      ),
  },
  {
    id: 'VA-06-owner',
    fileName: 'eco-va-owner-1.0.0.zip',
    category: 'vertical-apps',
    scenarioIds: ['SC-D6'],
    expectedUpload: true,
    manualQaFa: `Scenario SC-D6. VA owner with pathPrefix=${VA_CONFLICT_PATH}. auto-apply — install first.`,
    build: () =>
      buildVerticalAppZipBuffer(
        withVaQa(vaOwnerForPathConflictSpec(VA_CONFLICT_PATH), `Scenario SC-D6. owner pathPrefix ${VA_CONFLICT_PATH}. Install first.`),
      ),
  },
  {
    id: 'VA-06-conflict',
    fileName: 'eco-va-path-conflict-1.0.0.zip',
    category: 'vertical-apps',
    scenarioIds: ['SC-D6'],
    expectedUpload: true,
    manualQaFa: `Scenario SC-D6. Same pathPrefix=${VA_CONFLICT_PATH} — must return conflict_denied.`,
    build: () =>
      buildVerticalAppZipBuffer(
        withVaQa(vaPathConflictSpec(VA_CONFLICT_PATH), 'Scenario SC-D6. conflict — must be rejected after owner.'),
      ),
  },
  ...(['unknown-key', 'empty-caps', 'bad-id', 'bad-integrity', 'missing-json', 'zip-slip', 'non-zip'] as const).map(
    (scenario, index): ManualSampleEntry => {
      const built = buildInvalidPluginZip(scenario);
      return {
        id: `NEG-PL-${String(index + 1).padStart(2, '0')}`,
        fileName: built.originalName,
        category: 'negative',
        negativeGroup: 'plugins',
        scenarioIds: index === 0 ? ['SC-F2'] : ['SC-F2'],
        expectedUpload: false,
        manualQaFa: `Scenario SC-F2 — invalid upload (${scenario}). Must be rejected in Plugins.`,
        build: () => built.buffer,
      };
    },
  ),
];

export function resolveManualSampleOutputPath(rootDir: string, entry: ManualSampleEntry): string {
  if (entry.category === 'negative') {
    const group = entry.negativeGroup ?? 'plugins';
    return `${rootDir}/negative/${group}/${entry.fileName}`;
  }
  return `${rootDir}/${entry.category}/${entry.fileName}`;
}
