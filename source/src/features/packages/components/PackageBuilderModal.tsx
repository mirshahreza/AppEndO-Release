import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileJson,
  Hammer,
  Loader2,
  Package,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import JSZip from 'jszip';
import { useAuth } from '../../../contexts/AuthContext';
import { apiGet } from '../../../shared/api/client';
import { fetchCurrentUserProfile } from '../../../shared/api/queries/profile';
import { formatPackageCreatedBy } from '../../../shared/lib/formatPackageCreatedBy';
import { MonacoEditorPanel } from '../../server-functions/components/MonacoEditorPanel';
import { uploadPackageZip } from '../../../shared/api/queries/packages';
import { validateManifestPreview } from '../utils';
import { isNpmPackageName } from '../../../core/packages/developerLibraries';
import { hasPackageCapabilities } from '../lib/packageBuilderCapabilities';
import {
  buildPackageBuilderDbObjects,
  OPTIONAL_INSTALL_SQL_ENTRY,
  OPTIONAL_UNINSTALL_SQL_ENTRY,
  REQUIRED_INSTALL_SQL_ENTRY,
  REQUIRED_UNINSTALL_SQL_ENTRY,
  areSqlScriptsPaired,
  type InitialRecordsCaptureTarget,
} from '../lib/packageBuilderInitialRecords';
import { PackageInitialRecordsPackingPanel } from './PackageInitialRecordsPackingPanel';
import {
  EMPTY_PACKAGE_BUILDER_CATALOG,
  loadPackageBuilderCatalog,
  packageBuilderWorkflowRowId,
  type PackageBuilderCatalog,
} from '../lib/packageBuilderCatalog';
import {
  PACKAGE_CAPABILITY_STEP,
  PACKAGE_CAPABILITY_WIZARD_STEPS,
} from '../lib/packageCapabilityWizardSteps';
import { fetchPackageWorkflowExport } from '../lib/packageWorkflowExportClient';
import { fetchPackageEdgeDataExport } from '../lib/packageEdgeDataExportClient';
import { packageWorkflowEntryPath, packageWorkflowLifecycleLabel } from '../lib/packageWorkflows';
import { buildPackageDesignerPageDraftEntry, buildPackageUiEntryPath } from '../lib/packageUiEntryPath';
import { buildPackageUiRoutesForPageSeeds } from '../lib/packageUiRoutesFromComponents';
import { resolvePackageEdgeDependencies } from '../lib/resolvePackageEdgeDependencies';
import {
  resolvePortalDerivedComponentsForPackage,
  resolvePortalApisForPackage,
  resolvePortalPackageDependencies,
} from '../lib/resolvePortalPackageDependencies';
import {
  collectPackageDependencyWarnings,
  workflowItemsAsScanComponents,
} from '../lib/collectPackageDependencyWarnings';
import { buildPackageStudioModuleExtras, studioModuleExtraFiles } from '../lib/packageStudioModuleExtras';
import {
  publicSiteHomePortalArtifactFile,
  publicSiteHomePortalCapability,
  shouldPackPublicSiteHomePortal,
} from '../lib/packageHomePortalPacking';
import { PackageBuilderDependencyWarnings } from './PackageBuilderDependencyWarnings';
import { PackageBuilderPortalStep } from './PackageBuilderPortalStep';
import { PackageDbCapturePanel } from './PackageDbCapturePanel';
import { capturedBlobsToArtifactFiles, capturedHidRowsToArtifactFiles } from '../lib/packageDbBlobPacking';
import { mergeCapturedPackageBlobs, type CapturedPackageBlob } from '../../../core/packages/packageDbBlobPayload';
import { mergePackageHidRewriteRows, type PackageHidRewriteRow } from '../../../core/packages/packageSeedHidRewrite';
import type { CaptureCmsModuleResult } from '../lib/packageDbCaptureClient';
import { joinCapturedSqlParts } from '../lib/packageCmsModuleCapture';
import { PackageBuilderDerivedDependenciesPanel } from './PackageBuilderDerivedDependenciesPanel';
import { createPackageBuilderManualFiles, type PackageBuilderManualFile } from '../lib/packageBuilderManualFiles';
import { fetchPackageWorkspaceAssetBytes, fetchPackagePlatformFontBytes } from '../lib/packageWorkspaceAssetsClient';
import {
  packageWorkspaceAssetUrlToRelativePath,
  toPackageWorkspaceAssetEntry,
} from '../../../shared/lib/packageWorkspaceAssets';
import {
  isWebFontPlatformAssetUrl,
  toWebFontPackageEntry,
  webFontPlatformAssetUrlToRelativePath,
} from '../../../shared/lib/platformWebFonts';
import {
  allocateUniquePackageApiRouteSuffix,
  buildManagedFunctionPackageApiMapping,
  buildPackageApiSlug,
  resolveApiMetaEntryPath,
} from '../../../core/packages/packageApiMetaSidecar';
import { computePackageArtifactHashAsync, type PackageArtifactFile } from '../../../shared/packages/packageArtifactHash';
import { EnglishOnlyCultureScope } from '../../../core/culture/EnglishOnlyCultureScope';
import { AppButton, CreateEditModalShell, FormField, FormSection, SemVerInput, SideBySideTransferList, UiInput, UiSelect, UiTextarea } from '../../../shared/ui';
import { StepWizardShell, type StepWizardStepDef } from '../../../shared/ui/StepWizardShell';

type ExistingPackageVersion = {
  version: string;
};

type ExistingPackageDetail = {
  packageId: string;
  versions: ExistingPackageVersion[];
};

type PackageBuilderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onRegistered: (message: string) => Promise<void> | void;
  onNotify?: (type: 'success' | 'error', text: string) => void;
};

type BuilderDependency = {
  id: string;
  name: string;
  versionConstraint: VersionConstraintState;
};

type BuilderLibrary = {
  id: string;
  name: string;
  versionRange: string;
};

type BuilderManifest = {
  $schemaVersion: '1.0';
  id: string;
  name: string;
  version: string;
  description: string;
  requiredAppVersion: string;
  dependencies: Array<{ packageId: string; versionRange?: string }>;
  libraries: Array<{ name: string; versionRange?: string }>;
  capabilities: {
    apis: Array<{
      id: string;
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      path: string;
      entry: string;
      timeoutMs: number;
      auth: 'admin';
    }>;
    ui_components: Array<{
      componentKey: string;
      slotId: string;
      entry: string;
      order: number;
      draftEntry?: string;
    }>;
    ui_routes?: Array<{
      pageKey: string;
      entry: string;
      suggestedRoutePattern?: string;
      suggestedMountId?: string;
    }>;
    portals?: Array<{
      segment: string;
      entry: string;
    }>;
    navigations?: Array<{
      id: string;
      entry: string;
    }>;
    designer_shells?: Array<{
      shellKey: string;
      title: string;
      entry: string;
    }>;
    workflows?: Array<{
      scopeKey: string;
      key: string;
      entry: string;
    }>;
    edge_models?: Array<{ id: string; entry: string }>;
    edge_apis?: Array<{ id: string; edgeModelId: string; entry: string }>;
    edge_model_studio_meta?: Array<{ edgeModelId: string; entry: string }>;
    record_policies?: Array<{ id: string; edgeModelId: string; entry: string }>;
    record_policy_bindings?: Array<{ edgeModelId: string; entry: string }>;
    scope_dimensions?: Array<{ key: string; entry: string }>;
    navigation_patches?: Array<{ navigationId: string; entry: string }>;
    culture_keys?: Array<{ entry: string }>;
    home_portal?: Array<{ entry: string }>;
    mcp_servers: [];
    db_objects: Array<{
      objectType: 'table' | 'view' | 'index' | 'function' | 'trigger' | 'seed';
      objectName: string;
      installScript: string;
      uninstallScript?: string;
      targetDataSource?: string;
    }>;
  };
  overridePolicy: {
    apis: 'deny';
    ui_components: 'deny';
    mcp_servers: 'deny';
    db_objects: 'deny';
  };
  integrity: {
    algorithm: 'sha256';
    artifactHash: string;
  };
};

const WIZARD_STEPS: readonly StepWizardStepDef[] = [
  ...PACKAGE_CAPABILITY_WIZARD_STEPS,
  {
    title: 'Build',
    icon: Hammer,
    tone: 'slate',
    description: 'Set package metadata, then build and register the package on this node.',
  },
];

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const PLUGIN_ID_RE = /^[a-z][a-z0-9-]{2,63}$/;
const PACKAGE_NAME_RE = /^[a-zA-Z0-9.,\-_]+$/;
const PACKAGE_NAME_INPUT_RE = /[^a-zA-Z0-9.,\-_]/g;

type VersionLowerOperator = 'none' | '>=' | '>' | '=';
type VersionUpperOperator = 'none' | '<=' | '<' | '=';

type VersionConstraintState = {
  lowerOperator: VersionLowerOperator;
  lowerVersion: string;
  upperOperator: VersionUpperOperator;
  upperVersion: string;
};

const DEFAULT_VERSION_CONSTRAINT: VersionConstraintState = {
  lowerOperator: 'none',
  lowerVersion: '',
  upperOperator: 'none',
  upperVersion: '',
};

const DEFAULT_APP_VERSION_CONSTRAINT: VersionConstraintState = {
  lowerOperator: '>=',
  lowerVersion: '1.0.0',
  upperOperator: 'none',
  upperVersion: '',
};

const VERSION_LOWER_OPERATOR_OPTIONS: Array<{ value: VersionLowerOperator; label: string }> = [
  { value: 'none', label: 'No Control' },
  { value: '>=', label: '≥ Greater or equal' },
  { value: '>', label: '> Greater than' },
  { value: '=', label: '= Equal' },
];

const VERSION_UPPER_OPERATOR_OPTIONS: Array<{ value: VersionUpperOperator; label: string }> = [
  { value: 'none', label: 'No Control' },
  { value: '<=', label: '≤ Less or equal' },
  { value: '<', label: '< Less than' },
  { value: '=', label: '= Equal' },
];
const DEFAULT_UI_SLOT = 'core.dashboard.widgets';
const SQL_EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 12,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  automaticLayout: true,
};

const createRowId = () => Math.random().toString(36).slice(2, 11);

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

const resolvePackageId = (value: string) => toSlug(value.trim());

const isPluginIdValid = (value: string) => PLUGIN_ID_RE.test(resolvePackageId(value));

