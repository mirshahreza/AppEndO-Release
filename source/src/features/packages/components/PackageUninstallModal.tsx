import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { fetchPackageDetail } from '../../../shared/api/queries/packages';
import type {
  PackageUninstallRemoveScope,
  PackageUninstallScopeOptionKey,
} from '../../../shared/api/contracts/package/uninstall';
import { AppButton, ConfirmDialogShell, FeatureToggleField } from '../../../shared/ui';
import type { PackageBundleManifest } from '../../../shared/api/contracts/package-manifest/types';
import type { PackageRow } from '../types';
import {
  buildDefaultPackageUninstallRemoveScope,
  isPackageUninstallScriptOptionRunnable,
  listVisiblePackageUninstallCapabilityOptions,
  listVisiblePackageUninstallScriptOptions,
  resolvePackageUninstallScopeHint,
  resolvePackageUninstallScopeLabel,
  type PackageUninstallScopeContext,
  type PackageUninstallSqlHints,
} from '../utils';

export type PluginUninstallModalProps = {
  target: PackageRow | null;
  removeScope: PackageUninstallRemoveScope;
  onRemoveScopeChange: (scope: PackageUninstallRemoveScope) => void;
  isUninstalling: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const renderScopeOption = (
  optionKey: PackageUninstallScopeOptionKey,
  manifest: PackageBundleManifest | null,
  scopeContext: PackageUninstallScopeContext | undefined,
  sqlHints: PackageUninstallSqlHints,
  removeScope: PackageUninstallRemoveScope,
  onToggle: (key: PackageUninstallScopeOptionKey, checked: boolean) => void,
) => {
  const isUninstallScriptOption = optionKey === 'runDbUninstallScripts';
  const uninstallScriptsRunnable = isPackageUninstallScriptOptionRunnable(manifest, sqlHints);
  const isDisabled = isUninstallScriptOption && !uninstallScriptsRunnable;
  const isChecked = isUninstallScriptOption && !uninstallScriptsRunnable
    ? false
    : removeScope[optionKey] !== false;

  return (
    <FeatureToggleField
      key={optionKey}
      id={`package-uninstall-scope-${optionKey}`}
      checked={isChecked}
      disabled={isDisabled}
      onChange={(checked) => onToggle(optionKey, checked)}
      title={resolvePackageUninstallScopeLabel(optionKey, manifest, scopeContext)}
      titleClassName={isDisabled ? 'text-slate-400' : 'text-slate-700'}
      description={resolvePackageUninstallScopeHint(optionKey, manifest, scopeContext, sqlHints)}
      descriptionClassName="text-[11px] text-slate-500"
    />
  );
};

export const PackageUninstallModal: React.FC<PluginUninstallModalProps> = ({
  target,
  removeScope,
  onRemoveScopeChange,
  isUninstalling,
  onClose,
  onConfirm,
}) => {
  const [manifest, setManifest] = useState<PackageBundleManifest | null>(null);
  const [sqlHints, setSqlHints] = useState<PackageUninstallSqlHints>({});
  const [isManifestLoading, setIsManifestLoading] = useState(false);

  const scopeContext = useMemo<PackageUninstallScopeContext | undefined>(() => {
    if (!target) return undefined;
    return {
      pluginKind: target.pluginKind,
      deploymentStatus: target.deploymentStatus,
    };
  }, [target]);

  useEffect(() => {
    if (!target) {
      setManifest(null);
      setSqlHints({});
      setIsManifestLoading(false);
      return;
    }

    let cancelled = false;
    setIsManifestLoading(true);

    void fetchPackageDetail(target.packageId, target.activeInstalledVersion ?? target.version)
      .then((detail) => {
        if (cancelled) return;
        const bundleManifest = detail?.bundleManifest ?? null;
        const nextSqlHints: PackageUninstallSqlHints = {
          uninstallSql: detail?.uninstallSql,
        };
        setManifest(bundleManifest);
        setSqlHints(nextSqlHints);
        onRemoveScopeChange(buildDefaultPackageUninstallRemoveScope(bundleManifest, {
          pluginKind: detail?.pluginKind ?? target.pluginKind,
          deploymentStatus: detail?.deploymentStatus ?? target.deploymentStatus,
        }, nextSqlHints));
      })
      .catch(() => {
        if (cancelled) return;
        setManifest(null);
        setSqlHints({});
        onRemoveScopeChange(buildDefaultPackageUninstallRemoveScope());
      })
      .finally(() => {
        if (!cancelled) setIsManifestLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onRemoveScopeChange, target]);

  const capabilityOptions = useMemo(
    () => listVisiblePackageUninstallCapabilityOptions(manifest, scopeContext),
    [manifest, scopeContext],
  );

  const scriptOptions = useMemo(
    () => listVisiblePackageUninstallScriptOptions(manifest),
    [manifest],
  );

  const showDatabaseScriptsSection = Boolean(manifest) && !isManifestLoading;
  const hasRemovalOptions = capabilityOptions.length > 0 || showDatabaseScriptsSection;

  const toggleScopeOption = (key: PackageUninstallScopeOptionKey, checked: boolean) => {
    onRemoveScopeChange({
      ...removeScope,
      [key]: checked,
    });
  };

  if (!target) return null;

  const installedVersion = target.activeInstalledVersion ?? target.version;

  return (
    <ConfirmDialogShell
      size="lg"
      bodyClassName="min-h-[220px]"
      title="Uninstall Package"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={onClose} disabled={isUninstalling}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="destructive"
            size="sm"
            onClick={() => void onConfirm()}
            disabled={isUninstalling || isManifestLoading}
          >
            {isUninstalling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Uninstall
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-3" dir="ltr">
        <div className="flex flex-col gap-2 text-sm text-slate-700">
          <p className="text-start font-semibold text-slate-800">
            Are you sure you want to uninstall this package?
          </p>
          <p className="text-start text-xs text-slate-600">
            Uncheck any capability you want to keep on this node. Checked items are removed during uninstall.
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span className="font-semibold text-slate-800">{target.displayName}</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-slate-600">v{installedVersion}</span>
          </div>
        </div>

        {isManifestLoading ? (
          <div className="flex items-center gap-2 py-1 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading package capabilities…
          </div>
        ) : null}

        {!isManifestLoading && capabilityOptions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="ps-[4px] text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Remove during uninstall
            </p>
            {capabilityOptions.map((optionKey) => renderScopeOption(
              optionKey,
              manifest,
              scopeContext,
              sqlHints,
              removeScope,
              toggleScopeOption,
            ))}
          </div>
        ) : null}

        {showDatabaseScriptsSection ? (
          <div className="mt-2 flex flex-col gap-2 pt-4">
            <p className="ps-[4px] text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Database scripts
            </p>
            {scriptOptions.map((optionKey) => renderScopeOption(
              optionKey,
              manifest,
              scopeContext,
              sqlHints,
              removeScope,
              toggleScopeOption,
            ))}
          </div>
        ) : null}

        {!isManifestLoading && manifest && !hasRemovalOptions ? (
          <p className="text-xs text-slate-500">
            This package has no optional capabilities to remove. Uninstall will clear the install state only.
          </p>
        ) : null}
      </div>
    </ConfirmDialogShell>
  );
};
