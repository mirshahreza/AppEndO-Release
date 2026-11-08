import { ensurePackageStorageDirs } from '../../../core/packages/PackageFileStore';
import type { DependencyGraph } from '../../../core/packages/DependencyResolver';
import type {
  InstallPackageOptions,
  LifecycleStatusCode,
  PackageLifecycleResult,
  PluginObjectRegistry,
  UninstallPluginOptions,
} from '../../domain/package-domain/types';
import { isVerticalAppManifest, type AnyPackageManifest } from '../../../core/packages/PackageManifestValidator';
import { makeOperationId } from '../../domain/package-domain/utils';
import type { PackageLockGateway } from './gateways';
import { createPackageLockGateway } from './gateways';
import {
  conflictMessages,
  createPackageRegistryService,
  type PackageRegistryService,
} from './packageRegistry.service';
import {
  createPackageDependencyService,
  type PackageDependencyService,
} from './packageDependency.service';
import {
  createPackageInstallStateService,
  type LifecycleOperationContext,
  type PackageInstallStateService,
} from './packageInstallState.service';
import {
  createPackageScriptPolicyService,
  type PackageScriptPolicyService,
} from './packageScriptPolicy.service';
import { runPluginInstallSmokeTest } from './packageSmokeTest.service';
import {
  extractPackageUiRuntime,
  removePackageRuntimeEntries,
  removePluginUiRuntime,
  removeUnprotectedPackageRuntimeFiles,
} from './packageUiRuntime.service';
import {
  extractPackageApiRuntime,
  removePluginApiRuntime,
} from './packageApiRuntime.service';
import { extractPackageWorkflowActionRuntime } from './packageWorkflowActionRuntime.service';
import { installPackageEdgeData, uninstallPackageEdgeData } from './packageEdgeDataRuntime.service';
import { installPackageRecordPolicyData } from './packageRecordPolicyRuntime.service';
import { installPackageQuerySurfaceData } from './packageQuerySurfaceRuntime.service';
import { installPackageWorkflows, uninstallPackageWorkflows } from './packageWorkflowRuntime.service';
import { uninstallPackageNavigationPatch } from './packageNavigationPatch.service';
import { uninstallPackageHomePortalClaim } from './packageHomePortalClaim.service';
import { uninstallPackageCultureKeys } from '../package/packageCultureKeysInstall.service';
import { runPackageInstallHooks } from './packageInstallHookRuntime.service';
import { runCmsPackageRuntimeSeedAfterInstall } from '../cms/cmsPackageRuntimeSeed.service';
import { readObjectRegistry } from '../../domain/package-domain/objectRegistryRepository';
import { validatePluginMcpServersAtInstall } from '../ai/mcp/packageMcpPolicy';
import { aiManager } from '../../../core/ai/AiManager';
import { buildPackageMcpGlobalId } from '../../../core/packages/mcpServerIds';
import { openApiSpecService } from '../openApiSpec.service';
import { invalidatePlatformRuntimeConfig } from '../platform/platformRuntimeConfig.service';
import {
  manifestForRegistry,
  removePluginVerticalRuntime,
} from './packageVerticalRuntime.service';
import {
  finalizeVerticalAppDeployment,
  prepareVerticalAppRuntime,
  rollbackFailedVerticalAppInstall,
  runVerticalAppPreflight,
  applyPendingVerticalAppDeployment,
} from './verticalAppInstall.service';
import {
  applyPendingExtensionUiRoutes,
  finalizeExtensionUiRoutes,
  runExtensionUiRoutesPreflight,
} from './extensionUiRoutesInstall.service';
import {
  finalizeExtensionPlatformCapabilities,
  rollbackInstalledExtensionPlatformCapabilities,
  runExtensionPlatformCapabilitiesPreflight,
} from './extensionPlatformCapabilitiesInstall.service';
import { readPackageRegistryProposalPreview } from './extensionUiRoutes.service';
import { isExtensionUiRoutesPreview } from '../../../shared/api/contracts/package-manifest/deploymentPreview';
import { rollbackPluginDeployment } from './packageDeployment.service';
import { HAWIETY_PACKAGE_ID } from '../../../core/packages/hawietyPackage';
import {
  publishHawietyPlatformRegistryFromSnapshot,
  unpublishHawietyPlatformRegistry,
} from '../hawiety/hawietyPlatformRegistry.service';
import { runPackageInstallDbScripts, runPluginUninstallDbScripts } from './packageDbScripts.service';
import { rollbackFailedExtensionInstall, emptyExtensionInstallProgress } from './packageInstallRollback.service';
import { parseInstallOptionalRecordsFlag } from '../../../core/packages/packageDbObjectInstallMode';
import { getEffectivePolicy, syncVerticalAppUiRoutesOnRegistry } from '../../domain/package-domain/registryBuilder';
import { supersedeManagedFunctionsForPackageApis } from './managedFunctionPackageOverride.service';
import {
  DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE,
  resolvePackageUninstallRemoveScope,
} from '../../../shared/api/contracts/package/uninstall';
import {
  collectProtectedRuntimeEntries,
  collectRuntimeEntriesToRemove,
  resolveRegistryRecordsToRetain,
  resolveUninstallRetainedArtifacts,
  shouldRemoveEntirePluginRegistry,
} from './packageUninstallScope.service';
import { readPackageLibraries } from '../../../core/packages/developerLibraries';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import type { VerticalAppManifest } from '../../../shared/api/contracts/package-manifest/verticalApp';