const ensureRelativePath = (value: string, fallback: string) => {
  const clean = value.trim().replace(/^\/+/, '');
  if (!clean) return fallback;
  return clean;
};

const buildApiStub = (api: { method: string; path: string }) => {
  return `// Generated by Package Builder\n// ${api.method} ${api.path}\n\nexport default async function handler(req: any, res: any) {\n  return res.json({\n    success: true,\n    package: true,\n    method: '${api.method}',\n    path: '${api.path}',\n    timestamp: new Date().toISOString(),\n  });\n}\n`;
};

const buildUiStub = (componentKey: string) => {
  return `import React from 'react';\n\nexport const ${componentKey.replace(/[^a-zA-Z0-9]/g, '_')} = () => {\n  return <div>Generated component: ${componentKey}</div>;\n};\n\nexport default ${componentKey.replace(/[^a-zA-Z0-9]/g, '_')};\n`;
};

const sanitizePackageNameInput = (value: string) => value.replace(PACKAGE_NAME_INPUT_RE, '');

const buildVersionRangeString = (constraint: VersionConstraintState): string => {
  const parts: string[] = [];
  const lowerVersion = constraint.lowerVersion.trim();
  const upperVersion = constraint.upperVersion.trim();

  if (constraint.lowerOperator !== 'none' && SEMVER_RE.test(lowerVersion)) {
    parts.push(`${constraint.lowerOperator}${lowerVersion}`);
  }
  if (constraint.upperOperator !== 'none' && SEMVER_RE.test(upperVersion)) {
    parts.push(`${constraint.upperOperator}${upperVersion}`);
  }

  return parts.join(' ');
};

const isVersionConstraintEmpty = (constraint: VersionConstraintState): boolean =>
  constraint.lowerOperator === 'none'
  && constraint.upperOperator === 'none'
  && !constraint.lowerVersion.trim()
  && !constraint.upperVersion.trim();

const isVersionConstraintValid = (constraint: VersionConstraintState): boolean => {
  if (isVersionConstraintEmpty(constraint)) return true;

  const lowerActive = constraint.lowerOperator !== 'none';
  const upperActive = constraint.upperOperator !== 'none';

  if (lowerActive && !SEMVER_RE.test(constraint.lowerVersion.trim())) return false;
  if (upperActive && !SEMVER_RE.test(constraint.upperVersion.trim())) return false;

  return buildVersionRangeString(constraint).length > 0;
};

const isDependencyRowValid = (dep: BuilderDependency): boolean => {
  const depName = dep.name.trim();
  if (!depName || depName.length < 3 || depName.length > 100) return false;
  if (!PACKAGE_NAME_RE.test(depName)) return false;
  if (!isPluginIdValid(depName)) return false;
  return isVersionConstraintValid(dep.versionConstraint);
};

const isPackageNameInvalid = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return trimmed.length < 3 || trimmed.length > 100 || !PACKAGE_NAME_RE.test(trimmed) || !isPluginIdValid(trimmed);
};

const isPackageVersionInvalid = (value: string, versionExists: boolean): boolean => {
  if (versionExists) return true;
  return !SEMVER_RE.test(value.trim());
};

const isVersionConstraintFieldsInvalid = (constraint: VersionConstraintState): boolean =>
  !isVersionConstraintValid(constraint);

const isLowerVersionConstraintInvalid = (constraint: VersionConstraintState): boolean =>
  constraint.lowerOperator !== 'none' && !SEMVER_RE.test(constraint.lowerVersion.trim());

const isUpperVersionConstraintInvalid = (constraint: VersionConstraintState): boolean =>
  constraint.upperOperator !== 'none' && !SEMVER_RE.test(constraint.upperVersion.trim());

/** Show invalid border only after interaction or when the user entered a non-empty invalid value. */
const shouldShowInvalidBorder = (invalid: boolean, value: string, touched: boolean): boolean =>
  invalid && (touched || value.trim().length > 0);

type VersionConstraintFieldsProps = {
  constraint: VersionConstraintState;
  onChange: (next: VersionConstraintState) => void;
  lowerOperatorAriaLabel: string;
  upperOperatorAriaLabel: string;
  lowerVersionAriaLabel: string;
  upperVersionAriaLabel: string;
  compact?: boolean;
  invalid?: boolean;
};

