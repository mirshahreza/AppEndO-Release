import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Loader2,
  Package,
} from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { columnCommonKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchCurrentUserProfile } from '../../../shared/api/queries/profile';
import {
  FormField,
  SemVerInput,
  StepWizardShell,
  UiInput,
  UiOptionCardGroup,
  UiTextarea,
} from '../../../shared/ui';
import { FormSection } from '../../../shared/ui/FormSection';
import {
  fetchPackageRepackDrift,
  fetchPackageDetail,
} from '../../../shared/api/queries/packages';
import type {
  PackageRepackAdditionsPayload,
  PackageRepackChangedItem,
  PackageRepackDescriptionMode,
  PackageRepackDriftPreview,
  PackageRepackRemovalsPayload,
} from '../../../shared/api/contracts/package/repack';
import { readManifestCapabilityArray } from '../../../core/packages/manifestCapabilityArrays';
import type { PackageBundleManifest } from '../../../shared/api/contracts/package-manifest/types';
import { formatPackageCreatedBy } from '../../../shared/lib/formatPackageCreatedBy';
import { compareSemver, isValidSemver, parseSemver } from '../../../shared/lib/semver';
import {
  PACKAGE_DESCRIPTION_MAX_LENGTH,
  resolveRepackDescriptionText,
} from '../../../shared/lib/packageRepackDescription';
import type { PackageRow } from '../types';
import {
  attachEdgeDataExportToRepackAdditions,
  attachWorkflowExportFilesToRepackAdditions,
  areRepackSqlScriptsPaired,
  buildPackageRepackAdditions,
  countPackageRepackAdditionSelections,
} from '../lib/buildPackageRepackAdditions';
import {
  buildPackageRepackRemovals,
  countPackageRepackRemovals,
  resolveRepackNavigationRemovalIds,
} from '../lib/buildPackageRepackRemovals';
import {
  EMPTY_PACKAGE_BUILDER_CATALOG,
  loadPackageBuilderCatalog,
  packageBuilderWorkflowRowId,
  type PackageBuilderCatalog,
} from '../lib/packageBuilderCatalog';
import { fetchPackageWorkflowExport } from '../lib/packageWorkflowExportClient';
import { packageWorkflowIdentity } from '../lib/packageWorkflows';
import { PACKAGE_CAPABILITY_STEP, PACKAGE_CAPABILITY_WIZARD_STEPS } from '../lib/packageCapabilityWizardSteps';
import { buildSuggestedRepackDescription } from '../lib/buildSuggestedRepackDescription';
import {
  resolveNavigationsForPortals,
  resolvePortalApisForPackage,
  resolvePortalDerivedComponentsForPackage,
  resolvePortalPackageDependencies,
} from '../lib/resolvePortalPackageDependencies';
import { resolvePackageEdgeDependencies } from '../lib/resolvePackageEdgeDependencies';
import { fetchPackageEdgeDataExport } from '../lib/packageEdgeDataExportClient';
import {
  collectPackageDependencyWarnings,
  workflowItemsAsScanComponents,
} from '../lib/collectPackageDependencyWarnings';
import { PackageBuilderDependencyWarnings } from './PackageBuilderDependencyWarnings';
import { PackageRepackAddCapabilitiesPanel } from './PackageRepackAddCapabilitiesPanel';
import { capturedBlobsToRepackFiles, capturedHidRowsToRepackFiles } from '../lib/packageDbBlobPacking';
import { mergeCapturedPackageBlobs, type CapturedPackageBlob } from '../../../core/packages/packageDbBlobPayload';
import { mergePackageHidRewriteRows, type PackageHidRewriteRow } from '../../../core/packages/packageSeedHidRewrite';
import type { CaptureCmsModuleResult } from '../lib/packageDbCaptureClient';
import { joinCapturedSqlParts } from '../lib/packageCmsModuleCapture';
import type { InitialRecordsCaptureTarget } from '../lib/packageBuilderInitialRecords';

const DESCRIPTION_MODE_OPTION_KEYS: Array<{
  value: PackageRepackDescriptionMode;
  labelKey: string;
  hintKey: string;
}> = [
  {
    value: 'append',
    labelKey: 'packages.repack.descriptionAppend',
    hintKey: 'packages.repack.descriptionAppendHint',
  },
  {
    value: 'replace',
    labelKey: 'packages.repack.descriptionReplace',
    hintKey: 'packages.repack.descriptionReplaceHint',
  },
];

const buildWizardSteps = (t: (key: string) => string) => [
  ...PACKAGE_CAPABILITY_WIZARD_STEPS,
  {
    title: t('actions.repack'),
    icon: Package,
    tone: 'indigo' as const,
    description: t('packages.repack.wizardDescription'),
  },
] as const;