function rollbackPendingInstallArtifacts(packageId: string, version: string, verticalApp = false): void {
  if (verticalApp) {
    removePluginVerticalRuntime(packageId, version);
  } else {
    removePluginUiRuntime(packageId, version);
  }
  removePluginApiRuntime(packageId, version);
}

export type PackageLifecycleCoordinatorDeps = {
  locks: PackageLockGateway;
  installState: PackageInstallStateService;
  registry: PackageRegistryService;
  dependency: PackageDependencyService;
  scriptPolicy: PackageScriptPolicyService;
  satisfyLibraries?: (manifest: AnyPackageManifest) => Promise<
    { ok: true } | { ok: false; error: string; details?: string[] }
  >;
  pruneLibraries?: (names: string[]) => Promise<void>;
};

export interface PackageLifecycleCoordinator {
  install(packageId: string, actor: string, options?: InstallPackageOptions): Promise<PackageLifecycleResult>;
  uninstall(packageId: string, actor: string, options?: UninstallPluginOptions): Promise<PackageLifecycleResult>;
  reinstall(packageId: string, actor: string, options?: InstallPackageOptions): Promise<PackageLifecycleResult>;
  applyDeployment(packageId: string, actor: string, actorId: number | null): Promise<PackageLifecycleResult>;
  enable(packageId: string, actor: string): PackageLifecycleResult;
  disable(packageId: string, actor: string): PackageLifecycleResult;
  getDependencyGraph(): DependencyGraph;
}

export class DefaultPackageLifecycleCoordinator implements PackageLifecycleCoordinator {
  constructor(private readonly deps: PackageLifecycleCoordinatorDeps) {}

  getDependencyGraph(): DependencyGraph {
    return this.deps.dependency.getGraph();
  }

