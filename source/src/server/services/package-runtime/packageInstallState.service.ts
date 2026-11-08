import {
  appendStateHistory,
  readInstallStateV1,
  writeInstallState,
} from '../../domain/package-domain/installStateRepository';
import type {
  InstallHistoryEntry,
  InstallOperationInfo,
  InstallStateV1,
  LifecycleStatusCode,
  PackageLifecycleResult,
  RetainedPackageArtifactsV1,
} from '../../domain/package-domain/types';
import { isNotFoundError, makeBaseState, nowIso } from '../../domain/package-domain/utils';
import type { PackageEventGateway } from './gateways';
import { createPackageEventGateway } from './gateways';

export type LifecycleOperationContext = {
  packageId: string;
  actor: string;
  operationId: string;
  version: string | null;
};

export interface PackageInstallStateService {
  getState(packageId: string): InstallStateV1;
  checkInstallPreflight(
    state: InstallStateV1,
    packageId: string,
    targetVersion: string,
  ): PackageLifecycleResult | null;
  checkUninstallPreflight(state: InstallStateV1, packageId: string): PackageLifecycleResult | null;
  beginInstall(
    state: InstallStateV1,
    ctx: LifecycleOperationContext,
    targetDataSource: string,
  ): InstallStateV1;
  completeInstall(
    installingState: InstallStateV1,
    ctx: LifecycleOperationContext,
    targetDataSource: string,
    options?: {
      pluginKind?: 'extension' | 'vertical-app';
      deploymentStatus?: 'none' | 'pending' | 'applied';
      optionalRecordsInstalled?: boolean;
    },
  ): InstallStateV1;
  beginUninstall(state: InstallStateV1, ctx: LifecycleOperationContext): InstallStateV1;
  completeUninstall(
    uninstallingState: InstallStateV1,
    ctx: LifecycleOperationContext,
    options?: { retainedArtifacts?: RetainedPackageArtifactsV1 | null },
  ): InstallStateV1;
  failInstallFromInstalling(
    installingState: InstallStateV1,
    ctx: LifecycleOperationContext,
    error: string,
    code: LifecycleStatusCode,
    details?: string[],
    eventPayload?: Record<string, unknown>,
  ): PackageLifecycleResult;
  failUninstallFromUninstalling(
    uninstallingState: InstallStateV1,
    ctx: LifecycleOperationContext,
    error: string,
    code: LifecycleStatusCode,
    details?: string[],
    eventPayload?: Record<string, unknown>,
  ): PackageLifecycleResult;
  recordUnexpectedInstallFailure(
    packageId: string,
    ctx: LifecycleOperationContext,
    message: string,
  ): PackageLifecycleResult;
  emitInstallSucceeded(
    ctx: LifecycleOperationContext,
    payload: Record<string, unknown>,
  ): void;
  emitUninstallRequested(
    ctx: LifecycleOperationContext,
    payload: Record<string, unknown>,
  ): void;
  emitUninstallSucceeded(
    ctx: LifecycleOperationContext,
    payload: Record<string, unknown>,
  ): void;
  updateDeploymentStatus(
    packageId: string,
    deploymentStatus: 'none' | 'pending' | 'applied',
  ): InstallStateV1 | null;
  checkEnablePreflight(state: InstallStateV1, packageId: string): PackageLifecycleResult | null;
  checkDisablePreflight(state: InstallStateV1, packageId: string): PackageLifecycleResult | null;
  completeEnable(state: InstallStateV1, ctx: LifecycleOperationContext): InstallStateV1;
  completeDisable(state: InstallStateV1, ctx: LifecycleOperationContext): InstallStateV1;
  emitEnableSucceeded(ctx: LifecycleOperationContext): void;
  emitDisableSucceeded(ctx: LifecycleOperationContext): void;
}

export type PackageInstallStateServiceDeps = {
  events: PackageEventGateway;
};

export class DefaultPackageInstallStateService implements PackageInstallStateService {
  constructor(private readonly deps: PackageInstallStateServiceDeps) {}

  getState(packageId: string): InstallStateV1 {
    return readInstallStateV1(packageId) ?? makeBaseState(packageId);
  }