const VersionConstraintFields: React.FC<VersionConstraintFieldsProps> = ({
  constraint,
  onChange,
  lowerOperatorAriaLabel,
  upperOperatorAriaLabel,
  lowerVersionAriaLabel,
  upperVersionAriaLabel,
  compact = false,
  invalid = false,
}) => {
  const lowerVersionInvalid = invalid
    ? isLowerVersionConstraintInvalid(constraint)
    : false;
  const upperVersionInvalid = invalid
    ? isUpperVersionConstraintInvalid(constraint)
    : false;

  return (
  <div className={compact ? 'grid grid-cols-2 sm:grid-cols-4 gap-2 items-end' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
    <div className="flex flex-col gap-[2px]">
      <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Greater</label>
      <UiSelect
        value={constraint.lowerOperator}
        onChange={(e) => {
          const nextOperator = e.target.value as VersionLowerOperator;
          onChange({
            ...constraint,
            lowerOperator: nextOperator,
            lowerVersion: nextOperator === 'none' ? '' : constraint.lowerVersion,
          });
        }}
        ariaLabel={lowerOperatorAriaLabel}
      >
        {VERSION_LOWER_OPERATOR_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </UiSelect>
    </div>
    <div className="flex flex-col gap-[2px]">
      <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Version</label>
      <SemVerInput
        value={constraint.lowerVersion}
        onChange={(next) => onChange({ ...constraint, lowerVersion: next })}
        ariaLabel={lowerVersionAriaLabel}
        disabled={constraint.lowerOperator === 'none'}
        isInvalid={lowerVersionInvalid}
      />
    </div>

    <div className="flex flex-col gap-[2px]">
      <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Less</label>
      <UiSelect
        value={constraint.upperOperator}
        onChange={(e) => {
          const nextOperator = e.target.value as VersionUpperOperator;
          onChange({
            ...constraint,
            upperOperator: nextOperator,
            upperVersion: nextOperator === 'none' ? '' : constraint.upperVersion,
          });
        }}
        ariaLabel={upperOperatorAriaLabel}
      >
        {VERSION_UPPER_OPERATOR_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </UiSelect>
    </div>
    <div className="flex flex-col gap-[2px]">
      <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Version</label>
      <SemVerInput
        value={constraint.upperVersion}
        onChange={(next) => onChange({ ...constraint, upperVersion: next })}
        ariaLabel={upperVersionAriaLabel}
        disabled={constraint.upperOperator === 'none'}
        isInvalid={upperVersionInvalid}
      />
    </div>
  </div>
  );
};

const buildPackageZipFileName = (packageName: string, version: string) => {
  const safeName = packageName.trim().replace(/[^a-zA-Z0-9._-]/g, '_') || 'package';
  return `${safeName}-${version.trim()}.zip`;
};

export const PackageBuilderModal: React.FC<PackageBuilderModalProps> = ({
  isOpen,
  onClose,
  onRegistered,
  onNotify,
}) => {
  const { currentUser } = useAuth();
  const [step, setStep] = useState(0);

  const [catalog, setCatalog] = useState<PackageBuilderCatalog>(EMPTY_PACKAGE_BUILDER_CATALOG);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [packageName, setPackageName] = useState('');
  const [packageVersion, setPackageVersion] = useState('1.0.0');
  const [appVersionConstraint, setAppVersionConstraint] = useState<VersionConstraintState>(DEFAULT_APP_VERSION_CONSTRAINT);
  const [description, setDescription] = useState('');
  const [createdBy, setCreatedBy] = useState('');

  const [dependencies, setDependencies] = useState<BuilderDependency[]>([]);
  const [libraries, setLibraries] = useState<BuilderLibrary[]>([]);

  const [selectedApiKeys, setSelectedApiKeys] = useState<Record<string, boolean>>({});
  const [selectedComponentKeys, setSelectedComponentKeys] = useState<Record<string, boolean>>({});
  const [selectedPortalSegments, setSelectedPortalSegments] = useState<Record<string, boolean>>({});
  const [selectedShellKeys, setSelectedShellKeys] = useState<Record<string, boolean>>({});
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<Record<string, boolean>>({});
  const [selectedEdgeModelIds, setSelectedEdgeModelIds] = useState<Record<string, boolean>>({});
  const [selectedEdgeApiIds, setSelectedEdgeApiIds] = useState<Record<string, boolean>>({});
  const [manualFiles, setManualFiles] = useState<PackageBuilderManualFile[]>([]);
  const [excludedPortalApiIds, setExcludedPortalApiIds] = useState<Record<string, boolean>>({});
  const [excludedPortalComponentIds, setExcludedPortalComponentIds] = useState<Record<string, boolean>>({});
  const [excludedDerivedEdgeModelIds, setExcludedDerivedEdgeModelIds] = useState<Record<string, boolean>>({});
  const [excludedDerivedEdgeApiIds, setExcludedDerivedEdgeApiIds] = useState<Record<string, boolean>>({});

  const [installSql, setInstallSql] = useState('');
  const [uninstallSql, setUninstallSql] = useState('');
  const [includeInitialRecords, setIncludeInitialRecords] = useState(true);
  const [optionalInstallSql, setOptionalInstallSql] = useState('');
  const [optionalUninstallSql, setOptionalUninstallSql] = useState('');
  const [seedCaptureTarget, setSeedCaptureTarget] = useState<InitialRecordsCaptureTarget>('required');
  const [requiredBlobs, setRequiredBlobs] = useState<CapturedPackageBlob[]>([]);
  const [optionalBlobs, setOptionalBlobs] = useState<CapturedPackageBlob[]>([]);
  const [requiredHidRows, setRequiredHidRows] = useState<PackageHidRewriteRow[]>([]);

  const appendInstallSql = (addition: string) => {
    setInstallSql((current) => (current.trim() ? `${current}\n\n${addition}` : addition));
  };
  const appendUninstallSql = (addition: string) => {
    setUninstallSql((current) => (current.trim() ? `${current}\n\n${addition}` : addition));
  };
  const appendOptionalInstallSql = (addition: string) => {
    setOptionalInstallSql((current) => (current.trim() ? `${current}\n\n${addition}` : addition));
  };
  const appendOptionalUninstallSql = (addition: string) => {
    setOptionalUninstallSql((current) => (current.trim() ? `${current}\n\n${addition}` : addition));
  };
  const appendCapturedInstallSql = (addition: string) => {
    if (includeInitialRecords && seedCaptureTarget === 'optional') {
      appendOptionalInstallSql(addition);
      return;
    }
    appendInstallSql(addition);
  };
  const appendCapturedUninstallSql = (addition: string) => {
    if (includeInitialRecords && seedCaptureTarget === 'optional') {
      appendOptionalUninstallSql(addition);
      return;
    }
    appendUninstallSql(addition);
  };
  const appendCapturedBlobs = (blobs: CapturedPackageBlob[]) => {
    if (blobs.length === 0) return;
    if (includeInitialRecords && seedCaptureTarget === 'optional') {
      setOptionalBlobs((current) => mergeCapturedPackageBlobs([...current, ...blobs]));
      return;
    }
    setRequiredBlobs((current) => mergeCapturedPackageBlobs([...current, ...blobs]));
  };
  const appendCapturedHidRows = (rows: PackageHidRewriteRow[]) => {
    if (rows.length === 0) return;
    setRequiredHidRows((current) => mergePackageHidRewriteRows([...current, ...rows]));
  };
  const applyCmsModuleCapture = (result: CaptureCmsModuleResult) => {
    const requiredInstall = joinCapturedSqlParts(result.schemaInstallSql, result.vocabInstallSql);
    const requiredUninstall = joinCapturedSqlParts(result.schemaUninstallSql, result.vocabUninstallSql);
    if (requiredInstall) appendInstallSql(requiredInstall);
    if (requiredUninstall) appendUninstallSql(requiredUninstall);
    appendCapturedHidRows(result.vocabHidRows);
    if (!includeInitialRecords) return;
    if (result.contentInstallSql.trim()) appendOptionalInstallSql(result.contentInstallSql);
    if (result.contentUninstallSql.trim()) appendOptionalUninstallSql(result.contentUninstallSql);
    if (result.contentBlobs.length > 0) {
      setOptionalBlobs((current) => mergeCapturedPackageBlobs([...current, ...result.contentBlobs]));
    }
  };

  const [duplicateInfo, setDuplicateInfo] = useState({
    checking: false,
    packageExists: false,
    versionExists: false,
  });

  const [isBuilding, setIsBuilding] = useState(false);
  const [isManifestPreviewOpen, setIsManifestPreviewOpen] = useState(false);
  const [packageNameTouched, setPackageNameTouched] = useState(false);
  const [packageVersionTouched, setPackageVersionTouched] = useState(false);
  const [appVersionConstraintTouched, setAppVersionConstraintTouched] = useState(false);
  const [dependencyTouchedIds, setDependencyTouchedIds] = useState<Set<string>>(() => new Set());
  const notifiedDuplicateRef = useRef({ versionExists: false });
  const notifiedCatalogErrorRef = useRef<string | null>(null);

  const normalizedPackageName = packageName.trim();
  const packageId = useMemo(() => resolvePackageId(packageName), [packageName]);
  const requiredAppVersion = useMemo(
    () => buildVersionRangeString(appVersionConstraint),
    [appVersionConstraint],
  );

  const managedApis = useMemo(
    () => catalog.apis.filter((item) => item.source !== 'system'),
    [catalog.apis],
  );

  const selectedPortals = useMemo(
    () => catalog.portals.filter((item) => selectedPortalSegments[item.segment]),
    [catalog.portals, selectedPortalSegments],
  );

  const explicitlySelectedShells = useMemo(
    () => catalog.shells.filter((item) => selectedShellKeys[item.shellKey]),
    [catalog.shells, selectedShellKeys],
  );

  const manuallySelectedComponents = useMemo(
    () => catalog.uiComponents.filter((item) => selectedComponentKeys[item.id]),
    [catalog.uiComponents, selectedComponentKeys],
  );

  const portalOnlyDerivedComponents = useMemo(
    () => resolvePortalDerivedComponentsForPackage(
      selectedPortals,
      catalog.navigations,
      catalog.uiComponents,
      catalog.shells,
      { additionalShells: explicitlySelectedShells },
    ),
    [catalog.navigations, catalog.shells, catalog.uiComponents, explicitlySelectedShells, selectedPortals],
  );

  const portalDerivedComponents = useMemo(
    () => resolvePortalDerivedComponentsForPackage(
      selectedPortals,
      catalog.navigations,
      catalog.uiComponents,
      catalog.shells,
      {
        additionalShells: explicitlySelectedShells,
        seedComponents: manuallySelectedComponents,
      },
    ),
    [
      catalog.navigations,
      catalog.shells,
      catalog.uiComponents,
      explicitlySelectedShells,
      manuallySelectedComponents,
      selectedPortals,
    ],
  );

  const portalDependencies = useMemo(
    () => resolvePortalPackageDependencies(
      selectedPortals,
      catalog.navigations,
      catalog.uiComponents,
      catalog.shells,
      {
        additionalShells: explicitlySelectedShells,
        assetScanComponents: portalDerivedComponents,
        seedComponents: manuallySelectedComponents,
      },
    ),
    [
      catalog.navigations,
      catalog.shells,
      catalog.uiComponents,
      explicitlySelectedShells,
      manuallySelectedComponents,
      portalDerivedComponents,
      selectedPortals,
    ],
  );

  const portalNavigations = portalDependencies.navigations;
  const selectedShells = portalDependencies.shells;

  const selectedWorkflows = useMemo(
    () => catalog.workflows.filter((item) => selectedWorkflowIds[packageBuilderWorkflowRowId(item)]),
    [catalog.workflows, selectedWorkflowIds],
  );

  const workflowScanComponents = useMemo(
    () => workflowItemsAsScanComponents(selectedWorkflows),
    [selectedWorkflows],
  );

  const portalDerivedApis = useMemo(
    () => resolvePortalApisForPackage(
      [...portalDerivedComponents, ...portalDependencies.landings, ...workflowScanComponents],
      managedApis,
      selectedShells,
    ),
    [
      managedApis,
      portalDependencies.landings,
      portalDerivedComponents,
      selectedShells,
      workflowScanComponents,
    ],
  );

  const derivedEdge = useMemo(
    () => resolvePackageEdgeDependencies({
      components: [...portalDerivedComponents, ...workflowScanComponents],
      shells: selectedShells,
      edgeModels: catalog.edgeModels,
      edgeApis: catalog.edgeApis,
    }),
    [catalog.edgeApis, catalog.edgeModels, portalDerivedComponents, selectedShells, workflowScanComponents],
  );

  const effectiveApiKeys = useMemo(() => {
    const merged = { ...selectedApiKeys };
    for (const api of portalDerivedApis) {
      if (!excludedPortalApiIds[api.id]) {
        merged[api.id] = true;
      }
    }
    return merged;
  }, [excludedPortalApiIds, portalDerivedApis, selectedApiKeys]);

  const effectiveComponentKeys = useMemo(() => {
    const merged = { ...selectedComponentKeys };
    for (const component of portalDerivedComponents) {
      if (!excludedPortalComponentIds[component.id]) {
        merged[component.id] = true;
      }
    }
    for (const landing of portalDependencies.landings) {
      if (!excludedPortalComponentIds[landing.id]) {
        merged[landing.id] = true;
      }
    }
    return merged;
  }, [
    excludedPortalComponentIds,
    portalDependencies.landings,
    portalDerivedComponents,
    selectedComponentKeys,
  ]);

  const effectiveApis = useMemo(
    () => managedApis.filter((item) => effectiveApiKeys[item.id]),
    [effectiveApiKeys, managedApis],
  );

  const effectiveComponents = useMemo(
    () => catalog.uiComponents.filter((item) => effectiveComponentKeys[item.id]),
    [catalog.uiComponents, effectiveComponentKeys],
  );

  const effectiveEdgeModelIds = useMemo(() => {
    const merged = { ...selectedEdgeModelIds };
    for (const model of derivedEdge.models) {
      if (!excludedDerivedEdgeModelIds[model.id]) merged[model.id] = true;
    }
    return merged;
  }, [derivedEdge.models, excludedDerivedEdgeModelIds, selectedEdgeModelIds]);

  const effectiveEdgeApiIds = useMemo(() => {
    const merged = { ...selectedEdgeApiIds };
    for (const api of derivedEdge.apis) {
      if (!excludedDerivedEdgeApiIds[api.id]) merged[api.id] = true;
    }
    return merged;
  }, [derivedEdge.apis, excludedDerivedEdgeApiIds, selectedEdgeApiIds]);

  const effectiveEdgeModels = useMemo(
    () => catalog.edgeModels.filter((item) => effectiveEdgeModelIds[item.id]),
    [catalog.edgeModels, effectiveEdgeModelIds],
  );

  const effectiveEdgeApis = useMemo(
    () => catalog.edgeApis.filter((item) => effectiveEdgeApiIds[item.id]),
    [catalog.edgeApis, effectiveEdgeApiIds],
  );

  const studioPageRoutes = useMemo(
    () => buildPackageUiRoutesForPageSeeds({
      pageSeeds: manuallySelectedComponents,
      skipComponentKeys: new Set(portalOnlyDerivedComponents.map((item) => item.componentKey)),
    }),
    [manuallySelectedComponents, portalOnlyDerivedComponents],
  );

  const studioModuleExtras = useMemo(
    () => buildPackageStudioModuleExtras({
      packageName: normalizedPackageName,
      routes: studioPageRoutes,
      pageSeeds: manuallySelectedComponents,
    }),
    [manuallySelectedComponents, normalizedPackageName, studioPageRoutes],
  );

  const dependencyWarnings = useMemo(
    () => collectPackageDependencyWarnings({
      navigationItems: portalDependencies.navigationItems,
      uiComponents: catalog.uiComponents,
      packedComponents: effectiveComponents,
      shells: selectedShells,
      workflows: selectedWorkflows,
      managedApis,
      edgeApis: catalog.edgeApis,
      edgeModels: catalog.edgeModels,
    }),
    [
      catalog.edgeApis,
      catalog.edgeModels,
      catalog.uiComponents,
      effectiveComponents,
      managedApis,
      portalDependencies.navigationItems,
      selectedShells,
      selectedWorkflows,
    ],
  );

  useEffect(() => {
    if (selectedPortals.length === 0) {
      setExcludedPortalApiIds({});
      setExcludedPortalComponentIds({});
    }
  }, [selectedPortals.length]);

  const portalDerivedApiCards = useMemo(
    () => portalDerivedApis.map((api) => ({
      key: api.id,
      kind: 'Server Function',
      name: api.name || `${api.method} ${api.path}`,
    })),
    [portalDerivedApis],
  );

  const portalDerivedComponentCards = useMemo(() => {
    const layoutComponentIds = new Set(
      portalDependencies.layouts
        .filter((layout) => layout.catalogItem)
        .map((layout) => layout.catalogItem!.id),
    );
    const cards: Array<{ key: string; kind: string; name: string }> = [];

    for (const layout of portalDependencies.layouts) {
      if (layout.builtIn) {
        continue;
      }
      cards.push({
        key: `layout:${layout.layoutLabel}`,
        kind: 'Layout',
        name: layout.layoutLabel.split('/').pop() ?? layout.layoutLabel,
      });
    }

    for (const component of portalDerivedComponents) {
      if (layoutComponentIds.has(component.id)) {
        continue;
      }
      cards.push({
        key: `component:${component.componentKey}`,
        kind: 'Component',
        name: component.label,
      });
    }

    return cards;
  }, [portalDependencies.layouts, portalDerivedComponents]);

  const resetBuilder = () => {
    setStep(0);
    setCatalog(EMPTY_PACKAGE_BUILDER_CATALOG);
    setCatalogError(null);
    setPackageName('');
    setPackageVersion('1.0.0');
    setAppVersionConstraint(DEFAULT_APP_VERSION_CONSTRAINT);
    setDescription('');
    setCreatedBy('');
    setDependencies([]);
    setSelectedApiKeys({});
    setSelectedComponentKeys({});
    setSelectedPortalSegments({});
    setSelectedShellKeys({});
    setSelectedWorkflowIds({});
    setSelectedEdgeModelIds({});
    setSelectedEdgeApiIds({});
    setManualFiles([]);
    setExcludedPortalApiIds({});
    setExcludedPortalComponentIds({});
    setExcludedDerivedEdgeModelIds({});
    setExcludedDerivedEdgeApiIds({});
    setInstallSql('');
    setUninstallSql('');
    setIncludeInitialRecords(true);
    setOptionalInstallSql('');
    setOptionalUninstallSql('');
    setSeedCaptureTarget('required');
    setRequiredBlobs([]);
    setOptionalBlobs([]);
    setDuplicateInfo({ checking: false, packageExists: false, versionExists: false });
    setIsManifestPreviewOpen(false);
    setPackageNameTouched(false);
    setPackageVersionTouched(false);
    setAppVersionConstraintTouched(false);
    setDependencyTouchedIds(new Set());
  };

  useEffect(() => {
    if (!isOpen) return;

    resetBuilder();
    let isCancelled = false;

    const loadCatalog = async () => {
      setIsCatalogLoading(true);
      setCatalogError(null);
      try {
        const [loadedCatalog, profile] = await Promise.all([
          loadPackageBuilderCatalog(),
          fetchCurrentUserProfile().catch(() => null),
        ]);

        if (!isCancelled) {
          setCatalog(loadedCatalog);
          const createdByLabel = formatPackageCreatedBy(currentUser, profile);
          if (createdByLabel) {
            setCreatedBy(createdByLabel);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setCatalogError((err as Error)?.message || 'Failed to load Package Builder catalog.');
        }
      } finally {
        if (!isCancelled) {
          setIsCatalogLoading(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      isCancelled = true;
    };
    // Reset and load catalog only when the dialog opens — not when auth session refreshes.
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const normalizedVersion = packageVersion.trim();

    if (!PACKAGE_NAME_RE.test(normalizedPackageName) || normalizedPackageName.length < 3 || !isPluginIdValid(normalizedPackageName)) {
      setDuplicateInfo({ checking: false, packageExists: false, versionExists: false });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setDuplicateInfo((current) => ({ ...current, checking: true }));
      try {
        const { data: json, response: res } = await apiGet<{
          success?: boolean;
          error?: string;
          package?: ExistingPackageDetail;
        }>(`/api/packages/${encodeURIComponent(packageId)}`);
        if (res.status === 404) {
          if (!cancelled) {
            setDuplicateInfo({ checking: false, packageExists: false, versionExists: false });
          }
          return;
        }

        if (!res.ok || !json?.success) {
          if (!cancelled) {
            setDuplicateInfo({ checking: false, packageExists: false, versionExists: false });
          }
          return;
        }

        const detail = (json.package || {}) as ExistingPackageDetail;
        const versionExists = Array.isArray(detail.catalogVersions)
          ? detail.catalogVersions.includes(normalizedVersion)
          : false;

        if (!cancelled) {
          setDuplicateInfo({ checking: false, packageExists: true, versionExists });
        }
      } catch {
        if (!cancelled) {
          setDuplicateInfo({ checking: false, packageExists: false, versionExists: false });
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, normalizedPackageName, packageId, packageVersion]);

  useEffect(() => {
    if (!isOpen) {
      notifiedDuplicateRef.current = { versionExists: false };
      notifiedCatalogErrorRef.current = null;
      return;
    }

    if (!duplicateInfo.checking && duplicateInfo.versionExists && !notifiedDuplicateRef.current.versionExists) {
      onNotify?.('error', 'Same package version already exists and cannot be rebuilt with this version.');
    }

    notifiedDuplicateRef.current = { versionExists: duplicateInfo.versionExists };
  }, [duplicateInfo.checking, duplicateInfo.versionExists, isOpen, onNotify]);

  useEffect(() => {
    if (!isOpen || !catalogError) return;
    if (notifiedCatalogErrorRef.current === catalogError) return;
    notifiedCatalogErrorRef.current = catalogError;
    onNotify?.('error', catalogError);
  }, [catalogError, isOpen, onNotify]);

  const validateBuilderState = () => {
    const errors: string[] = [];

    const normalizedVersion = packageVersion.trim();

    if (normalizedPackageName.length < 3 || normalizedPackageName.length > 100) {
      errors.push('Metadata: name must be 3 to 100 characters.');
    }
    if (!PACKAGE_NAME_RE.test(normalizedPackageName)) {
      errors.push('Metadata: name may only use Latin letters, numbers, period, comma, dash, and underscore.');
    }
    if (!isPluginIdValid(normalizedPackageName)) {
      errors.push('Metadata: name must resolve to a package id like ecommerce-core (lowercase letters, numbers, and dashes).');
    }
    if (!SEMVER_RE.test(normalizedVersion)) {
      errors.push('Metadata: version must be SemVer (x.y.z).');
    }

    if (duplicateInfo.versionExists) {
      errors.push('Metadata: this package name/version already exists.');
    }

    if (!isVersionConstraintValid(appVersionConstraint)) {
      errors.push('Metadata: complete or clear the required app version bounds.');
    }

    const dependencySeen = new Set<string>();
    dependencies.forEach((dep, index) => {
      const depName = dep.name.trim();
      if (!depName) {
        errors.push(`Metadata: dependency row ${index + 1} name is required.`);
      } else if (depName.length < 3 || depName.length > 100) {
        errors.push(`Metadata: dependency row ${index + 1} name must be 3 to 100 characters.`);
      } else if (!PACKAGE_NAME_RE.test(depName)) {
        errors.push(`Metadata: dependency row ${index + 1} name may only use Latin letters, numbers, period, comma, dash, and underscore.`);
      } else if (!isPluginIdValid(depName)) {
        errors.push(`Metadata: dependency row ${index + 1} name must resolve to a package id like ecommerce-core.`);
      }
      if (!isVersionConstraintValid(dep.versionConstraint)) {
        errors.push(`Metadata: dependency row ${index + 1} has an incomplete version range.`);
      }
      if (depName && dependencySeen.has(depName)) {
        errors.push(`Metadata: dependency ${depName} is duplicated.`);
      }
      if (depName) dependencySeen.add(depName);
    });

    const librarySeen = new Set<string>();
    libraries.forEach((library, index) => {
      const libraryName = library.name.trim();
      if (!libraryName) {
        errors.push(`Metadata: library row ${index + 1} name is required.`);
      } else if (!isNpmPackageName(libraryName)) {
        errors.push(`Metadata: library row ${index + 1} must be a valid npm package name.`);
      }
      if (libraryName && librarySeen.has(libraryName)) {
        errors.push(`Metadata: library ${libraryName} is duplicated.`);
      }
      if (libraryName) librarySeen.add(libraryName);
    });

    if (!areSqlScriptsPaired(installSql, uninstallSql)) {
      errors.push('Install and uninstall SQL must both be provided or both be left empty.');
    }
    if (includeInitialRecords && !areSqlScriptsPaired(optionalInstallSql, optionalUninstallSql)) {
      errors.push('Optional initial-record SQL must have both install and uninstall scripts, or neither.');
    }

    if (!hasPackageCapabilities({
      apiCount: effectiveApis.length,
      componentCount: effectiveComponents.length,
      portalCount: selectedPortals.length,
      shellCount: selectedShells.length,
      navigationCount: portalNavigations.length,
      workflowCount: selectedWorkflows.length,
      edgeModelCount: effectiveEdgeModels.length,
      edgeApiCount: effectiveEdgeApis.length,
      manualFileCount: manualFiles.length,
      installSql,
      optionalInstallSql: includeInitialRecords ? optionalInstallSql : '',
    })) {
      errors.push('At least one capability is required (Server Functions, Client Components, Portal, Shell, Workflows, or SQL scripts).');
    }

    return errors;
  };

  const buildManifest = (): BuilderManifest => {
    const depItems = dependencies
      .map((dep) => {
        const depPackageId = resolvePackageId(dep.name);
        if (!depPackageId) return null;
        const versionRange = buildVersionRangeString(dep.versionConstraint);
        return versionRange ? { packageId: depPackageId, versionRange } : { packageId: depPackageId };
      })
      .filter((dep): dep is { packageId: string; versionRange?: string } => dep !== null);

    const libraryItems = libraries
      .map((library) => {
        const name = library.name.trim();
        if (!name) return null;
        const versionRange = library.versionRange.trim();
        return versionRange ? { name, versionRange } : { name };
      })
      .filter((item): item is { name: string; versionRange?: string } => item !== null);

    const usedApiSlugs = new Set<string>();
    const apis = effectiveApis.map((api, index) => {
      const apiSlug = allocateUniquePackageApiRouteSuffix(
        buildPackageApiSlug({
          folder: api.folder,
          name: api.name,
          path: api.path,
        }),
        usedApiSlugs,
      );
      const mapping = buildManagedFunctionPackageApiMapping({
        packageId,
        folder: api.folder,
        name: api.name,
        method: api.method,
        path: api.path,
        apiSlug,
      });
      const bundle = api.exportBundle;
      return {
        id: `${toSlug(api.method)}-${apiSlug}-${index + 1}`,
        method: api.method,
        path: mapping.manifestPath,
        entry: mapping.entry,
        timeoutMs: bundle?.timeoutMs ?? 10000,
        auth: (bundle?.auth ?? 'admin') as 'public' | 'authenticated' | 'admin',
      };
    });

    const uiCaps = effectiveComponents.map((item, index) => {
      const bundle = item.exportBundle;
      return {
        componentKey: item.componentKey,
        slotId: DEFAULT_UI_SLOT,
        entry: ensureRelativePath(
          '',
          bundle?.entry ?? buildPackageUiEntryPath(item.componentKey),
        ),
        order: 100 + index,
        ...(bundle?.draftJson
          ? { draftEntry: bundle.draftEntry ?? buildPackageDesignerPageDraftEntry(item.componentKey) }
          : {}),
      };
    });

    const portalCaps = selectedPortals.map((portal) => ({
      segment: portal.segment,
      entry: `platform/portals/${toSlug(portal.segment)}.json`,
    }));

    const navigationCaps = portalNavigations.map((navigation) => ({
      id: navigation.id,
      entry: `platform/navigations/${toSlug(navigation.id)}.json`,
    }));

    const designerShellCaps = selectedShells.map((shell) => ({
      shellKey: shell.shellKey,
      title: shell.title,
      entry: shell.entry,
    }));

    const workflowCaps = selectedWorkflows.map((workflow) => ({
      scopeKey: workflow.scopeKey,
      key: workflow.key,
      entry: packageWorkflowEntryPath(workflow.scopeKey, workflow.key),
    }));

    const edgeModelCaps = effectiveEdgeModels.map((model) => ({
      id: model.id,
      entry: `edge/models/${model.id}.json`,
    }));
    const edgeApiCaps = effectiveEdgeApis.map((api) => ({
      id: api.id,
      edgeModelId: api.edgeModelId,
      entry: `edge/apis/${api.id}.json`,
    }));

    const dbCaps = buildPackageBuilderDbObjects({
      packageId,
      installSql,
      uninstallSql,
      includeInitialRecords,
      optionalInstallSql,
      optionalUninstallSql,
    });

    return {
      $schemaVersion: '1.0',
      id: packageId,
      name: normalizedPackageName,
      version: packageVersion.trim(),
      description: description.trim(),
      requiredAppVersion: requiredAppVersion.trim(),
      dependencies: depItems,
      libraries: libraryItems,
      capabilities: {
        apis,
        ui_components: uiCaps,
        ...(portalCaps.length > 0 ? { portals: portalCaps } : {}),
        ...(navigationCaps.length > 0 ? { navigations: navigationCaps } : {}),
        ...(designerShellCaps.length > 0 ? { designer_shells: designerShellCaps } : {}),
        ...(workflowCaps.length > 0 ? { workflows: workflowCaps } : {}),
        ...(studioPageRoutes.length > 0 ? { ui_routes: studioPageRoutes } : {}),
        ...(studioModuleExtras
          ? {
              navigation_patches: [studioModuleExtras.navigationPatchCapability],
              culture_keys: [studioModuleExtras.cultureKeysCapability],
            }
          : {}),
        ...(shouldPackPublicSiteHomePortal(packageId)
          ? { home_portal: publicSiteHomePortalCapability() }
          : {}),
        ...(edgeModelCaps.length > 0 ? { edge_models: edgeModelCaps } : {}),
        ...(edgeApiCaps.length > 0 ? { edge_apis: edgeApiCaps } : {}),
        mcp_servers: [],
        db_objects: dbCaps,
      },
      overridePolicy: {
        apis: 'deny',
        ui_components: 'deny',
        mcp_servers: 'deny',
        db_objects: 'deny',
      },
      integrity: {
        algorithm: 'sha256',
        artifactHash: '0'.repeat(64),
      },
    };
  };

  const buildZipBlob = async () => {
    const manifest = buildManifest();
    const textEncoder = new TextEncoder();
    const artifactFiles: PackageArtifactFile[] = [];

    const addTextFile = (entryName: string, content: string) => {
      artifactFiles.push({ entryName, data: textEncoder.encode(content) });
    };

    manifest.capabilities.apis.forEach((api, index) => {
      const sourceApi = effectiveApis[index];
      const bundle = sourceApi?.exportBundle;
      if (bundle) {
        addTextFile(api.entry, bundle.code);
        addTextFile(resolveApiMetaEntryPath(api.entry), bundle.metaJson);
        return;
      }
      addTextFile(api.entry, buildApiStub({ method: api.method, path: api.path }));
    });

    manifest.capabilities.ui_components.forEach((item, index) => {
      const sourceComponent = effectiveComponents[index];
      const bundle = sourceComponent?.exportBundle;
      addTextFile(item.entry, bundle?.code ?? buildUiStub(item.componentKey));
      if (item.draftEntry && bundle?.draftJson) {
        addTextFile(item.draftEntry, bundle.draftJson);
      }
    });

    selectedPortals.forEach((portal) => {
      const entry = `platform/portals/${toSlug(portal.segment)}.json`;
      addTextFile(entry, `${JSON.stringify(portal, null, 2)}\n`);
    });

    portalNavigations.forEach((navigation) => {
      const entry = `platform/navigations/${toSlug(navigation.id)}.json`;
      const { builtIn: _builtIn, groupCount: _groupCount, itemCount: _itemCount, ...payload } = navigation;
      addTextFile(entry, `${JSON.stringify(payload, null, 2)}\n`);
    });

    selectedShells.forEach((shell) => {
      addTextFile(shell.entry, shell.draftJson);
    });

    if (selectedWorkflows.length > 0) {
      const exported = await fetchPackageWorkflowExport({
        workflowDefinitionIds: selectedWorkflows.map((workflow) => workflow.id),
      });
      if (exported.files.length !== selectedWorkflows.length) {
        throw new Error(
          exported.warnings.join(' · ') || 'Failed to export one or more selected workflows.',
        );
      }
      for (const file of exported.files) {
        addTextFile(file.path, file.content);
      }
    }

    let manifestCapabilities = manifest.capabilities;
    if (effectiveEdgeModels.length > 0 || effectiveEdgeApis.length > 0) {
      const exported = await fetchPackageEdgeDataExport({
        edgeModelIds: effectiveEdgeModels.map((model) => model.id),
        edgeApiIds: effectiveEdgeApis.map((api) => api.id),
      });
      for (const file of exported.files) {
        addTextFile(file.path, file.content);
      }
      manifestCapabilities = {
        ...manifestCapabilities,
        edge_models: exported.capabilities.edge_models,
        edge_apis: exported.capabilities.edge_apis,
        ...(exported.capabilities.edge_model_studio_meta.length > 0
          ? { edge_model_studio_meta: exported.capabilities.edge_model_studio_meta }
          : {}),
        ...(exported.capabilities.scope_dimensions?.length
          ? { scope_dimensions: exported.capabilities.scope_dimensions }
          : {}),
        ...(exported.capabilities.record_policies?.length
          ? { record_policies: exported.capabilities.record_policies }
          : {}),
        ...(exported.capabilities.record_policy_bindings?.length
          ? { record_policy_bindings: exported.capabilities.record_policy_bindings }
          : {}),
      };
    }

    if (installSql.trim()) {
      addTextFile(REQUIRED_INSTALL_SQL_ENTRY, `${installSql.trim()}\n`);
    }
    if (uninstallSql.trim()) {
      addTextFile(REQUIRED_UNINSTALL_SQL_ENTRY, `${uninstallSql.trim()}\n`);
    }
    if (includeInitialRecords && optionalInstallSql.trim()) {
      addTextFile(OPTIONAL_INSTALL_SQL_ENTRY, `${optionalInstallSql.trim()}\n`);
    }
    if (includeInitialRecords && optionalUninstallSql.trim()) {
      addTextFile(OPTIONAL_UNINSTALL_SQL_ENTRY, `${optionalUninstallSql.trim()}\n`);
    }
    const blobsToPack = [
      ...requiredBlobs,
      ...(includeInitialRecords ? optionalBlobs : []),
    ];
    for (const file of capturedBlobsToArtifactFiles(blobsToPack)) {
      artifactFiles.push(file);
    }
    for (const file of capturedHidRowsToArtifactFiles(requiredHidRows)) {
      artifactFiles.push(file);
    }

    const packedWorkspacePaths = new Set<string>();
    const packedFontPaths = new Set<string>();
    const queueWorkspaceAsset = (workspacePath: string, entryPath: string) => {
      const normalizedPath = workspacePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
      if (!normalizedPath || packedWorkspacePaths.has(normalizedPath)) {
        return;
      }
      packedWorkspacePaths.add(normalizedPath);
      workspaceAssetQueue.push({ workspacePath: normalizedPath, entryPath });
    };

    const workspaceAssetQueue: Array<{ workspacePath: string; entryPath: string }> = [];
    const fontAssetQueue: Array<{ relativePath: string; entryPath: string }> = [];
    portalDependencies.files.forEach((file) => {
      const workspaceRelative = packageWorkspaceAssetUrlToRelativePath(file.path);
      if (workspaceRelative) {
        queueWorkspaceAsset(workspaceRelative, toPackageWorkspaceAssetEntry(workspaceRelative));
        return;
      }
      if (isWebFontPlatformAssetUrl(file.path)) {
        const fontRelative = webFontPlatformAssetUrlToRelativePath(file.path);
        if (!fontRelative || packedFontPaths.has(fontRelative)) return;
        packedFontPaths.add(fontRelative);
        fontAssetQueue.push({
          relativePath: fontRelative,
          entryPath: toWebFontPackageEntry(fontRelative),
        });
      }
    });
    manualFiles.forEach((file) => {
      queueWorkspaceAsset(file.workspacePath, file.entryPath);
    });

    for (const asset of workspaceAssetQueue) {
      const bytes = await fetchPackageWorkspaceAssetBytes(asset.workspacePath);
      artifactFiles.push({ entryName: asset.entryPath, data: bytes });
    }
    for (const font of fontAssetQueue) {
      const bytes = await fetchPackagePlatformFontBytes(font.relativePath);
      artifactFiles.push({ entryName: font.entryPath, data: bytes });
    }

    if (studioModuleExtras) {
      for (const extra of studioModuleExtraFiles(studioModuleExtras)) {
        addTextFile(extra.entry, extra.content);
      }
      manifestCapabilities = {
        ...manifestCapabilities,
        navigation_patches: [studioModuleExtras.navigationPatchCapability],
        culture_keys: [studioModuleExtras.cultureKeysCapability],
      };
    }

    if (shouldPackPublicSiteHomePortal(packageId)) {
      const homePortal = publicSiteHomePortalArtifactFile();
      addTextFile(homePortal.entry, homePortal.content);
      manifestCapabilities = {
        ...manifestCapabilities,
        home_portal: publicSiteHomePortalCapability(),
      };
    }

    const artifactHash = await computePackageArtifactHashAsync(artifactFiles);
    const manifestWithHash = {
      ...manifest,
      capabilities: manifestCapabilities,
      integrity: {
        algorithm: 'sha256' as const,
        artifactHash,
      },
    };

    const zip = new JSZip();
    zip.file('package.json', `${JSON.stringify(manifestWithHash, null, 2)}\n`);
    artifactFiles.forEach((file) => {
      zip.file(file.entryName, file.data);
    });

    return zip.generateAsync({ type: 'blob' });
  };

  const handleBuild = async () => {
    const errors = validateBuilderState();
    if (errors.length > 0) {
      onNotify?.('error', errors.length === 1 ? errors[0] : errors.join(' · '));
      return;
    }

    const manifestValidationErrors = validateManifestPreview(buildManifest());
    if (manifestValidationErrors.length > 0) {
      onNotify?.('error', manifestValidationErrors.join(' · '));
      return;
    }

    setIsBuilding(true);
    try {
      const blob = await buildZipBlob();
      const fileName = buildPackageZipFileName(packageId, packageVersion);
      const file = new File([blob], fileName, { type: 'application/zip' });
      const result = await uploadPackageZip(file, { createdBy: createdBy.trim() || undefined });
      await onRegistered(`${normalizedPackageName} v${result.version} built and registered.`);
      onClose();
    } catch (err: unknown) {
      const details = (err as Error & { details?: string[] }).details;
      const message = (err as Error).message || 'Build failed. Please review builder input and retry.';
      onNotify?.('error', details?.length ? `${message} ${details.join(' · ')}` : message);
    } finally {
      setIsBuilding(false);
    }
  };

  const isMetadataStepValid = useMemo(() => {
    const normalizedVersion = packageVersion.trim();

    if (normalizedPackageName.length < 3 || normalizedPackageName.length > 100) return false;
    if (!PACKAGE_NAME_RE.test(normalizedPackageName)) return false;
    if (!isPluginIdValid(normalizedPackageName)) return false;
    if (!SEMVER_RE.test(normalizedVersion)) return false;
    if (!isVersionConstraintValid(appVersionConstraint)) return false;
    if (duplicateInfo.versionExists) return false;

    const dependencySeen = new Set<string>();
    for (const dep of dependencies) {
      if (!isDependencyRowValid(dep)) return false;
      const depName = dep.name.trim();
      if (dependencySeen.has(depName)) return false;
      dependencySeen.add(depName);
    }

    const librarySeen = new Set<string>();
    for (const library of libraries) {
      const libraryName = library.name.trim();
      if (!libraryName || !isNpmPackageName(libraryName)) return false;
      if (librarySeen.has(libraryName)) return false;
      librarySeen.add(libraryName);
    }

    return true;
  }, [
    appVersionConstraint,
    dependencies,
    libraries,
    duplicateInfo.versionExists,
    normalizedPackageName,
    packageVersion,
  ]);

  const packageHasCapabilities = useMemo(
    () => hasPackageCapabilities({
      apiCount: effectiveApis.length,
      componentCount: effectiveComponents.length,
      portalCount: selectedPortals.length,
      shellCount: selectedShells.length,
      navigationCount: portalNavigations.length,
      workflowCount: selectedWorkflows.length,
      edgeModelCount: effectiveEdgeModels.length,
      edgeApiCount: effectiveEdgeApis.length,
      manualFileCount: manualFiles.length,
      installSql,
      optionalInstallSql: includeInitialRecords ? optionalInstallSql : '',
    }),
    [
      effectiveApis.length,
      effectiveComponents.length,
      installSql,
      manualFiles.length,
      portalNavigations.length,
      selectedPortals.length,
      selectedShells.length,
      selectedWorkflows.length,
      effectiveEdgeModels.length,
      effectiveEdgeApis.length,
      includeInitialRecords,
      optionalInstallSql,
    ],
  );

  const canBuildPackage = useMemo(
    () => isMetadataStepValid
      && packageHasCapabilities
      && areSqlScriptsPaired(installSql, uninstallSql)
      && (!includeInitialRecords || areSqlScriptsPaired(optionalInstallSql, optionalUninstallSql)),
    [
      includeInitialRecords,
      installSql,
      isMetadataStepValid,
      optionalInstallSql,
      optionalUninstallSql,
      packageHasCapabilities,
      uninstallSql,
    ],
  );

  const canMoveNext = step < WIZARD_STEPS.length - 1;
  const isScriptStep = step === PACKAGE_CAPABILITY_STEP.installScripts
    || step === PACKAGE_CAPABILITY_STEP.uninstallScripts;
  const isBuildStep = step === WIZARD_STEPS.length - 1;
  const isTransferStep = step === PACKAGE_CAPABILITY_STEP.portal
    || step === PACKAGE_CAPABILITY_STEP.serverFunctions
    || step === PACKAGE_CAPABILITY_STEP.clientComponents
    || step === PACKAGE_CAPABILITY_STEP.edgeData
    || step === PACKAGE_CAPABILITY_STEP.workflows;

  const handleMoveApiToRight = (id: string) => {
    setExcludedPortalApiIds((current) => ({ ...current, [id]: false }));
    setSelectedApiKeys((current) => ({ ...current, [id]: true }));
  };

  const handleMoveApiToLeft = (id: string) => {
    if (portalDerivedApis.some((api) => api.id === id)) {
      setExcludedPortalApiIds((current) => ({ ...current, [id]: true }));
      return;
    }
    setSelectedApiKeys((current) => ({ ...current, [id]: false }));
  };

  const handleMoveComponentToRight = (id: string) => {
    setExcludedPortalComponentIds((current) => ({ ...current, [id]: false }));
    setSelectedComponentKeys((current) => ({ ...current, [id]: true }));
  };

  const handleMoveComponentToLeft = (id: string) => {
    if (portalDerivedComponents.some((component) => component.id === id)) {
      setExcludedPortalComponentIds((current) => ({ ...current, [id]: true }));
      return;
    }
    setSelectedComponentKeys((current) => ({ ...current, [id]: false }));
  };

  const handleMoveEdgeModelToRight = (id: string) => {
    setExcludedDerivedEdgeModelIds((current) => ({ ...current, [id]: false }));
    setSelectedEdgeModelIds((current) => ({ ...current, [id]: true }));
  };

  const handleMoveEdgeModelToLeft = (id: string) => {
    if (derivedEdge.models.some((model) => model.id === id)) {
      setExcludedDerivedEdgeModelIds((current) => ({ ...current, [id]: true }));
      return;
    }
    setSelectedEdgeModelIds((current) => ({ ...current, [id]: false }));
  };

  const handleMoveEdgeApiToRight = (id: string) => {
    setExcludedDerivedEdgeApiIds((current) => ({ ...current, [id]: false }));
    setSelectedEdgeApiIds((current) => ({ ...current, [id]: true }));
  };

  const handleMoveEdgeApiToLeft = (id: string) => {
    if (derivedEdge.apis.some((api) => api.id === id)) {
      setExcludedDerivedEdgeApiIds((current) => ({ ...current, [id]: true }));
      return;
    }
    setSelectedEdgeApiIds((current) => ({ ...current, [id]: false }));
  };

  const packageNameInvalid = isPackageNameInvalid(packageName);
  const packageVersionInvalid = isPackageVersionInvalid(packageVersion, duplicateInfo.versionExists);
  const appVersionConstraintInvalid = isVersionConstraintFieldsInvalid(appVersionConstraint);

  const showPackageNameInvalid = shouldShowInvalidBorder(packageNameInvalid, packageName, packageNameTouched);
  const showPackageVersionInvalid = shouldShowInvalidBorder(packageVersionInvalid, packageVersion, packageVersionTouched);
  const showAppVersionConstraintInvalid = appVersionConstraintInvalid && (
    appVersionConstraintTouched
    || !isVersionConstraintEmpty(appVersionConstraint)
  );

  const apiColumns = useMemo(
    () => [
      { key: 'method', label: 'Method' },
      { key: 'path', label: 'Path' },
      { key: 'name', label: 'Name' },
    ],
    [],
  );

  const availableApis = useMemo(
    () => managedApis.filter((api) => !effectiveApiKeys[api.id]),
    [effectiveApiKeys, managedApis],
  );

  const availableComponents = useMemo(
    () => catalog.uiComponents.filter((item) => !effectiveComponentKeys[item.id]),
    [catalog.uiComponents, effectiveComponentKeys],
  );

  const availableEdgeModels = useMemo(
    () => catalog.edgeModels.filter((item) => !effectiveEdgeModelIds[item.id]),
    [catalog.edgeModels, effectiveEdgeModelIds],
  );

  const availableEdgeApis = useMemo(
    () => catalog.edgeApis.filter((item) => !effectiveEdgeApiIds[item.id]),
    [catalog.edgeApis, effectiveEdgeApiIds],
  );

  const derivedEdgeCards = useMemo(
    () => [
      ...derivedEdge.models.map((model) => ({
        key: `edge-model:${model.id}`,
        kind: 'Edge Model',
        name: model.label,
      })),
      ...derivedEdge.apis.map((api) => ({
        key: `edge-api:${api.id}`,
        kind: 'Edge API',
        name: api.label,
      })),
    ],
    [derivedEdge.apis, derivedEdge.models],
  );

  const availablePortals = useMemo(
    () => catalog.portals.filter((portal) => !selectedPortalSegments[portal.segment]),
    [catalog.portals, selectedPortalSegments],
  );

  const availableShells = useMemo(() => {
    const selected = new Set(selectedShells.map((shell) => shell.shellKey));
    return catalog.shells.filter((shell) => !selected.has(shell.shellKey));
  }, [catalog.shells, selectedShells]);

  const availableWorkflows = useMemo(
    () => catalog.workflows.filter((item) => !selectedWorkflowIds[packageBuilderWorkflowRowId(item)]),
    [catalog.workflows, selectedWorkflowIds],
  );

  const workflowColumns = useMemo(
    () => [
      { key: 'key', label: 'Workflow' },
      { key: 'status', label: 'Status' },
    ],
    [],
  );

  if (!isOpen) return null;

  return (
    <EnglishOnlyCultureScope>
    <>
    <StepWizardShell
      title="Package Builder"
      titleIcon={Package}
      size="maximized"
      steps={WIZARD_STEPS}
      step={step}
      onStepChange={setStep}
      onClose={onClose}
      canMoveNext={canMoveNext}
      stepDescriptionExtra={
        isBuildStep ? (
          <AppButton intent="utility" onClick={() => setIsManifestPreviewOpen(true)}>
            <FileJson className="w-3.5 h-3.5" />
            Preview Manifest
          </AppButton>
        ) : undefined
      }
      bodyInnerClassName={
        isScriptStep
          ? '!overflow-hidden flex flex-col min-h-0 !p-0'
          : isTransferStep
            ? '!overflow-hidden flex flex-col min-h-0'
            : undefined
      }
      finalStepAction={{
        label: 'Build',
        icon: isBuilding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hammer className="w-3.5 h-3.5" />,
        onClick: () => void handleBuild(),
        disabled: isBuilding || !canBuildPackage,
      }}
    >
      {isCatalogLoading ? (
        <div className="h-full min-h-[12rem] flex items-center justify-center text-sm text-slate-500 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading builder catalog...
        </div>
      ) : (
        <>
          <PackageBuilderDependencyWarnings warnings={dependencyWarnings} />
          {step === PACKAGE_CAPABILITY_STEP.portal ? (
            <PackageBuilderPortalStep
              availablePortals={availablePortals}
              selectedPortals={selectedPortals}
              availableShells={availableShells}
              selectedShells={selectedShells}
              dependencies={portalDependencies}
              manualFiles={manualFiles}
              onMoveToRight={(id) => setSelectedPortalSegments((current) => ({ ...current, [id]: true }))}
              onMoveToLeft={(id) => setSelectedPortalSegments((current) => ({ ...current, [id]: false }))}
              onShellMoveToRight={(id) => setSelectedShellKeys((current) => ({ ...current, [id]: true }))}
              onShellMoveToLeft={(id) => {
                // Portal-linked shells remain via portalDependencies; only clear explicit picks.
                setSelectedShellKeys((current) => ({ ...current, [id]: false }));
              }}
              onAddManualFiles={(workspacePaths) => {
                const additions = createPackageBuilderManualFiles(workspacePaths, manualFiles);
                if (additions.length === 0) return;
                setManualFiles((current) => [...current, ...additions]);
              }}
              onRemoveManualFile={(id) => {
                setManualFiles((current) => current.filter((file) => file.id !== id));
              }}
              onNotify={onNotify}
            />
          ) : null}

          {step === PACKAGE_CAPABILITY_STEP.serverFunctions ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <PackageBuilderDerivedDependenciesPanel
                items={portalDerivedApiCards}
                emptyMessage={selectedPortals.length > 0
                  ? 'No server functions were detected from the selected portals.'
                  : 'Select a portal first to detect related server functions.'}
              />
              <SideBySideTransferList
                listId="package-builder-apis"
                tone="cyan"
                className="min-h-0 flex-1"
                leftTitle="Available"
                rightTitle="In Package"
                leftHint="Drag or double-click to include a server function."
                rightHint="Drag or double-click to remove from the package."
                columns={apiColumns}
                leftItems={availableApis.map((api) => ({
                  id: api.id,
                  cells: [
                    <span className="font-semibold">{api.method}</span>,
                    <span className="text-slate-600">{api.path}</span>,
                    api.name,
                  ],
                }))}
                rightItems={effectiveApis.map((api) => ({
                  id: api.id,
                  cells: [
                    <span className="font-semibold">{api.method}</span>,
                    <span className="text-slate-600">{api.path}</span>,
                    api.name,
                  ],
                }))}
                onMoveToRight={handleMoveApiToRight}
                onMoveToLeft={handleMoveApiToLeft}
                leftEmptyMessage="No managed server functions available."
                rightEmptyMessage="Drag server functions here to include them in the package."
              />
            </div>
          ) : null}

          {step === PACKAGE_CAPABILITY_STEP.clientComponents ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <PackageBuilderDerivedDependenciesPanel
                items={portalDerivedComponentCards}
                emptyMessage={selectedPortals.length > 0
                  ? 'No client components were detected from the selected portals.'
                  : 'Select a portal first to detect related client components.'}
              />
              <SideBySideTransferList
                listId="package-builder-ui-components"
                tone="violet"
                className="min-h-0 flex-1"
                leftTitle="Available"
                rightTitle="In Package"
                leftHint="Drag or double-click to include a component."
                rightHint="Drag or double-click to remove from the package."
                columns={[{ key: 'component', label: 'Component' }]}
                leftItems={availableComponents.map((item) => ({
                  id: item.id,
                  cells: [item.label],
                }))}
                rightItems={effectiveComponents.map((item) => ({
                  id: item.id,
                  cells: [item.label],
                }))}
                onMoveToRight={handleMoveComponentToRight}
                onMoveToLeft={handleMoveComponentToLeft}
                leftEmptyMessage="No custom components available."
                rightEmptyMessage="Drag components here to include them in the package."
              />
            </div>
          ) : null}

          {step === PACKAGE_CAPABILITY_STEP.edgeData ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <PackageBuilderDerivedDependenciesPanel
                items={derivedEdgeCards}
                emptyMessage={portalDerivedComponents.length > 0 || selectedShells.length > 0
                  ? 'No Edge models or APIs were detected from the selected pages.'
                  : 'Select a portal, shell, or client component first to detect related Edge data.'}
              />
              <SideBySideTransferList
                listId="package-builder-edge-models"
                tone="slate"
                className="min-h-0 flex-1"
                leftTitle="Available models"
                rightTitle="In Package"
                leftHint="Drag or double-click to include an Edge model."
                rightHint="Drag or double-click to remove from the package."
                columns={[
                  { key: 'id', label: 'Id' },
                  { key: 'object', label: 'Object' },
                ]}
                leftItems={availableEdgeModels.map((item) => ({
                  id: item.id,
                  cells: [
                    <span className="font-mono text-slate-600">{item.id}</span>,
                    item.label,
                  ],
                }))}
                rightItems={effectiveEdgeModels.map((item) => ({
                  id: item.id,
                  cells: [
                    <span className="font-mono text-slate-600">{item.id}</span>,
                    item.label,
                  ],
                }))}
                onMoveToRight={handleMoveEdgeModelToRight}
                onMoveToLeft={handleMoveEdgeModelToLeft}
                leftEmptyMessage="No Edge models available."
                rightEmptyMessage="Drag Edge models here, or select pages that use them."
              />
              <SideBySideTransferList
                listId="package-builder-edge-apis"
                tone="slate"
                className="min-h-0 flex-1"
                leftTitle="Available APIs"
                rightTitle="In Package"
                leftHint="Selecting an API also packs its Edge model."
                rightHint="Drag or double-click to remove from the package."
                columns={[
                  { key: 'key', label: 'Key' },
                  { key: 'path', label: 'Base path' },
                ]}
                leftItems={availableEdgeApis.map((item) => ({
                  id: item.id,
                  cells: [
                    item.label,
                    <span className="font-mono text-slate-600">{item.basePath || '—'}</span>,
                  ],
                }))}
                rightItems={effectiveEdgeApis.map((item) => ({
                  id: item.id,
                  cells: [
                    item.label,
                    <span className="font-mono text-slate-600">{item.basePath || '—'}</span>,
                  ],
                }))}
                onMoveToRight={handleMoveEdgeApiToRight}
                onMoveToLeft={handleMoveEdgeApiToLeft}
                leftEmptyMessage="No Edge APIs available."
                rightEmptyMessage="Drag Edge APIs here, or select pages that call them."
              />
            </div>
          ) : null}

          {step === PACKAGE_CAPABILITY_STEP.workflows ? (
            <SideBySideTransferList
              listId="package-builder-workflows"
              tone="indigo"
              className="min-h-0 flex-1"
              leftTitle="Available"
              rightTitle="In Package"
              leftHint="Drag or double-click to include a workflow."
              rightHint="Drag or double-click to remove from the package."
              columns={workflowColumns}
              leftItems={availableWorkflows.map((workflow) => ({
                id: packageBuilderWorkflowRowId(workflow),
                cells: [
                  <span className="font-mono text-slate-700">{workflow.label}</span>,
                  <span className="text-slate-500">{packageWorkflowLifecycleLabel(workflow.lifecycleStatus)}</span>,
                ],
              }))}
              rightItems={selectedWorkflows.map((workflow) => ({
                id: packageBuilderWorkflowRowId(workflow),
                cells: [
                  <span className="font-mono text-slate-700">{workflow.label}</span>,
                  <span className="text-slate-500">{packageWorkflowLifecycleLabel(workflow.lifecycleStatus)}</span>,
                ],
              }))}
              onMoveToRight={(id) => setSelectedWorkflowIds((current) => ({ ...current, [id]: true }))}
              onMoveToLeft={(id) => setSelectedWorkflowIds((current) => ({ ...current, [id]: false }))}
              leftEmptyMessage="No workflow definitions available."
              rightEmptyMessage="Drag workflows here to include them in the package."
            />
          ) : null}

          {step === PACKAGE_CAPABILITY_STEP.installScripts && (
            <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden">
              <PackageInitialRecordsPackingPanel
                includeInitialRecords={includeInitialRecords}
                onIncludeInitialRecordsChange={setIncludeInitialRecords}
                captureTarget={seedCaptureTarget}
                onCaptureTargetChange={setSeedCaptureTarget}
              />
              <PackageDbCapturePanel
                onLoadSqlFile={appendCapturedInstallSql}
                onCaptureSeedInstall={appendCapturedInstallSql}
                onCaptureSeedUninstall={appendCapturedUninstallSql}
                onCaptureBlobs={appendCapturedBlobs}
                onCaptureHidRows={appendCapturedHidRows}
                includeOptionalRecords={includeInitialRecords}
                onPackCmsModule={applyCmsModuleCapture}
              />
              <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                <p className="shrink-0 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Required foundation SQL
                </p>
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <MonacoEditorPanel
                    language="sql"
                    defaultLanguage="sql"
                    value={installSql}
                    onChange={(value) => setInstallSql(value ?? '')}
                    options={SQL_EDITOR_OPTIONS}
                    documentKey="package-builder-install-sql"
                  />
                </div>
              </div>
              {includeInitialRecords ? (
                <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-slate-200">
                  <p className="shrink-0 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Optional initial records
                  </p>
                  <div className="flex min-h-0 flex-1 overflow-hidden">
                    <MonacoEditorPanel
                      language="sql"
                      defaultLanguage="sql"
                      value={optionalInstallSql}
                      onChange={(value) => setOptionalInstallSql(value ?? '')}
                      options={SQL_EDITOR_OPTIONS}
                      documentKey="package-builder-optional-install-sql"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {step === PACKAGE_CAPABILITY_STEP.uninstallScripts && (
            <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden">
              <PackageInitialRecordsPackingPanel
                includeInitialRecords={includeInitialRecords}
                onIncludeInitialRecordsChange={setIncludeInitialRecords}
                captureTarget={seedCaptureTarget}
                onCaptureTargetChange={setSeedCaptureTarget}
              />
              <PackageDbCapturePanel
                onLoadSqlFile={appendCapturedUninstallSql}
                onCaptureSeedInstall={appendCapturedInstallSql}
                onCaptureSeedUninstall={appendCapturedUninstallSql}
                onCaptureBlobs={appendCapturedBlobs}
                onCaptureHidRows={appendCapturedHidRows}
                includeOptionalRecords={includeInitialRecords}
                onPackCmsModule={applyCmsModuleCapture}
              />
              <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                <p className="shrink-0 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Required uninstall SQL
                </p>
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <MonacoEditorPanel
                    language="sql"
                    defaultLanguage="sql"
                    value={uninstallSql}
                    onChange={(value) => setUninstallSql(value ?? '')}
                    options={SQL_EDITOR_OPTIONS}
                    documentKey="package-builder-uninstall-sql"
                  />
                </div>
              </div>
              {includeInitialRecords ? (
                <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-slate-200">
                  <p className="shrink-0 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Optional initial-record uninstall
                  </p>
                  <div className="flex min-h-0 flex-1 overflow-hidden">
                    <MonacoEditorPanel
                      language="sql"
                      defaultLanguage="sql"
                      value={optionalUninstallSql}
                      onChange={(value) => setOptionalUninstallSql(value ?? '')}
                      options={SQL_EDITOR_OPTIONS}
                      documentKey="package-builder-optional-uninstall-sql"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {isBuildStep && (
            <div className="flex flex-col gap-1">
              <FormSection
                title="Metadata"
                ink="accent"
              >
                <div className="flex flex-col gap-1">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <FormField label="Name" required invalid={showPackageNameInvalid}>
                      <UiInput
                        size="sm"
                        autoDir={false}
                        value={packageName}
                        onChange={(e) => setPackageName(sanitizePackageNameInput(e.target.value))}
                        onBlur={() => setPackageNameTouched(true)}
                        placeholder="ecommerce-core"
                        ariaLabel="Package name"
                      />
                    </FormField>

                    <FormField label="Version" required invalid={showPackageVersionInvalid}>
                      <SemVerInput
                        value={packageVersion}
                        onChange={setPackageVersion}
                        onBlur={() => setPackageVersionTouched(true)}
                        ariaLabel="Package version"
                      />
                    </FormField>
                  </div>

                  <FormSection
                    title="App version"
                    ink="contrast"
                    divided
                  >
                    <VersionConstraintFields
                      compact
                      invalid={showAppVersionConstraintInvalid}
                      constraint={appVersionConstraint}
                      onChange={(next) => {
                        setAppVersionConstraintTouched(true);
                        setAppVersionConstraint(next);
                      }}
                      lowerOperatorAriaLabel="Greater app version operator"
                      upperOperatorAriaLabel="Less app version operator"
                      lowerVersionAriaLabel="Greater app version"
                      upperVersionAriaLabel="Less app version"
                    />
                  </FormSection>

                  <div className="flex flex-col gap-3">
                    <FormField label="Description">
                      <UiTextarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        placeholder="Package description"
                        ariaLabel="Package description"
                      />
                    </FormField>

                    <FormField label="Created By">
                      <UiInput
                        value={createdBy}
                        onChange={(e) => setCreatedBy(e.target.value)}
                        placeholder="AppEndO Team"
                        ariaLabel="Package created by"
                      />
                    </FormField>
                  </div>

                  <FormSection
                    title="Dependencies"
                    ink="complement"
                    divided
                    headerExtra={(
                      <AppButton
                        intent="utility"
                        onClick={() => setDependencies((current) => [
                          ...current,
                          { id: createRowId(), name: '', versionConstraint: { ...DEFAULT_VERSION_CONSTRAINT } },
                        ])}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Dependency
                      </AppButton>
                    )}
                  >
                    {dependencies.length === 0 ? (
                      <div className="text-xs text-slate-500 ps-[4px]">No dependency added.</div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {dependencies.map((dep, index) => {
                          const depNameInvalid = isPackageNameInvalid(dep.name);
                          const depConstraintInvalid = isVersionConstraintFieldsInvalid(dep.versionConstraint);
                          const depTouched = dependencyTouchedIds.has(dep.id);
                          const showDepNameInvalid = shouldShowInvalidBorder(depNameInvalid, dep.name, depTouched);
                          const showDepConstraintInvalid = depConstraintInvalid && (
                            depTouched
                            || !isVersionConstraintEmpty(dep.versionConstraint)
                          );

                          return (
                            <div
                              key={dep.id}
                              className={index > 0 ? 'grid grid-cols-1 xl:grid-cols-[minmax(10rem,1fr)_2fr_auto] gap-2 items-end pt-3' : 'grid grid-cols-1 xl:grid-cols-[minmax(10rem,1fr)_2fr_auto] gap-2 items-end'}
                            >
                              <FormField label="Name" required invalid={showDepNameInvalid}>
                                <UiInput
                                  size="sm"
                                  autoDir={false}
                                  value={dep.name}
                                  onChange={(e) => {
                                    const next = sanitizePackageNameInput(e.target.value);
                                    setDependencies((current) => current.map((row) => (row.id === dep.id ? { ...row, name: next } : row)));
                                  }}
                                  onBlur={() => {
                                    setDependencyTouchedIds((current) => new Set(current).add(dep.id));
                                  }}
                                  placeholder="ecommerce-core"
                                  ariaLabel="Dependency package name"
                                  isRequired
                                />
                              </FormField>

                              <VersionConstraintFields
                                compact
                                invalid={showDepConstraintInvalid}
                                constraint={dep.versionConstraint}
                                onChange={(next) => {
                                  setDependencyTouchedIds((current) => new Set(current).add(dep.id));
                                  setDependencies((current) => current.map((row) => (
                                    row.id === dep.id ? { ...row, versionConstraint: next } : row
                                  )));
                                }}
                                lowerOperatorAriaLabel={`Greater version operator for ${dep.name || 'dependency'}`}
                                upperOperatorAriaLabel={`Less version operator for ${dep.name || 'dependency'}`}
                                lowerVersionAriaLabel={`Greater version for ${dep.name || 'dependency'}`}
                                upperVersionAriaLabel={`Less version for ${dep.name || 'dependency'}`}
                              />

                              <AppButton
                                closeIcon
                                onClick={() => setDependencies((current) => current.filter((row) => row.id !== dep.id))}
                                aria-label="Remove dependency"
                                title="Remove dependency"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </AppButton>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </FormSection>

                  <FormSection
                    title="Libraries"
                    ink="contrast"
                    divided
                    headerExtra={(
                      <AppButton
                        intent="utility"
                        onClick={() => setLibraries((current) => [
                          ...current,
                          { id: createRowId(), name: '', versionRange: '' },
                        ])}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Library
                      </AppButton>
                    )}
                  >
                    {libraries.length === 0 ? (
                      <div className="text-xs text-slate-500 ps-[4px]">No npm library declared. The platform installs these before the package.</div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {libraries.map((library, index) => {
                          const nameInvalid = Boolean(library.name.trim()) && !isNpmPackageName(library.name.trim());
                          return (
                            <div
                              key={library.id}
                              className={index > 0 ? 'grid grid-cols-1 xl:grid-cols-[minmax(10rem,1fr)_2fr_auto] gap-2 items-end pt-3' : 'grid grid-cols-1 xl:grid-cols-[minmax(10rem,1fr)_2fr_auto] gap-2 items-end'}
                            >
                              <FormField label="npm name" required invalid={nameInvalid}>
                                <UiInput
                                  size="sm"
                                  autoDir={false}
                                  value={library.name}
                                  onChange={(e) => {
                                    const next = e.target.value.trim();
                                    setLibraries((current) => current.map((row) => (row.id === library.id ? { ...row, name: next } : row)));
                                  }}
                                  placeholder="xlsx"
                                  ariaLabel="Library npm package name"
                                  isRequired
                                />
                              </FormField>
                              <FormField label="Version range">
                                <UiInput
                                  size="sm"
                                  autoDir={false}
                                  value={library.versionRange}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setLibraries((current) => current.map((row) => (row.id === library.id ? { ...row, versionRange: next } : row)));
                                  }}
                                  placeholder="^0.18.5"
                                  ariaLabel="Library version range"
                                />
                              </FormField>
                              <AppButton
                                closeIcon
                                onClick={() => setLibraries((current) => current.filter((row) => row.id !== library.id))}
                                aria-label="Remove library"
                                title="Remove library"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </AppButton>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </FormSection>
                </div>
              </FormSection>
            </div>
          )}
        </>
      )}
    </StepWizardShell>

    {isManifestPreviewOpen ? (
      <CreateEditModalShell
        title="Manifest Preview"
        size="maximized"
        shellClassName="flex min-h-0 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0"
        onClose={() => setIsManifestPreviewOpen(false)}
        footer={(
          <AppButton intent="secondary" onClick={() => setIsManifestPreviewOpen(false)}>
            <X className="h-3.5 w-3.5" />
            Close
          </AppButton>
        )}
      >
        <pre className="m-0 min-h-0 flex-1 overflow-auto text-[11px] text-slate-700 whitespace-pre-wrap break-all">
          {JSON.stringify(buildManifest(), null, 2)}
        </pre>
      </CreateEditModalShell>
    ) : null}
    </>
    </EnglishOnlyCultureScope>
  );
};