  async install(
    packageId: string,
    actor: string,
    options: InstallPackageOptions = {},
  ): Promise<PackageLifecycleResult> {
    ensurePackageStorageDirs();

    const selected = this.deps.registry.resolveVersionForInstall(packageId, options.version);
    if (!selected) {
      return {
        success: false,
        error: `Package "${packageId}" or requested version was not found.`,
        code: 'not_found',
        operation: 'install',
      };
    }

    const operationId = makeOperationId();
    const ctx: LifecycleOperationContext = {
      packageId,
      actor,
      operationId,
      version: selected.version,
    };

    if (!this.deps.locks.acquireIndexLock()) {
      return {
        success: false,
        error: 'System index is locked. Please retry.',
        code: 'locked',
        operation: 'install',
      };
    }
    if (!this.deps.locks.acquirePackageLock(packageId)) {
      this.deps.locks.releaseLock('index');
      return {
        success: false,
        error: 'Package is locked by another operation. Please retry.',
        code: 'busy',
        operation: 'install',
      };
    }

    let isVerticalApp = false;
    let installManifest: AnyPackageManifest | null = null;
    let candidateRegistry: PluginObjectRegistry | null = null;
    let progress = emptyExtensionInstallProgress(false);
    let rollbackTargetDataSource = 'default';
    let verticalPrepareStarted = false;

    try {
      const currentState = this.deps.installState.getState(packageId);
      const preflight = this.deps.installState.checkInstallPreflight(currentState, packageId, selected.version);
      if (preflight) {
        return preflight;
      }

      const targetDataSource = options.targetDataSource?.trim() || currentState.targetDataSource || 'default';
      const includeOptionalRecords = parseInstallOptionalRecordsFlag(options.installOptionalRecords);
      progress = emptyExtensionInstallProgress(includeOptionalRecords);
      rollbackTargetDataSource = targetDataSource;
      const installingState = this.deps.installState.beginInstall(currentState, ctx, targetDataSource);

      const manifest = this.deps.registry.loadManifest(selected.manifestPath);
      if (!manifest) {
        rollbackPendingInstallArtifacts(packageId, selected.version, false);
        return this.deps.installState.failInstallFromInstalling(
          installingState,
          ctx,
          'Manifest is missing or invalid.',
          'invalid_manifest',
        );
      }

      installManifest = manifest;
      isVerticalApp = isVerticalAppManifest(manifest);
      const registryManifest: PackageManifest = isVerticalApp
        ? manifestForRegistry(manifest)
        : (manifest as PackageManifest);
      const verticalManifest: VerticalAppManifest | null = isVerticalApp
        ? (manifest as VerticalAppManifest)
        : null;

      const failInstall = async (
        error: string,
        code: LifecycleStatusCode,
        details?: string[],
        eventPayload?: Record<string, unknown>,
      ): Promise<PackageLifecycleResult> => {
        if (isVerticalApp) {
          rollbackPendingInstallArtifacts(packageId, selected.version, true);
        } else {
          await rollbackFailedExtensionInstall({
            packageId,
            version: selected.version,
            manifest: installManifest,
            targetDataSource: rollbackTargetDataSource,
            candidateRegistry,
            progress,
          });
        }
        return this.deps.installState.failInstallFromInstalling(
          installingState,
          ctx,
          error,
          code,
          details,
          eventPayload,
        );
      };

      const scriptValidation = this.deps.scriptPolicy.validateForInstall(registryManifest);
      if (!scriptValidation.ok) {
        const failedValidation = scriptValidation as Extract<typeof scriptValidation, { ok: false }>;
        return await failInstall(
          failedValidation.error,
          'script_execution_unsafe',
          failedValidation.details,
          {
            details: failedValidation.details,
            scriptPolicy: {
              allowedPathPrefixes: failedValidation.policy.allowedPathPrefixes,
              timeoutMs: failedValidation.policy.maxTimeoutMs,
            },
          },
        );
      }

      const settingsMcpIds = new Set((aiManager.getSettings()?.mcpServers ?? []).map((server) => server.id));
      const reservedMcpId = registryManifest.capabilities.mcp_servers.find(
        (server) => settingsMcpIds.has(buildPackageMcpGlobalId(packageId, server.id)),
      );
      if (reservedMcpId) {
        return await failInstall(
          `MCP server id "${buildPackageMcpGlobalId(packageId, reservedMcpId.id)}" conflicts with platform settings.`,
          'conflict_denied',
        );
      }

      const mcpPolicyError = validatePluginMcpServersAtInstall(packageId, registryManifest);
      if (mcpPolicyError) {
        return await failInstall(mcpPolicyError, 'invalid_manifest');
      }

      const dependencyFailure = this.deps.dependency.checkInstallDependencies(packageId, registryManifest);
      if (dependencyFailure) {
        const failure = dependencyFailure as Extract<typeof dependencyFailure, { success: false }>;
        return await failInstall(
          failure.error,
          failure.code,
          failure.details,
          { error: failure.error, details: failure.details },
        );
      }

      const satisfyLibraries = this.deps.satisfyLibraries
        ?? (async (candidate: AnyPackageManifest) => {
          const { getDeveloperLibrariesService } = await import('../libraries/developerLibraries.service');
          return getDeveloperLibrariesService().satisfy(readPackageLibraries(candidate));
        });
      const libraryResult = await satisfyLibraries(installManifest);
      if (libraryResult.ok === false) {
        return await failInstall(
          libraryResult.error,
          'libraries_unsatisfied',
          libraryResult.details,
          { error: libraryResult.error, details: libraryResult.details },
        );
      }

      const installRegistry = this.deps.registry.buildCandidateRegistry(
        packageId,
        registryManifest,
        selected.version,
        targetDataSource,
      );
      if (verticalManifest) {
        syncVerticalAppUiRoutesOnRegistry(installRegistry, verticalManifest);
      }
      candidateRegistry = installRegistry;
      const conflicts = this.deps.registry.collectConflictsFromStorage(packageId, installRegistry);
      const { denied, overridden } = this.deps.registry.evaluateConflicts(
        conflicts,
        registryManifest,
        options.overridePolicy,
      );

      if (denied.length > 0) {
        const details = conflictMessages(denied);
        return await failInstall(
          'Install blocked due to object conflicts.',
          'conflict_denied',
          details,
          { error: 'Install blocked due to object conflicts.', details },
        );
      }

      if (overridden.length > 0) {
        this.deps.registry.applyConflictOverrides(overridden, actor, operationId);
      }

      const effectivePolicy = getEffectivePolicy(registryManifest, options.overridePolicy);
      let supersededManagedFunctionIds: string[] = [];
      if (effectivePolicy.apis === 'allow') {
        const supersedeResult = await supersedeManagedFunctionsForPackageApis(installRegistry.records.apis);
        supersededManagedFunctionIds = supersedeResult.removedIds;
      }

      let smokeTestPayload: Record<string, unknown> = {};
      let deploymentStatus: 'none' | 'pending' | 'applied' = 'none';

      if (isVerticalApp && verticalManifest) {
        const deploymentPreflight = await runVerticalAppPreflight(packageId, verticalManifest);
        if (deploymentPreflight) {
          return await failInstall(
            deploymentPreflight.error,
            deploymentPreflight.code,
            deploymentPreflight.details,
          );
        }

        verticalPrepareStarted = true;
        const prepared = await prepareVerticalAppRuntime({
          packageId,
          version: selected.version,
          manifest: verticalManifest,
          targetDataSource,
          actorId: null,
          overridePolicy: options.overridePolicy,
          includeOptionalRecords,
          skipInstallDbScripts: options.skipInstallDbScripts === true,
        });
        if (prepared.ok === false) {
          return await failInstall(prepared.error, prepared.code, prepared.details);
        }

        this.deps.registry.commitInstallRegistry(installRegistry);

        const finalized = await finalizeVerticalAppDeployment({
          packageId,
          version: selected.version,
          manifest: verticalManifest,
          targetDataSource,
          actorId: null,
          overridePolicy: options.overridePolicy,
        });
        if (finalized.ok === false) {
          this.deps.registry.removePluginRegistry(packageId);
          await rollbackFailedVerticalAppInstall(packageId, selected.version, manifest, targetDataSource);
          return await failInstall(finalized.error, finalized.code, finalized.details);
        }

        deploymentStatus = finalized.deploymentStatus;
        if (packageId === HAWIETY_PACKAGE_ID && finalized.deploymentStatus === 'applied') {
          publishHawietyPlatformRegistryFromSnapshot();
        }
        smokeTestPayload = {
          smokeTestWarnings: finalized.smokeWarnings,
          deploymentStatus: finalized.deploymentStatus,
        };
      } else {
        const smokeResult = runPluginInstallSmokeTest(registryManifest, packageId, selected.version);
        if (!smokeResult.ok) {
          const details = smokeResult.checks
            .filter((check) => !check.ok)
            .map((check) => check.message);
          return await failInstall(
            'Package smoke test failed.',
            'invalid_manifest',
            details,
            { smokeTest: smokeResult.checks },
          );
        }

        const uiExtractResult = extractPackageUiRuntime(packageId, selected.version, registryManifest);
        progress.runtimeExtracted = true;
        if (uiExtractResult.ok === false) {
          return await failInstall(
            uiExtractResult.error,
            'invalid_manifest',
            uiExtractResult.details,
            { uiRuntime: uiExtractResult.details },
          );
        }

        const apiExtractResult = extractPackageApiRuntime(packageId, selected.version, registryManifest);
        if (apiExtractResult.ok === false) {
          return await failInstall(
            apiExtractResult.error,
            'invalid_manifest',
            apiExtractResult.details,
            { apiRuntime: apiExtractResult.details },
          );
        }

        const workflowActionExtractResult = extractPackageWorkflowActionRuntime(packageId, selected.version, registryManifest);
        if (workflowActionExtractResult.ok === false) {
          return await failInstall(
            workflowActionExtractResult.error,
            'invalid_manifest',
            workflowActionExtractResult.details,
            { workflowActionRuntime: workflowActionExtractResult.details },
          );
        }

        const skipInstallDbScripts = options.skipInstallDbScripts === true;
        if (!skipInstallDbScripts) {
          progress.dbInstallAttempted = true;
          const dbScriptResult = await runPackageInstallDbScripts(
            packageId,
            selected.version,
            registryManifest,
            targetDataSource,
            { includeOptionalRecords },
          );
          if (dbScriptResult.ok === false) {
            return await failInstall(
              dbScriptResult.error,
              'install_failed',
              dbScriptResult.details,
            );
          }
        }

        try {
          await runCmsPackageRuntimeSeedAfterInstall(packageId);
        } catch (seedError: unknown) {
          const seedMessage = seedError instanceof Error ? seedError.message : String(seedError);
          return await failInstall(
            `CMS package foundation seed failed: ${seedMessage}`,
            'install_failed',
          );
        }

        const edgeDataResult = await installPackageEdgeData(packageId, selected.version, registryManifest);
        progress.createdEdge = edgeDataResult.created;
        if (edgeDataResult.ok === false) {
          return await failInstall(
            edgeDataResult.error,
            'install_failed',
            edgeDataResult.details,
          );
        }

        const recordPolicyResult = await installPackageRecordPolicyData(
          packageId,
          selected.version,
          registryManifest,
        );
        progress.recordPolicies = {
          policies: recordPolicyResult.installed.policies,
          bindings: recordPolicyResult.installed.bindings,
        };
        if (recordPolicyResult.ok === false) {
          return await failInstall(
            recordPolicyResult.error,
            'install_failed',
            recordPolicyResult.details,
          );
        }

        const querySurfaceResult = await installPackageQuerySurfaceData(
          packageId,
          selected.version,
          registryManifest,
        );
        progress.querySurfaces = {
          bindings: querySurfaceResult.installed.bindings,
        };
        if (querySurfaceResult.ok === false) {
          return await failInstall(
            querySurfaceResult.error,
            'install_failed',
            querySurfaceResult.details,
          );
        }

        progress.workflowsAttempted = true;
        const workflowDataResult = await installPackageWorkflows(packageId, selected.version, registryManifest);
        if (workflowDataResult.ok === false) {
          return await failInstall(
            workflowDataResult.error,
            'install_failed',
            workflowDataResult.details,
          );
        }

        const uiRoutesPreflight = await runExtensionUiRoutesPreflight(packageId, registryManifest);
        if (uiRoutesPreflight) {
          return await failInstall(
            uiRoutesPreflight.error,
            uiRoutesPreflight.code,
            uiRoutesPreflight.details,
          );
        }

        const platformCapabilitiesPreflight = await runExtensionPlatformCapabilitiesPreflight(
          packageId,
          registryManifest,
        );
        if (platformCapabilitiesPreflight) {
          return await failInstall(
            platformCapabilitiesPreflight.error,
            platformCapabilitiesPreflight.code,
            platformCapabilitiesPreflight.details,
          );
        }

        this.deps.registry.commitInstallRegistry(installRegistry);
        progress.registryCommitted = true;

        const extensionRoutesResult = await finalizeExtensionUiRoutes(
          packageId,
          selected.version,
          registryManifest,
          null,
        );
        if (extensionRoutesResult.ok === false) {
          return await failInstall(
            extensionRoutesResult.error,
            extensionRoutesResult.code,
            extensionRoutesResult.details,
          );
        }

        progress.platformFinalizeAttempted = true;
        const platformCapabilitiesResult = await finalizeExtensionPlatformCapabilities(
          packageId,
          selected.version,
          registryManifest,
        );
        if (platformCapabilitiesResult.ok === false) {
          return await failInstall(
            platformCapabilitiesResult.error,
            platformCapabilitiesResult.code,
            platformCapabilitiesResult.details,
          );
        }

        const hookResult = await runPackageInstallHooks(packageId, selected.version, registryManifest);
        if (hookResult.ok === false) {
          return await failInstall(hookResult.error, 'install_failed', hookResult.details);
        }

        deploymentStatus = extensionRoutesResult.deploymentStatus;
        smokeTestPayload = { smokeTest: smokeResult.checks };
      }

      this.deps.installState.completeInstall(installingState, ctx, targetDataSource, {
        pluginKind: isVerticalApp ? 'vertical-app' : 'extension',
        deploymentStatus,
        optionalRecordsInstalled: includeOptionalRecords,
      });
      this.deps.dependency.refreshGraph();

      this.deps.installState.emitInstallSucceeded(ctx, {
        overriddenConflicts: overridden.length,
        supersededManagedFunctions: supersededManagedFunctionIds.length,
        ...smokeTestPayload,
        scriptPolicy: {
          allowedPathPrefixes: scriptValidation.policy.allowedPathPrefixes,
          timeoutMs: scriptValidation.policy.maxTimeoutMs,
        },
      });
      openApiSpecService.invalidate();

      return {
        success: true,
        packageId,
        version: selected.version,
        status: 'installed',
        pluginKind: isVerticalApp ? 'vertical-app' : 'extension',
        deploymentStatus,
        idempotent: false,
        operation: 'install',
      };
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : 'Install failed due to an unexpected error.';
      if (ctx.version) {
        if (isVerticalApp && installManifest) {
          if (verticalPrepareStarted) {
            await rollbackFailedVerticalAppInstall(
              packageId,
              ctx.version,
              installManifest,
              rollbackTargetDataSource,
            );
          } else {
            rollbackPendingInstallArtifacts(packageId, ctx.version, true);
          }
        } else {
          await rollbackFailedExtensionInstall({
            packageId,
            version: ctx.version,
            manifest: installManifest,
            targetDataSource: rollbackTargetDataSource,
            candidateRegistry,
            progress,
          });
        }
      }
      return this.deps.installState.recordUnexpectedInstallFailure(packageId, ctx, message);
    } finally {
      this.deps.locks.releaseLock(`package-${packageId}`);
      this.deps.locks.releaseLock('index');
    }
  }