  checkInstallPreflight(
    state: InstallStateV1,
    packageId: string,
    targetVersion: string,
  ): PackageLifecycleResult | null {
    if (state.status === 'installed' && state.activeVersion === targetVersion) {
      return {
        success: true,
        packageId,
        version: targetVersion,
        status: 'installed',
        idempotent: true,
        operation: 'install',
      };
    }

    if (state.status === 'installing' || state.status === 'uninstalling') {
      return {
        success: false,
        error: `Package "${packageId}" is currently busy (${state.status}).`,
        code: 'busy',
        operation: 'install',
      };
    }

    if (state.status === 'installed' && state.activeVersion && state.activeVersion !== targetVersion) {
      return {
        success: false,
        error: `Package "${packageId}" is already installed with version "${state.activeVersion}". Use reinstall to switch versions.`,
        code: 'already_installed_other_version',
        operation: 'install',
      };
    }

    return null;
  }

  checkUninstallPreflight(state: InstallStateV1, packageId: string): PackageLifecycleResult | null {
    if (state.status === 'not_installed' || !state.activeVersion) {
      return {
        success: true,
        packageId,
        version: null,
        status: 'not_installed',
        idempotent: true,
        operation: 'uninstall',
      };
    }

    if (state.status === 'installing' || state.status === 'uninstalling') {
      return {
        success: false,
        error: `Package "${packageId}" is currently busy (${state.status}).`,
        code: 'busy',
        operation: 'uninstall',
      };
    }

    return null;
  }

  beginInstall(
    state: InstallStateV1,
    ctx: LifecycleOperationContext,
    targetDataSource: string,
  ): InstallStateV1 {
    const startedAt = nowIso();
    const installingState: InstallStateV1 = {
      ...state,
      status: 'installing',
      targetDataSource,
      lastOperation: {
        operation: 'install',
        operationId: ctx.operationId,
        requestedBy: ctx.actor,
        startedAt,
        finishedAt: null,
        result: 'running',
        error: null,
      },
      updatedAt: startedAt,
    };
    writeInstallState(installingState);

    this.deps.events.append({
      type: 'package.install.requested',
      packageId: ctx.packageId,
      version: ctx.version ?? undefined,
      actor: ctx.actor,
      correlationId: ctx.operationId,
      payload: { targetDataSource },
    });

    return installingState;
  }

  completeInstall(
    installingState: InstallStateV1,
    ctx: LifecycleOperationContext,
    targetDataSource: string,
    options?: {
      pluginKind?: 'extension' | 'vertical-app';
      deploymentStatus?: 'none' | 'pending' | 'applied';
      optionalRecordsInstalled?: boolean;
    },
  ): InstallStateV1 {
    const installedState = appendStateHistory(
      {
        ...installingState,
        status: 'installed',
        activeVersion: ctx.version,
        enabled: true,
        targetDataSource,
        pluginKind: options?.pluginKind,
        deploymentStatus: options?.deploymentStatus ?? 'none',
        optionalRecordsInstalled: options?.optionalRecordsInstalled,
        retainedArtifacts: undefined,
        lastOperation: {
          ...(installingState.lastOperation as InstallOperationInfo),
          finishedAt: nowIso(),
          result: 'success',
          error: null,
        },
        updatedAt: nowIso(),
      },
      this.successHistoryEntry('install', ctx),
    );
    writeInstallState(installedState);
    return installedState;
  }

  beginUninstall(state: InstallStateV1, ctx: LifecycleOperationContext): InstallStateV1 {
    const startedAt = nowIso();
    const uninstallingState: InstallStateV1 = {
      ...state,
      status: 'uninstalling',
      lastOperation: {
        operation: 'uninstall',
        operationId: ctx.operationId,
        requestedBy: ctx.actor,
        startedAt,
        finishedAt: null,
        result: 'running',
        error: null,
      },
      updatedAt: startedAt,
    };
    writeInstallState(uninstallingState);
    return uninstallingState;
  }

  completeUninstall(
    uninstallingState: InstallStateV1,
    ctx: LifecycleOperationContext,
    options?: { retainedArtifacts?: RetainedPackageArtifactsV1 | null },
  ): InstallStateV1 {
    const retainedArtifacts = options?.retainedArtifacts ?? undefined;
    const uninstalledState = appendStateHistory(
      {
        ...uninstallingState,
        status: 'not_installed',
        activeVersion: null,
        enabled: undefined,
        pluginKind: undefined,
        deploymentStatus: undefined,
        targetDataSource: undefined,
        retainedArtifacts: retainedArtifacts ?? undefined,
        lastOperation: {
          ...(uninstallingState.lastOperation as InstallOperationInfo),
          finishedAt: nowIso(),
          result: 'success',
          error: null,
        },
        updatedAt: nowIso(),
      },
      this.successHistoryEntry('uninstall', ctx),
    );
    writeInstallState(uninstalledState);
    return uninstalledState;
  }