function suggestNextVersion(baseVersion: string): string {
  const parsed = parseSemver(baseVersion);
  if (!parsed) return '';
  return `${parsed[0]}.${parsed[1]}.${parsed[2] + 1}`;
}

export type PackageRepackModalProps = {
  target: PackageRow | null;
  isRepacking: boolean;
  errors: string[];
  onClose: () => void;
  onRepack: (payload: {
    version: string;
    description: string;
    descriptionMode: PackageRepackDescriptionMode;
    createdBy: string;
    additions?: PackageRepackAdditionsPayload;
    removals?: PackageRepackRemovalsPayload;
  }) => void | Promise<void>;
  onOpenDiff: (item: PackageRepackChangedItem) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
};

export const PackageRepackModal: React.FC<PackageRepackModalProps> = ({
  target,
  isRepacking,
  errors,
  onClose,
  onRepack,
  onOpenDiff: _onOpenDiff,
  onNotify,
}) => {
  const t = useCultureT();
  const wizardSteps = useMemo(() => buildWizardSteps(t), [t]);
  const { currentUser } = useAuth();
  const [step, setStep] = useState(0);
  const [drift, setDrift] = useState<PackageRepackDriftPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [descriptionMode, setDescriptionMode] = useState<PackageRepackDescriptionMode>('append');
  const [descriptionEdited, setDescriptionEdited] = useState(false);
  const [catalog, setCatalog] = useState<PackageBuilderCatalog>(EMPTY_PACKAGE_BUILDER_CATALOG);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [existingManifest, setExistingManifest] = useState<PackageBundleManifest | null>(null);
  const [selectedApiKeys, setSelectedApiKeys] = useState<Record<string, boolean>>({});
  const [selectedComponentKeys, setSelectedComponentKeys] = useState<Record<string, boolean>>({});
  const [selectedPortalSegments, setSelectedPortalSegments] = useState<Record<string, boolean>>({});
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<Record<string, boolean>>({});
  const [selectedEdgeModelIds, setSelectedEdgeModelIds] = useState<Record<string, boolean>>({});
  const [selectedEdgeApiIds, setSelectedEdgeApiIds] = useState<Record<string, boolean>>({});
  const [installSql, setInstallSql] = useState('');
  const [uninstallSql, setUninstallSql] = useState('');
  const [includeInitialRecords, setIncludeInitialRecords] = useState(true);
  const [optionalInstallSql, setOptionalInstallSql] = useState('');
  const [optionalUninstallSql, setOptionalUninstallSql] = useState('');
  const [seedCaptureTarget, setSeedCaptureTarget] = useState<InitialRecordsCaptureTarget>('required');
  const [requiredBlobs, setRequiredBlobs] = useState<CapturedPackageBlob[]>([]);
  const [optionalBlobs, setOptionalBlobs] = useState<CapturedPackageBlob[]>([]);
  const [requiredHidRows, setRequiredHidRows] = useState<PackageHidRewriteRow[]>([]);
  const [markedForRemovalApiIds, setMarkedForRemovalApiIds] = useState<Record<string, boolean>>({});
  const [markedForRemovalComponentKeys, setMarkedForRemovalComponentKeys] = useState<Record<string, boolean>>({});
  const [markedForRemovalPortalSegments, setMarkedForRemovalPortalSegments] = useState<Record<string, boolean>>({});
  const [markedForRemovalWorkflowIds, setMarkedForRemovalWorkflowIds] = useState<Record<string, boolean>>({});

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

  const loadDrift = useCallback(async () => {
    if (!target) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const preview = await fetchPackageRepackDrift(target.packageId);
      setDrift(preview);
    } catch (err: unknown) {
      setDrift(null);
      setLoadError((err as Error).message || t('packages.repack.loadDriftFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [target, t]);

  useEffect(() => {
    if (!target) {
      setStep(0);
      setDrift(null);
      setLoadError(null);
      setIsLoading(false);
      setVersion('');
      setDescription('');
      setCreatedBy('');
      setDescriptionMode('append');
      setDescriptionEdited(false);
      setCatalog(EMPTY_PACKAGE_BUILDER_CATALOG);
      setCatalogError(null);
      setExistingManifest(null);
      setSelectedApiKeys({});
      setSelectedComponentKeys({});
      setSelectedPortalSegments({});
      setSelectedWorkflowIds({});
      setSelectedEdgeModelIds({});
      setSelectedEdgeApiIds({});
      setInstallSql('');
      setUninstallSql('');
      setIncludeInitialRecords(true);
      setOptionalInstallSql('');
      setOptionalUninstallSql('');
      setSeedCaptureTarget('required');
      setMarkedForRemovalApiIds({});
      setMarkedForRemovalComponentKeys({});
      setMarkedForRemovalPortalSegments({});
      setMarkedForRemovalWorkflowIds({});
      return;
    }

    setStep(0);
    setSelectedApiKeys({});
    setSelectedComponentKeys({});
    setSelectedPortalSegments({});
    setSelectedWorkflowIds({});
    setSelectedEdgeModelIds({});
    setSelectedEdgeApiIds({});
    setInstallSql('');
    setUninstallSql('');
    setIncludeInitialRecords(true);
    setOptionalInstallSql('');
    setOptionalUninstallSql('');
    setSeedCaptureTarget('required');
    setMarkedForRemovalApiIds({});
    setMarkedForRemovalComponentKeys({});
    setMarkedForRemovalPortalSegments({});
    setMarkedForRemovalWorkflowIds({});
    setVersion(suggestNextVersion(target.activeInstalledVersion ?? target.version));
    void loadDrift();

    let catalogCancelled = false;
    setIsCatalogLoading(true);
    setCatalogError(null);
    void loadPackageBuilderCatalog()
      .then((loadedCatalog) => {
        if (!catalogCancelled) setCatalog(loadedCatalog);
      })
      .catch((err: unknown) => {
        if (!catalogCancelled) {
          setCatalogError((err as Error).message || t('packages.repack.loadCatalogFailed'));
        }
      })
      .finally(() => {
        if (!catalogCancelled) setIsCatalogLoading(false);
      });

    return () => {
      catalogCancelled = true;
    };
  }, [loadDrift, target]);

  useEffect(() => {
    if (!drift || !target) return;

    setVersion(suggestNextVersion(drift.baseVersion));
    setDescription('');
    setCreatedBy('');
    setDescriptionMode('append');
    setDescriptionEdited(false);

    let isCancelled = false;
    void fetchPackageDetail(target.packageId, drift.baseVersion)
      .then((detail) => {
        if (isCancelled) return;
        setExistingManifest(detail?.bundleManifest ?? null);
      })
      .catch(() => {
        if (isCancelled) return;
        setExistingManifest(null);
      });

    void fetchCurrentUserProfile()
      .then((profile) => {
        if (isCancelled) return;
        const createdByLabel = formatPackageCreatedBy(currentUser, profile);
        if (createdByLabel) {
          setCreatedBy(createdByLabel);
        }
      })
      .catch(() => {
        if (isCancelled) return;
        const createdByLabel = formatPackageCreatedBy(currentUser, null);
        if (createdByLabel) {
          setCreatedBy(createdByLabel);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [drift, target, currentUser]);

  const managedApis = useMemo(
    () => catalog.apis.filter((item) => item.source !== 'system'),
    [catalog.apis],
  );

  const selectedApis = useMemo(
    () => managedApis.filter((item) => selectedApiKeys[item.id]),
    [managedApis, selectedApiKeys],
  );

  const selectedComponents = useMemo(
    () => catalog.uiComponents.filter((item) => selectedComponentKeys[item.id]),
    [catalog.uiComponents, selectedComponentKeys],
  );

  const selectedPortals = useMemo(
    () => catalog.portals.filter((item) => selectedPortalSegments[item.segment]),
    [catalog.portals, selectedPortalSegments],
  );

  const portalOnlyDerivedComponents = useMemo(
    () => resolvePortalDerivedComponentsForPackage(
      selectedPortals,
      catalog.navigations,
      catalog.uiComponents,
      catalog.shells,
    ),
    [catalog.navigations, catalog.shells, catalog.uiComponents, selectedPortals],
  );

  const derivedComponents = useMemo(
    () => resolvePortalDerivedComponentsForPackage(
      selectedPortals,
      catalog.navigations,
      catalog.uiComponents,
      catalog.shells,
      { seedComponents: selectedComponents },
    ),
    [catalog.navigations, catalog.shells, catalog.uiComponents, selectedComponents, selectedPortals],
  );

  const selectedPortalDeps = useMemo(
    () => resolvePortalPackageDependencies(
      selectedPortals,
      catalog.navigations,
      catalog.uiComponents,
      catalog.shells,
      { seedComponents: selectedComponents },
    ),
    [catalog.navigations, catalog.shells, catalog.uiComponents, selectedComponents, selectedPortals],
  );

  const selectedPortalShells = selectedPortalDeps.shells;

  const selectedWorkflows = useMemo(
    () => catalog.workflows.filter((item) => selectedWorkflowIds[packageBuilderWorkflowRowId(item)]),
    [catalog.workflows, selectedWorkflowIds],
  );

  const workflowScanComponents = useMemo(
    () => workflowItemsAsScanComponents(selectedWorkflows),
    [selectedWorkflows],
  );

  const derivedApis = useMemo(
    () => resolvePortalApisForPackage(
      [...derivedComponents, ...selectedComponents, ...workflowScanComponents],
      managedApis,
      catalog.shells,
    ),
    [catalog.shells, derivedComponents, managedApis, selectedComponents, workflowScanComponents],
  );

  const effectiveApis = useMemo(() => {
    const seen = new Set<string>();
    const items = [...selectedApis, ...derivedApis].filter((api) => {
      if (seen.has(api.id)) return false;
      seen.add(api.id);
      return true;
    });
    return items;
  }, [derivedApis, selectedApis]);

  const effectiveComponents = useMemo(() => {
    const seen = new Set<string>();
    const items = [...selectedComponents, ...derivedComponents].filter((item) => {
      if (seen.has(item.componentKey)) return false;
      seen.add(item.componentKey);
      return true;
    });
    return items;
  }, [derivedComponents, selectedComponents]);

  const derivedEdge = useMemo(
    () => resolvePackageEdgeDependencies({
      components: [...effectiveComponents, ...workflowScanComponents],
      shells: selectedPortalShells,
      edgeModels: catalog.edgeModels,
      edgeApis: catalog.edgeApis,
    }),
    [catalog.edgeApis, catalog.edgeModels, effectiveComponents, selectedPortalShells, workflowScanComponents],
  );

  const existingEdgeModelIds = useMemo(
    () => new Set(
      ((existingManifest as PackageBundleManifest & {
        capabilities: { edge_models?: Array<{ id: string }> };
      })?.capabilities.edge_models ?? []).map((model) => model.id),
    ),
    [existingManifest],
  );

  const existingEdgeApiIds = useMemo(
    () => new Set(
      ((existingManifest as PackageBundleManifest & {
        capabilities: { edge_apis?: Array<{ id: string }> };
      })?.capabilities.edge_apis ?? []).map((api) => api.id),
    ),
    [existingManifest],
  );

  const effectiveEdgeModels = useMemo(() => {
    const ids = new Set(derivedEdge.models.map((model) => model.id));
    for (const [id, selected] of Object.entries(selectedEdgeModelIds)) {
      if (selected) ids.add(id);
    }
    return catalog.edgeModels.filter((model) => ids.has(model.id));
  }, [catalog.edgeModels, derivedEdge.models, selectedEdgeModelIds]);

  const effectiveEdgeApis = useMemo(() => {
    const ids = new Set(derivedEdge.apis.map((api) => api.id));
    for (const [id, selected] of Object.entries(selectedEdgeApiIds)) {
      if (selected) ids.add(id);
    }
    return catalog.edgeApis.filter((api) => ids.has(api.id));
  }, [catalog.edgeApis, derivedEdge.apis, selectedEdgeApiIds]);

  const newEdgeModels = useMemo(
    () => effectiveEdgeModels.filter((model) => !existingEdgeModelIds.has(model.id)),
    [effectiveEdgeModels, existingEdgeModelIds],
  );

  const newEdgeApis = useMemo(
    () => effectiveEdgeApis.filter((api) => !existingEdgeApiIds.has(api.id)),
    [effectiveEdgeApis, existingEdgeApiIds],
  );

  const derivedNavigationRemovals = useMemo(
    () => resolveRepackNavigationRemovalIds({
      existingManifest,
      markedForRemovalPortalSegments,
      selectedPortalSegments,
      catalogPortals: catalog.portals,
      catalogNavigations: catalog.navigations,
    }),
    [
      catalog.navigations,
      catalog.portals,
      existingManifest,
      markedForRemovalPortalSegments,
      selectedPortalSegments,
    ],
  );

  const addedNavigations = useMemo(() => {
    const existingNavigationIds = new Set(
      (
        (existingManifest as PackageBundleManifest & {
          capabilities: { navigations?: Array<{ id: string }> };
        })?.capabilities.navigations ?? []
      ).map((navigation) => navigation.id),
    );
    return resolveNavigationsForPortals(selectedPortals, catalog.navigations)
      .filter((navigation) => !existingNavigationIds.has(navigation.id));
  }, [catalog.navigations, existingManifest, selectedPortals]);

  const additionSelectionCount = useMemo(
    () => countPackageRepackAdditionSelections({
      selectedApis: effectiveApis,
      selectedComponents: effectiveComponents,
      selectedPortals,
      selectedWorkflows,
      selectedEdgeModels: newEdgeModels.length,
      selectedEdgeApis: newEdgeApis.length,
      installSql,
      includeInitialRecords,
      optionalInstallSql,
    }),
    [
      includeInitialRecords,
      installSql,
      optionalInstallSql,
      effectiveApis,
      effectiveComponents,
      newEdgeApis.length,
      newEdgeModels.length,
      selectedPortals,
      selectedWorkflows,
    ],
  );

  const repackAdditions = useMemo(() => {
    if (!target) return null;
    const additions = buildPackageRepackAdditions({
      packageId: target.packageId,
      existingManifest,
      selectedApis: effectiveApis,
      selectedComponents: effectiveComponents,
      selectedPortals,
      selectedWorkflows,
      catalogNavigations: catalog.navigations,
      pageSeedComponents: selectedComponents,
      skipUiRouteComponentKeys: portalOnlyDerivedComponents.map((item) => item.componentKey),
      installSql,
      uninstallSql,
      includeInitialRecords,
      optionalInstallSql,
      optionalUninstallSql,
    });
    const blobFiles = [
      ...capturedBlobsToRepackFiles([
        ...requiredBlobs,
        ...(includeInitialRecords ? optionalBlobs : []),
      ]),
      ...capturedHidRowsToRepackFiles(requiredHidRows),
    ];
    if (blobFiles.length === 0) return additions;
    if (!additions) {
      return { files: blobFiles };
    }
    return { ...additions, files: [...additions.files, ...blobFiles] };
  }, [
    catalog.navigations,
    existingManifest,
    includeInitialRecords,
    installSql,
    optionalBlobs,
    optionalInstallSql,
    optionalUninstallSql,
    effectiveApis,
    effectiveComponents,
    portalOnlyDerivedComponents,
    requiredBlobs,
    requiredHidRows,
    selectedComponents,
    selectedPortals,
    selectedWorkflows,
    target,
    uninstallSql,
  ]);

  const repackRemovals = useMemo(() => buildPackageRepackRemovals({
    existingManifest,
    markedForRemovalApiIds,
    markedForRemovalComponentKeys,
    markedForRemovalPortalSegments,
    markedForRemovalWorkflowIds,
    selectedPortalSegments,
    catalogPortals: catalog.portals,
    catalogNavigations: catalog.navigations,
  }), [
    catalog.navigations,
    catalog.portals,
    existingManifest,
    markedForRemovalApiIds,
    markedForRemovalComponentKeys,
    markedForRemovalPortalSegments,
    markedForRemovalWorkflowIds,
    selectedPortalSegments,
  ]);

  const removalSelectionCount = useMemo(
    () => countPackageRepackRemovals({
      existingManifest,
      markedForRemovalApiIds,
      markedForRemovalComponentKeys,
      markedForRemovalPortalSegments,
      markedForRemovalWorkflowIds,
      selectedPortalSegments,
      catalogPortals: catalog.portals,
      catalogNavigations: catalog.navigations,
    }),
    [
      catalog.navigations,
      catalog.portals,
      existingManifest,
      markedForRemovalApiIds,
      markedForRemovalComponentKeys,
      markedForRemovalPortalSegments,
      markedForRemovalWorkflowIds,
      selectedPortalSegments,
    ],
  );

  const sqlScriptsValid = areRepackSqlScriptsPaired(installSql, uninstallSql)
    && (!includeInitialRecords || areRepackSqlScriptsPaired(optionalInstallSql, optionalUninstallSql));

  const dependencyWarnings = useMemo(
    () => collectPackageDependencyWarnings({
      navigationItems: selectedPortalDeps.navigationItems,
      uiComponents: catalog.uiComponents,
      packedComponents: effectiveComponents,
      shells: selectedPortalShells,
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
      selectedPortalDeps.navigationItems,
      selectedPortalShells,
      selectedWorkflows,
    ],
  );

  const suggestedDescription = useMemo(() => buildSuggestedRepackDescription({
    version,
    changedItems: drift?.changedItems ?? [],
    addedApiLabels: selectedApis.map((api) => `${api.method} ${api.path} (${api.name})`),
    addedComponentLabels: selectedComponents.map((item) => item.label || item.componentKey),
    addedPortalLabels: selectedPortals.map((portal) => `${portal.name} (${portal.segment})`),
    addedNavigationLabels: addedNavigations.map((navigation) => navigation.id),
    addedWorkflowLabels: selectedWorkflows.map((workflow) => workflow.label),
    hasInstallSql: installSql.trim().length > 0
      || (includeInitialRecords && optionalInstallSql.trim().length > 0),
    removedApiLabels: (existingManifest?.capabilities.apis ?? [])
      .filter((api) => markedForRemovalApiIds[api.id])
      .map((api) => `${api.method} ${api.path}`),
    removedComponentLabels: readManifestCapabilityArray(existingManifest?.capabilities.ui_components)
      .filter((item) => markedForRemovalComponentKeys[item.componentKey])
      .map((item) => item.componentKey),
    removedPortalLabels: (
      (existingManifest as PackageBundleManifest & {
        capabilities: { portals?: Array<{ segment: string }> };
      })?.capabilities.portals ?? []
    )
      .filter((portal) => markedForRemovalPortalSegments[portal.segment])
      .map((portal) => portal.segment),
    removedNavigationLabels: derivedNavigationRemovals,
    removedWorkflowLabels: (existingManifest?.capabilities.workflows ?? [])
      .filter((workflow) => markedForRemovalWorkflowIds[packageWorkflowIdentity(workflow.scopeKey, workflow.key)])
      .map((workflow) => packageWorkflowIdentity(workflow.scopeKey, workflow.key)),
  }), [
    addedNavigations,
    drift?.changedItems,
    derivedNavigationRemovals,
    existingManifest,
    includeInitialRecords,
    installSql,
    optionalInstallSql,
    markedForRemovalApiIds,
    markedForRemovalComponentKeys,
    markedForRemovalPortalSegments,
    markedForRemovalWorkflowIds,
    selectedApis,
    selectedComponents,
    selectedPortals,
    selectedWorkflows,
    version,
  ]);

  useEffect(() => {
    if (!descriptionEdited) {
      setDescription(suggestedDescription);
    }
  }, [descriptionEdited, suggestedDescription]);

  const baseVersion = drift?.baseVersion ?? target?.activeInstalledVersion ?? '';
  const baseDescription = drift?.baseDescription ?? null;

  const versionError = useMemo(() => {
    if (isLoading || !drift) return null;
    const trimmed = version.trim();
    if (!trimmed) return 'Version is required.';
    if (!isValidSemver(trimmed)) return 'Version must be SemVer (x.y.z).';
    if (baseVersion && compareSemver(trimmed, baseVersion) <= 0) {
      return `Version must be higher than the base package version (${baseVersion}).`;
    }
    return null;
  }, [baseVersion, drift, isLoading, version]);

  const descriptionError = useMemo(() => {
    if (isLoading || !drift) return null;
    const resolved = resolveRepackDescriptionText(
      baseDescription ?? undefined,
      version.trim(),
      description,
      descriptionMode,
    ) ?? '';
    if (resolved.length > PACKAGE_DESCRIPTION_MAX_LENGTH) {
      return `Description must be up to ${PACKAGE_DESCRIPTION_MAX_LENGTH} characters.`;
    }
    return null;
  }, [baseDescription, description, descriptionMode, drift, isLoading, version]);

  const handleRepackClick = useCallback(async () => {
    if (isRepacking || versionError || descriptionError || !sqlScriptsValid) return;
    if (!drift?.hasChanges && !repackAdditions && !repackRemovals && newEdgeModels.length === 0 && newEdgeApis.length === 0) {
      return;
    }
    try {
      let additions = repackAdditions;
      if (selectedWorkflows.length > 0) {
        const exported = await fetchPackageWorkflowExport({
          workflowDefinitionIds: selectedWorkflows.map((workflow) => workflow.id),
        });
        if (exported.files.length !== selectedWorkflows.length) {
          throw new Error(
            exported.warnings.join(' · ') || 'Failed to export one or more selected workflows.',
          );
        }
        additions = attachWorkflowExportFilesToRepackAdditions(additions, exported.files);
      }
      if (newEdgeModels.length > 0 || newEdgeApis.length > 0) {
        const exported = await fetchPackageEdgeDataExport({
          edgeModelIds: newEdgeModels.map((model) => model.id),
          edgeApiIds: newEdgeApis.map((api) => api.id),
        });
        additions = attachEdgeDataExportToRepackAdditions(additions, exported);
      }
      await onRepack({
        version: version.trim(),
        description: description.trim(),
        descriptionMode,
        createdBy: createdBy.trim(),
        ...(additions ? { additions } : {}),
        ...(repackRemovals ? { removals: repackRemovals } : {}),
      });
    } catch (err: unknown) {
      onNotify('error', (err as Error).message || 'Failed to export capabilities for repack.');
    }
  }, [
    createdBy,
    description,
    descriptionError,
    descriptionMode,
    drift?.hasChanges,
    isRepacking,
    newEdgeApis,
    newEdgeModels,
    onNotify,
    onRepack,
    repackAdditions,
    repackRemovals,
    selectedWorkflows,
    sqlScriptsValid,
    version,
    versionError,
  ]);

  if (!target) return null;

  const installedVersion = drift?.baseVersion ?? target.activeInstalledVersion ?? target.version;
  const canRepack = !isLoading
    && sqlScriptsValid
    && (Boolean(drift?.hasChanges)
      || Boolean(repackAdditions)
      || Boolean(repackRemovals)
      || newEdgeModels.length > 0
      || newEdgeApis.length > 0);

  const isMetadataValid = !versionError && !descriptionError;
  const canMoveNext = step < wizardSteps.length - 1;
  const isScriptStep = step === PACKAGE_CAPABILITY_STEP.installScripts
    || step === PACKAGE_CAPABILITY_STEP.uninstallScripts;
  const isRepackStep = step === wizardSteps.length - 1;

  const addPanelStep = step === PACKAGE_CAPABILITY_STEP.portal
    ? 'portals'
    : step === PACKAGE_CAPABILITY_STEP.serverFunctions
      ? 'apis'
        : step === PACKAGE_CAPABILITY_STEP.clientComponents
          ? 'ui_components'
          : step === PACKAGE_CAPABILITY_STEP.edgeData
            ? 'edge_data'
            : step === PACKAGE_CAPABILITY_STEP.workflows
              ? 'workflows'
              : step === PACKAGE_CAPABILITY_STEP.installScripts
                ? 'install_sql'
                : step === PACKAGE_CAPABILITY_STEP.uninstallScripts
                  ? 'uninstall_sql'
                  : null;

  const footerStatus = (() => {
    const parts: string[] = [];
    if (additionSelectionCount > 0) {
      parts.push(t('packages.repack.footerNewItems').replace('{count}', String(additionSelectionCount)));
    }
    if (removalSelectionCount > 0) {
      parts.push(t('packages.repack.footerRemovals').replace('{count}', String(removalSelectionCount)));
    }
    return parts.length > 0 ? parts.join(' · ') : undefined;
  })();

  return (
    <StepWizardShell
      title={`Repack ${target.displayName} · ${target.packageId} · v${installedVersion}`}
      titleIcon={Package}
      size="maximized"
      steps={wizardSteps}
      step={step}
      onStepChange={setStep}
      onClose={onClose}
      canMoveNext={canMoveNext}
      canActivateStep={() => true}
      bodyInnerClassName={
        isScriptStep
          ? '!overflow-hidden flex flex-col min-h-0 !p-0'
          : isRepackStep
            ? '!overflow-hidden flex flex-col min-h-0'
            : step <= PACKAGE_CAPABILITY_STEP.workflows
              ? '!overflow-hidden flex flex-col min-h-0'
              : undefined
      }
      footerExtra={
        footerStatus && step < wizardSteps.length - 1 ? (
          <span className="text-[11px] font-semibold text-emerald-700">
            {footerStatus}
          </span>
        ) : undefined
      }
      finalStepAction={{
        label: t('actions.repack'),
        icon: isRepacking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />,
        onClick: () => void handleRepackClick(),
        disabled: isRepacking
          || !isMetadataValid
          || !sqlScriptsValid
          || !canRepack,
      }}
    >
      {loadError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 mb-3">
          {loadError}
        </div>
      ) : null}

      <PackageBuilderDependencyWarnings warnings={dependencyWarnings} />

      {isLoading && !drift ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('packages.repack.loadingPreview')}
        </div>
      ) : null}

      {addPanelStep ? (
        <PackageRepackAddCapabilitiesPanel
          activeTab={addPanelStep}
          catalog={catalog}
          isCatalogLoading={isCatalogLoading}
          catalogError={catalogError}
          existingManifest={existingManifest}
          markedForRemovalApiIds={markedForRemovalApiIds}
          onMarkedForRemovalApiIdsChange={setMarkedForRemovalApiIds}
          markedForRemovalComponentKeys={markedForRemovalComponentKeys}
          onMarkedForRemovalComponentKeysChange={setMarkedForRemovalComponentKeys}
          markedForRemovalPortalSegments={markedForRemovalPortalSegments}
          onMarkedForRemovalPortalSegmentsChange={setMarkedForRemovalPortalSegments}
          markedForRemovalWorkflowIds={markedForRemovalWorkflowIds}
          onMarkedForRemovalWorkflowIdsChange={setMarkedForRemovalWorkflowIds}
          selectedApiKeys={selectedApiKeys}
          onSelectedApiKeysChange={setSelectedApiKeys}
          selectedComponentKeys={selectedComponentKeys}
          onSelectedComponentKeysChange={setSelectedComponentKeys}
          selectedPortalSegments={selectedPortalSegments}
          onSelectedPortalSegmentsChange={setSelectedPortalSegments}
          selectedWorkflowIds={selectedWorkflowIds}
          onSelectedWorkflowIdsChange={setSelectedWorkflowIds}
          selectedEdgeModelIds={selectedEdgeModelIds}
          onSelectedEdgeModelIdsChange={setSelectedEdgeModelIds}
          selectedEdgeApiIds={selectedEdgeApiIds}
          onSelectedEdgeApiIdsChange={setSelectedEdgeApiIds}
          installSql={installSql}
          onInstallSqlChange={setInstallSql}
          uninstallSql={uninstallSql}
          onUninstallSqlChange={setUninstallSql}
          includeInitialRecords={includeInitialRecords}
          onIncludeInitialRecordsChange={setIncludeInitialRecords}
          seedCaptureTarget={seedCaptureTarget}
          onSeedCaptureTargetChange={setSeedCaptureTarget}
          optionalInstallSql={optionalInstallSql}
          onOptionalInstallSqlChange={setOptionalInstallSql}
          optionalUninstallSql={optionalUninstallSql}
          onOptionalUninstallSqlChange={setOptionalUninstallSql}
          onLoadSqlFile={addPanelStep === 'uninstall_sql' ? appendCapturedUninstallSql : appendCapturedInstallSql}
          onCaptureSeedInstall={appendCapturedInstallSql}
          onCaptureSeedUninstall={appendCapturedUninstallSql}
          onCaptureBlobs={appendCapturedBlobs}
          onCaptureHidRows={appendCapturedHidRows}
          includeOptionalRecords={includeInitialRecords}
          onPackCmsModule={applyCmsModuleCapture}
        />
      ) : null}

      {step === wizardSteps.length - 1 && (
        <div className="flex flex-col flex-1 min-h-0 gap-5 overflow-auto">
          <FormSection title={t('packages.repack.summary')} ink="accent" className="shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3 text-xs ps-[4px]">
              <div>
                <div className="text-slate-500">{t('packages.repack.package')}</div>
                <div className="font-semibold text-slate-800 mt-0.5">{target.displayName}</div>
              </div>
              <div>
                <div className="text-slate-500">{t('packages.repack.baseVersion')}</div>
                <div className="font-semibold text-slate-800 mt-0.5 font-mono">v{baseVersion || '—'}</div>
              </div>
              <div>
                <div className="text-slate-500">{t('packages.repack.changedItems')}</div>
                <div className="font-semibold text-slate-800 mt-0.5">{drift?.changedItems.length ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-500">{t('packages.repack.newAdditions')}</div>
                <div className="font-semibold text-slate-800 mt-0.5">{additionSelectionCount}</div>
              </div>
              <div>
                <div className="text-slate-500">{t('packages.repack.removals')}</div>
                <div className="font-semibold text-slate-800 mt-0.5">{removalSelectionCount}</div>
              </div>
            </div>
          </FormSection>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t(columnCommonKey('version'))} error={versionError ?? undefined}>
              <SemVerInput
                value={version}
                onChange={setVersion}
                isInvalid={Boolean(versionError)}
                ariaLabel="Repack version"
              />
            </FormField>

            <FormField label={t('packages.repack.createdBy')}>
              <UiInput
                value={createdBy}
                onChange={(event) => setCreatedBy(event.target.value)}
                placeholder={t('packages.repack.createdByPlaceholder')}
                ariaLabel="Package created by"
              />
            </FormField>
          </div>

          <FormField label={t('packages.common.description')}>
            <div className="flex flex-col gap-3 mt-[2px]">
              <UiOptionCardGroup
                value={descriptionMode}
                onChange={(value) => setDescriptionMode(value as PackageRepackDescriptionMode)}
                ariaLabel={t('packages.common.description')}
                columns={2}
                density="compact"
                options={DESCRIPTION_MODE_OPTION_KEYS.map((option) => ({
                  value: option.value,
                  title: t(option.labelKey),
                  description: t(option.hintKey),
                }))}
              />

              <UiTextarea
                value={description}
                onChange={(event) => {
                  setDescriptionEdited(true);
                  setDescription(event.target.value);
                }}
                rows={4}
                placeholder={t('packages.repack.releaseNotesPlaceholder')}
                ariaLabel={t('packages.common.description')}
                isInvalid={Boolean(descriptionError)}
                errorMessage={descriptionError ?? undefined}
              />
              {!descriptionEdited ? (
                <p className="text-[11px] text-slate-500 ps-[4px]">
                  {t('packages.repack.releaseNotesGenerated')}
                </p>
              ) : null}
            </div>
          </FormField>

          {!sqlScriptsValid ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t('packages.repack.sqlPairRequired')}
            </div>
          ) : null}

          {!canRepack ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              {t('packages.repack.noChangesSelected')}
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              {t('packages.repack.publishInfo').replace('{version}', `v${baseVersion}`)}
            </p>
          )}

          {errors.length > 0 ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <div className="font-semibold mb-1">{t('packages.repack.failed')}</div>
              {errors.map((issue) => (
                <div key={issue}>{issue}</div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </StepWizardShell>
  );
};