  async uninstall(
    packageId: string,
    actor: string,
    options: UninstallPluginOptions = {},
  ): Promise<PackageLifecycleResult> {
    ensurePackageStorageDirs();

    const removeScope = resolvePackageUninstallRemoveScope(options.removeScope);
    const runDbUninstallScripts = removeScope.runDbUninstallScripts;
    const operationId = makeOperationId();
    const currentState = this.deps.installState.getState(packageId);
    const inIndex = this.deps.registry.packageExistsInIndex(packageId);
    const hasOrphanedInstallState = Boolean(
      currentState.activeVersion
      && (
        currentState.status === 'installed'
        || currentState.status === 'failed'
        || currentState.status === 'installing'
        || currentState.status === 'uninstalling'
      ),
    );

    if (!inIndex && !hasOrphanedInstallState) {
      return {
        success: false,
        error: `Package "${packageId}" was not found.`,
        code: 'not_found',
        operation: 'uninstall',
      };
    }
    const ctx: LifecycleOperationContext = {
      packageId,
      actor,
      operationId,
      version: currentState.activeVersion,
    };

    if (!this.deps.locks.acquireIndexLock()) {
      return {
        success: false,
        error: 'System index is locked. Please retry.',
        code: 'locked',
        operation: 'uninstall',
      };
    }
    if (!this.deps.locks.acquirePackageLock(packageId)) {
      this.deps.locks.releaseLock('index');
      return {
        success: false,
        error: 'Package is locked by another operation. Please retry.',
        code: 'busy',
        operation: 'uninstall',
      };
    }

    try {
      const preflight = this.deps.installState.checkUninstallPreflight(currentState, packageId);
      if (preflight) {
        return preflight;
      }

      const uninstallingState = this.deps.installState.beginUninstall(currentState, ctx);
      this.deps.installState.emitUninstallRequested(ctx, { removeScope, runDbUninstallScripts });

      const reverseDependencyFailure = this.deps.dependency.checkReverseDependencies(
        packageId,
        currentState.activeVersion as string,
      );
      if (reverseDependencyFailure) {
        const failure = reverseDependencyFailure as Extract<typeof reverseDependencyFailure, { success: false }>;
        return this.deps.installState.failUninstallFromUninstalling(
          uninstallingState,
          ctx,
          failure.error,
          failure.code,
          failure.details,
          { requiredBy: failure.details },
        );
      }

      const selectedManifest = this.deps.registry.resolveVersionForInstall(packageId, currentState.activeVersion as string);
      const uninstallManifest = selectedManifest
        ? this.deps.registry.loadManifest(selectedManifest.manifestPath)
        : null;

      if (uninstallManifest && runDbUninstallScripts) {
        const registryManifestForScripts = isVerticalAppManifest(uninstallManifest)
          ? manifestForRegistry(uninstallManifest)
          : uninstallManifest;
        const scriptValidation = this.deps.scriptPolicy.validateForUninstall(registryManifestForScripts);
        if (!scriptValidation.ok) {
          const failedValidation = scriptValidation as Extract<typeof scriptValidation, { ok: false }>;
          return this.deps.installState.failUninstallFromUninstalling(
            uninstallingState,
            ctx,
            failedValidation.error,
            'script_execution_unsafe',
            failedValidation.details,
            {
              details: failedValidation.details,
              scriptPolicy: {
                allowedPathPrefixes: failedValidation.policy.allowedPathPrefixes,
                timeoutMs: failedValidation.policy.maxTimeoutMs,
              },
            },
          );
        }
      }

      const activeVersion = currentState.activeVersion as string;
      const registryRetain = resolveRegistryRecordsToRetain(removeScope);
      // Snapshot before removal — uninstallPackageEdgeData needs the registry's edgeModels/edgeApis
      // ownership records, and removePluginRegistry(ByScope) below is about to erase the persisted copy.
      const registrySnapshotForEdgeData = readObjectRegistry(packageId);
      if (shouldRemoveEntirePluginRegistry(packageId, removeScope)) {
        this.deps.registry.removePluginRegistry(packageId);
      } else {
        this.deps.registry.removePluginRegistryByScope(packageId, registryRetain);
      }

      const registryManifestForRollback = uninstallManifest && !isVerticalAppManifest(uninstallManifest)
        ? uninstallManifest
        : null;

      if (removeScope.portal_nav) {
        await rollbackInstalledExtensionPlatformCapabilities(packageId, registryManifestForRollback);
      }

      await uninstallPackageHomePortalClaim(packageId);

      if (removeScope.files) {
        await rollbackPluginDeployment(packageId);
        if (packageId === HAWIETY_PACKAGE_ID) {
          unpublishHawietyPlatformRegistry();
        }
      }

      // Edge data (models/APIs) shares the "files" gate with ui_routes — no dedicated scope toggle.
      // Torn down before DB uninstall scripts run, so metadata disappears before the table it describes.
      if (removeScope.files && registrySnapshotForEdgeData) {
        uninstallPackageEdgeData(registrySnapshotForEdgeData);
        void uninstallPackageWorkflows(registrySnapshotForEdgeData);
      }

      // Navigation patches and culture keys belong to Portal, not Deployment. Remote Hubs
      // has no ui_routes/files, so gating them on `files` left the Studio group in place.
      if (removeScope.portal_nav || removeScope.files) {
        await uninstallPackageCultureKeys(packageId);
        await uninstallPackageNavigationPatch(packageId);
      }

      if (uninstallManifest) {
        const protectedEntries = collectProtectedRuntimeEntries(uninstallManifest, removeScope);
        const runtimeEntriesToRemove = collectRuntimeEntriesToRemove(uninstallManifest, removeScope);
        if (runtimeEntriesToRemove.length > 0) {
          removePackageRuntimeEntries(packageId, activeVersion, runtimeEntriesToRemove);
        }

        if (removeScope.files) {
          if (isVerticalAppManifest(uninstallManifest)) {
            removePluginVerticalRuntime(packageId, activeVersion);
          } else {
            removeUnprotectedPackageRuntimeFiles(packageId, activeVersion, protectedEntries);
          }
        }

        const removesEntireExtensionRuntimeRoot = removeScope.apis
          && removeScope.ui_components
          && removeScope.files
          && !isVerticalAppManifest(uninstallManifest);
        if (removesEntireExtensionRuntimeRoot) {
          removePluginUiRuntime(packageId, activeVersion);
        }

        if (removeScope.apis) {
          removePluginApiRuntime(packageId, activeVersion);
        }
      } else if (currentState.activeVersion) {
        const orphanVersion = currentState.activeVersion;
        if (removeScope.files || removeScope.apis || removeScope.ui_components) {
          removePluginUiRuntime(packageId, orphanVersion);
        }
      }

      const ranDbUninstallScripts = Boolean(uninstallManifest && runDbUninstallScripts);
      if (ranDbUninstallScripts && uninstallManifest) {
        const registryManifest = isVerticalAppManifest(uninstallManifest)
          ? manifestForRegistry(uninstallManifest)
          : uninstallManifest;
        await runPluginUninstallDbScripts(
          packageId,
          currentState.activeVersion as string,
          registryManifest,
          currentState.targetDataSource || 'default',
          { includeOptionalRecords: currentState.optionalRecordsInstalled !== false },
        );
      }
      const retainedArtifacts = resolveUninstallRetainedArtifacts(
        uninstallManifest,
        removeScope,
        activeVersion,
      );

      this.deps.installState.completeUninstall(uninstallingState, ctx, { retainedArtifacts });
      this.deps.dependency.refreshGraph();

      const libraryNames = readPackageLibraries(uninstallManifest ?? undefined).map((item) => item.name);
      if (libraryNames.length > 0) {
        const pruneLibraries = this.deps.pruneLibraries
          ?? (async (names: string[]) => {
            const { getDeveloperLibrariesService } = await import('../libraries/developerLibraries.service');
            await getDeveloperLibrariesService().pruneUnreferencedLibraries(names);
          });
        try {
          await pruneLibraries(libraryNames);
        } catch {
          // Package uninstall already committed. Leftover libs are recoverable via Libraries UI.
        }
      }

      this.deps.installState.emitUninstallSucceeded(ctx, {
        removeScope,
        runDbUninstallScripts,
        dbUninstallScriptHandling: ranDbUninstallScripts
          ? 'executed'
          : (runDbUninstallScripts ? 'skipped_no_manifest' : 'skipped'),
      });
      openApiSpecService.invalidate();
      invalidatePlatformRuntimeConfig();

      return {
        success: true,
        packageId,
        version: null,
        status: 'not_installed',
        idempotent: false,
        operation: 'uninstall',
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Uninstall failed due to an unexpected error.',
        code: 'internal_error',
        operation: 'uninstall',
      };
    } finally {
      this.deps.locks.releaseLock(`package-${packageId}`);
      this.deps.locks.releaseLock('index');
    }
  }