  failInstallFromInstalling(
    installingState: InstallStateV1,
    ctx: LifecycleOperationContext,
    error: string,
    code: LifecycleStatusCode,
    details?: string[],
    eventPayload?: Record<string, unknown>,
  ): PackageLifecycleResult {
    const failedState = appendStateHistory(
      {
        ...installingState,
        status: 'failed',
        deploymentStatus: undefined,
        lastOperation: {
          ...(installingState.lastOperation as InstallOperationInfo),
          finishedAt: nowIso(),
          result: 'failed',
          error,
        },
        updatedAt: nowIso(),
      },
      this.failureHistoryEntry('install', ctx, error),
    );
    writeInstallState(failedState);

    this.deps.events.append({
      type: 'package.install.failed',
      packageId: ctx.packageId,
      version: ctx.version ?? undefined,
      actor: ctx.actor,
      correlationId: ctx.operationId,
      payload: { error, ...(eventPayload ?? {}) },
    });

    return {
      success: false,
      error,
      code,
      details,
      operation: 'install',
    };
  }

  failUninstallFromUninstalling(
    uninstallingState: InstallStateV1,
    ctx: LifecycleOperationContext,
    error: string,
    code: LifecycleStatusCode,
    details?: string[],
    eventPayload?: Record<string, unknown>,
  ): PackageLifecycleResult {
    const failedState = appendStateHistory(
      {
        ...uninstallingState,
        status: 'installed',
        lastOperation: {
          ...(uninstallingState.lastOperation as InstallOperationInfo),
          finishedAt: nowIso(),
          result: 'failed',
          error,
        },
        updatedAt: nowIso(),
      },
      this.failureHistoryEntry('uninstall', ctx, error),
    );
    writeInstallState(failedState);

    this.deps.events.append({
      type: 'package.uninstall.failed',
      packageId: ctx.packageId,
      version: ctx.version ?? undefined,
      actor: ctx.actor,
      correlationId: ctx.operationId,
      payload: { error, ...(eventPayload ?? {}) },
    });

    return {
      success: false,
      error,
      code,
      details,
      operation: 'uninstall',
    };
  }

  recordUnexpectedInstallFailure(
    packageId: string,
    ctx: LifecycleOperationContext,
    message: string,
  ): PackageLifecycleResult {
    const existing = readInstallStateV1(packageId) ?? makeBaseState(packageId);
    const failedState = appendStateHistory(
      {
        ...existing,
        status: 'failed',
        deploymentStatus: undefined,
        updatedAt: nowIso(),
      },
      this.failureHistoryEntry('install', ctx, message),
    );
    writeInstallState(failedState);

    this.deps.events.append({
      type: 'package.install.failed',
      packageId: ctx.packageId,
      version: ctx.version ?? undefined,
      actor: ctx.actor,
      correlationId: ctx.operationId,
      payload: { error: message },
    });

    return {
      success: false,
      error: message,
      code: isNotFoundError(message) ? 'not_found' : 'internal_error',
      operation: 'install',
    };
  }

  emitInstallSucceeded(ctx: LifecycleOperationContext, payload: Record<string, unknown>): void {
    this.deps.events.append({
      type: 'package.install.succeeded',
      packageId: ctx.packageId,
      version: ctx.version ?? undefined,
      actor: ctx.actor,
      correlationId: ctx.operationId,
      payload,
    });
  }

  emitUninstallRequested(ctx: LifecycleOperationContext, payload: Record<string, unknown>): void {
    this.deps.events.append({
      type: 'package.uninstall.requested',
      packageId: ctx.packageId,
      version: ctx.version ?? undefined,
      actor: ctx.actor,
      correlationId: ctx.operationId,
      payload,
    });
  }

  emitUninstallSucceeded(ctx: LifecycleOperationContext, payload: Record<string, unknown>): void {
    this.deps.events.append({
      type: 'package.uninstall.succeeded',
      packageId: ctx.packageId,
      version: ctx.version ?? undefined,
      actor: ctx.actor,
      correlationId: ctx.operationId,
      payload,
    });
  }

  updateDeploymentStatus(
    packageId: string,
    deploymentStatus: 'none' | 'pending' | 'applied',
  ): InstallStateV1 | null {
    const state = readInstallStateV1(packageId);
    if (!state || state.status !== 'installed') {
      return null;
    }

    const nextState: InstallStateV1 = {
      ...state,
      deploymentStatus,
      updatedAt: nowIso(),
    };
    writeInstallState(nextState);
    return nextState;
  }