  async reinstall(
    packageId: string,
    actor: string,
    options: InstallPackageOptions = {},
  ): Promise<PackageLifecycleResult> {
    ensurePackageStorageDirs();
    const uninstallResult = await this.uninstall(packageId, actor, {
      removeScope: {
        ...DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE,
        runDbUninstallScripts: false,
      },
    });
    if (!uninstallResult.success) {
      return {
        ...uninstallResult,
        operation: 'reinstall',
      };
    }

    const installResult = await this.install(packageId, actor, {
      ...options,
      skipInstallDbScripts: options.skipInstallDbScripts ?? true,
    });
    if (!installResult.success) {
      return {
        ...installResult,
        operation: 'reinstall',
      };
    }

    return {
      ...installResult,
      operation: 'reinstall',
      idempotent: uninstallResult.idempotent && installResult.idempotent,
    };
  }

  async applyDeployment(
    packageId: string,
    actor: string,
    actorId: number | null,
  ): Promise<PackageLifecycleResult> {
    ensurePackageStorageDirs();

    const operationId = makeOperationId();
    const currentState = this.deps.installState.getState(packageId);
    const ctx: LifecycleOperationContext = {
      packageId,
      actor,
      operationId,
      version: currentState.activeVersion,
    };

    if (!this.deps.locks.acquirePackageLock(packageId)) {
      return {
        success: false,
        error: 'Package is locked by another operation. Please retry.',
        code: 'busy',
        operation: 'install',
      };
    }

    try {
      const preview = readPackageRegistryProposalPreview(packageId);
      const result = (
        currentState.pluginKind === 'extension'
        || (preview && isExtensionUiRoutesPreview(preview))
      )
        ? await applyPendingExtensionUiRoutes(packageId, actorId)
        : await applyPendingVerticalAppDeployment(packageId, actorId);
      if (result.ok === false) {
        return {
          success: false,
          error: result.error,
          code: result.code,
          details: result.details,
          operation: 'install',
        };
      }

      this.deps.installState.updateDeploymentStatus(packageId, 'applied');
      if (packageId === HAWIETY_PACKAGE_ID) {
        publishHawietyPlatformRegistryFromSnapshot();
      }
      this.deps.installState.emitInstallSucceeded(ctx, {
        deploymentApplied: true,
      });
      openApiSpecService.invalidate();

      return {
        success: true,
        packageId,
        version: currentState.activeVersion,
        status: 'installed',
        pluginKind: currentState.pluginKind ?? 'extension',
        deploymentStatus: 'applied',
        idempotent: false,
        operation: 'install',
      };
    } finally {
      this.deps.locks.releaseLock(`package-${packageId}`);
    }
  }