  checkEnablePreflight(state: InstallStateV1, packageId: string): PackageLifecycleResult | null {
    if (state.status !== 'installed' || !state.activeVersion) {
      return {
        success: false,
        error: `Package "${packageId}" is not installed.`,
        code: 'not_found',
        operation: 'enable',
      };
    }

    if (state.status === 'installing' || state.status === 'uninstalling') {
      return {
        success: false,
        error: `Package "${packageId}" is currently busy (${state.status}).`,
        code: 'busy',
        operation: 'enable',
      };
    }

    if (state.enabled !== false) {
      return {
        success: true,
        packageId,
        version: state.activeVersion,
        status: 'installed',
        enabled: true,
        idempotent: true,
        operation: 'enable',
      };
    }

    return null;
  }

  checkDisablePreflight(state: InstallStateV1, packageId: string): PackageLifecycleResult | null {
    if (state.status !== 'installed' || !state.activeVersion) {
      return {
        success: false,
        error: `Package "${packageId}" is not installed.`,
        code: 'not_found',
        operation: 'disable',
      };
    }

    if (state.status === 'installing' || state.status === 'uninstalling') {
      return {
        success: false,
        error: `Package "${packageId}" is currently busy (${state.status}).`,
        code: 'busy',
        operation: 'disable',
      };
    }

    if (state.enabled === false) {
      return {
        success: true,
        packageId,
        version: state.activeVersion,
        status: 'installed',
        enabled: false,
        idempotent: true,
        operation: 'disable',
      };
    }

    return null;
  }

  completeEnable(state: InstallStateV1, ctx: LifecycleOperationContext): InstallStateV1 {
    const enabledState = appendStateHistory(
      {
        ...state,
        enabled: true,
        lastOperation: {
          operation: 'enable',
          operationId: ctx.operationId,
          requestedBy: ctx.actor,
          startedAt: nowIso(),
          finishedAt: nowIso(),
          result: 'success',
          error: null,
        },
        updatedAt: nowIso(),
      },
      this.successHistoryEntry('enable', ctx),
    );
    writeInstallState(enabledState);
    return enabledState;
  }

  completeDisable(state: InstallStateV1, ctx: LifecycleOperationContext): InstallStateV1 {
    const disabledState = appendStateHistory(
      {
        ...state,
        enabled: false,
        lastOperation: {
          operation: 'disable',
          operationId: ctx.operationId,
          requestedBy: ctx.actor,
          startedAt: nowIso(),
          finishedAt: nowIso(),
          result: 'success',
          error: null,
        },
        updatedAt: nowIso(),
      },
      this.successHistoryEntry('disable', ctx),
    );
    writeInstallState(disabledState);
    return disabledState;
  }

  emitEnableSucceeded(ctx: LifecycleOperationContext): void {
    this.deps.events.append({
      type: 'package.enable.succeeded',
      packageId: ctx.packageId,
      version: ctx.version ?? undefined,
      actor: ctx.actor,
      correlationId: ctx.operationId,
      payload: {},
    });
  }

  emitDisableSucceeded(ctx: LifecycleOperationContext): void {
    this.deps.events.append({
      type: 'package.disable.succeeded',
      packageId: ctx.packageId,
      version: ctx.version ?? undefined,
      actor: ctx.actor,
      correlationId: ctx.operationId,
      payload: {},
    });
  }

  private successHistoryEntry(
    operation: InstallHistoryEntry['operation'],
    ctx: LifecycleOperationContext,
  ): InstallHistoryEntry {
    return {
      operation,
      version: ctx.version,
      requestedBy: ctx.actor,
      at: nowIso(),
      result: 'success',
      error: null,
    };
  }

  private failureHistoryEntry(
    operation: InstallHistoryEntry['operation'],
    ctx: LifecycleOperationContext,
    error: string,
  ): InstallHistoryEntry {
    return {
      operation,
      version: ctx.version,
      requestedBy: ctx.actor,
      at: nowIso(),
      result: 'failed',
      error,
    };
  }
}

export const createPackageInstallStateService = (
  deps: Partial<PackageInstallStateServiceDeps> = {},
): PackageInstallStateService =>
  new DefaultPackageInstallStateService({
    events: deps.events ?? createPackageEventGateway(),
  });