  enable(packageId: string, actor: string): PackageLifecycleResult {
    ensurePackageStorageDirs();

    const operationId = makeOperationId();
    const currentState = this.deps.installState.getState(packageId);
    const ctx: LifecycleOperationContext = {
      packageId,
      actor,
      operationId,
      version: currentState.activeVersion,
    };

    if (!this.deps.locks.acquirePackageLock(packageId)) {
      return {
        success: false,
        error: 'Package is locked by another operation. Please retry.',
        code: 'busy',
        operation: 'enable',
      };
    }

    try {
      const preflight = this.deps.installState.checkEnablePreflight(currentState, packageId);
      if (preflight) {
        return preflight;
      }

      this.deps.installState.completeEnable(currentState, ctx);
      this.deps.installState.emitEnableSucceeded(ctx);
      openApiSpecService.invalidate();

      return {
        success: true,
        packageId,
        version: currentState.activeVersion,
        status: 'installed',
        enabled: true,
        idempotent: false,
        operation: 'enable',
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Enable failed due to an unexpected error.',
        code: 'internal_error',
        operation: 'enable',
      };
    } finally {
      this.deps.locks.releaseLock(`package-${packageId}`);
    }
  }

  disable(packageId: string, actor: string): PackageLifecycleResult {
    ensurePackageStorageDirs();

    const operationId = makeOperationId();
    const currentState = this.deps.installState.getState(packageId);
    const ctx: LifecycleOperationContext = {
      packageId,
      actor,
      operationId,
      version: currentState.activeVersion,
    };

    if (!this.deps.locks.acquirePackageLock(packageId)) {
      return {
        success: false,
        error: 'Package is locked by another operation. Please retry.',
        code: 'busy',
        operation: 'disable',
      };
    }

    try {
      const preflight = this.deps.installState.checkDisablePreflight(currentState, packageId);
      if (preflight) {
        return preflight;
      }

      this.deps.installState.completeDisable(currentState, ctx);
      this.deps.installState.emitDisableSucceeded(ctx);
      openApiSpecService.invalidate();

      return {
        success: true,
        packageId,
        version: currentState.activeVersion,
        status: 'installed',
        enabled: false,
        idempotent: false,
        operation: 'disable',
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Disable failed due to an unexpected error.',
        code: 'internal_error',
        operation: 'disable',
      };
    } finally {
      this.deps.locks.releaseLock(`package-${packageId}`);
    }
  }
}

export const createPackageLifecycleCoordinator = (
  deps: Partial<PackageLifecycleCoordinatorDeps> = {},
): PackageLifecycleCoordinator =>
  new DefaultPackageLifecycleCoordinator({
    locks: deps.locks ?? createPackageLockGateway(),
    installState: deps.installState ?? createPackageInstallStateService(),
    registry: deps.registry ?? createPackageRegistryService(),
    dependency: deps.dependency ?? createPackageDependencyService(),
    scriptPolicy: deps.scriptPolicy ?? createPackageScriptPolicyService(),
    satisfyLibraries: deps.satisfyLibraries,
    pruneLibraries: deps.pruneLibraries,
  });

let defaultCoordinator: PackageLifecycleCoordinator | null = null;

export const getDefaultPackageLifecycleCoordinator = (): PackageLifecycleCoordinator => {
  if (!defaultCoordinator) {
    defaultCoordinator = createPackageLifecycleCoordinator();
  }
  return defaultCoordinator;
};

export const resetDefaultPackageLifecycleCoordinator = (): void => {
  defaultCoordinator = null;
};
