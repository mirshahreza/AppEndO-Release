import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { columnCommonKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { cn } from '../../../lib/utils';
import { renderBooleanIcon } from '../../../shared/lib/gridCellRenderers';
import { AppButton, CreateEditModalShell, UiCheckboxChoice, UiSelect } from '../../../shared/ui';
import { FORM_FIELD_LABEL_CLASS, FormSection } from '../../../shared/ui/FormSection';
import type { PackageInstallPreview } from '../../../shared/api/contracts/package/artifactPreview';
import type { PackageBundleManifest } from '../../../shared/api/contracts/package-manifest/types';
import { mapDataSources } from '../../../shared/api/contracts/server-functions/mappers';
import { useDataSourcesQuery } from '../../../shared/api/queries/data-sources';
import { previewPackageInstall } from '../../../shared/api/queries/packageStudio';
import type { PackageRow } from '../types';
import {
  isPackageVersionSwitch,
  PACKAGE_INSTALL_OVERRIDE_POLICY,
  packageHasInstallScripts,
  packageHasOptionalRecords,
  packageHasUninstallScripts,
} from '../utils';
import { compareSemver } from '../../../shared/lib/semver';

export type PluginInstallModalProps = {
  target: PackageRow | null;
  targetDataSource: string;
  onTargetDataSourceChange: (value: string) => void;
  isInstalling: boolean;
  installOptionalRecords: boolean;
  onInstallOptionalRecordsChange: (value: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
};

const DETAIL_FIELD_LABEL_CLASS = cn(FORM_FIELD_LABEL_CLASS, 'normal-case tracking-normal text-slate-500');

const MANIFEST_FIELD_GRID_CLASS = 'grid grid-cols-[minmax(10rem,38%)_minmax(0,1fr)] items-start gap-x-4 py-1.5';

const DetailField: React.FC<{ label: string; value: React.ReactNode; emphasize?: boolean }> = ({
  label,
  value,
  emphasize = false,
}) => (
  <div className={MANIFEST_FIELD_GRID_CLASS}>
    <div className={cn(DETAIL_FIELD_LABEL_CLASS, emphasize && 'font-bold text-blue-700')}>{label}</div>
    <div
      className={cn(
        'min-w-0 text-left text-sm break-words',
        emphasize ? 'font-bold text-blue-700' : 'font-medium text-slate-800',
      )}
    >
      {value}
    </div>
  </div>
);

type ManifestSummary = {
  description?: string;
  requiredAppVersion: string;
  dependencies: Array<{ packageId?: string; versionRange?: string }>;
  libraries: Array<{ name?: string; versionRange?: string }>;
  apiCount: number;
  uiCount: number;
  workflowCount: number;
  hasInstallScripts: boolean;
  hasUninstallScripts: boolean;
  pluginKind: string;
};

function readBundleManifest(preview: PackageInstallPreview | null): PackageBundleManifest | null {
  if (!preview?.manifest) return null;
  return preview.manifest as unknown as PackageBundleManifest;
}

function readManifestTextValue(value: unknown): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || undefined;
}

function readManifestSummary(preview: PackageInstallPreview | null): ManifestSummary | null {
  if (!preview) return null;

  const manifest = readBundleManifest(preview);
  if (!manifest) return null;

  const capabilities = manifest.capabilities ?? { apis: [], ui_components: [], db_objects: [] };
  const requiredAppVersion = readManifestTextValue(manifest.requiredAppVersion);

  return {
    description: readManifestTextValue(manifest.description),
    requiredAppVersion: requiredAppVersion ?? '-',
    dependencies: Array.isArray(manifest.dependencies) ? manifest.dependencies : [],
    libraries: Array.isArray((manifest as { libraries?: unknown }).libraries)
      ? (manifest as { libraries: Array<{ name?: string; versionRange?: string }> }).libraries
      : [],
    apiCount: Array.isArray(capabilities.apis) ? capabilities.apis.length : 0,
    uiCount: Array.isArray(capabilities.ui_components) ? capabilities.ui_components.length : 0,
    workflowCount: Array.isArray(capabilities.workflows) ? capabilities.workflows.length : 0,
    hasInstallScripts: packageHasInstallScripts(manifest),
    hasUninstallScripts: packageHasUninstallScripts(manifest),
    pluginKind: preview.pluginKind,
  };
}

function formatPluginKind(kind: string, t: (key: string) => string): string {
  if (kind === 'vertical-app') return t('packages.kind.verticalApp');
  if (kind === 'extension') return t('packages.kind.extension');
  return kind;
}

export const PackageInstallModal: React.FC<PluginInstallModalProps> = ({
  target,
  targetDataSource,
  onTargetDataSourceChange,
  isInstalling,
  installOptionalRecords,
  onInstallOptionalRecordsChange,
  onClose,
  onConfirm,
}) => {
  const t = useCultureT();
  const [installPreview, setInstallPreview] = useState<PackageInstallPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [hasDbScripts, setHasDbScripts] = useState(false);
  const previewContextKeyRef = useRef<string | null>(null);

  const isSwitchVersion = target ? isPackageVersionSwitch(target) : false;

  const manifestSummary = useMemo(() => readManifestSummary(installPreview), [installPreview]);
  const hasOptionalRecords = packageHasOptionalRecords(readBundleManifest(installPreview));
  const isUpgrade = Boolean(
    isSwitchVersion
    && target?.activeInstalledVersion
    && compareSemver(target.version, target.activeInstalledVersion) > 0,
  );
  const confirmButtonLabel = isSwitchVersion
    ? (isUpgrade ? t('packages.install.confirmUpgrade') : t('packages.install.confirmSwitch'))
    : t('packages.install.confirmInstall');

  const dataSourcesQuery = useDataSourcesQuery({ enabled: Boolean(target) && hasDbScripts });
  const dataSources = useMemo(
    () => mapDataSources(dataSourcesQuery.data?.items ?? []),
    [dataSourcesQuery.data?.items],
  );

  const isConnectionDisabled = dataSources.length === 0;

  useEffect(() => {
    if (!target) {
      setInstallPreview(null);
      setIsPreviewLoading(false);
      setHasDbScripts(false);
      previewContextKeyRef.current = null;
      return;
    }

    const contextKey = `${target.packageId}:${target.version}:${targetDataSource}`;
    const isContextChange = previewContextKeyRef.current !== contextKey;
    if (isContextChange) {
      previewContextKeyRef.current = contextKey;
      setIsPreviewLoading(true);
    }

    let cancelled = false;
    void previewPackageInstall({
      packageId: target.packageId,
      version: target.version,
      targetDataSource,
      overridePolicy: PACKAGE_INSTALL_OVERRIDE_POLICY,
    })
      .then((preview) => {
        if (cancelled) return;
        setInstallPreview(preview);
        setHasDbScripts(packageHasInstallScripts(readBundleManifest(preview)));
      })
      .catch(() => {
        if (!cancelled) return;
      })
      .finally(() => {
        if (!cancelled && isContextChange) {
          setIsPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [target, targetDataSource]);

  useEffect(() => {
    if (!target || !hasDbScripts || dataSources.length === 0) {
      return;
    }

    const preferredId = dataSources.find((item) => item.isDefault)?.id || dataSources[0]?.id;
    if (!preferredId) {
      return;
    }

    const hasCurrent = dataSources.some((item) => item.id === targetDataSource);
    if (!hasCurrent) {
      onTargetDataSourceChange(preferredId);
    }
  }, [dataSources, hasDbScripts, onTargetDataSourceChange, target, targetDataSource]);

  if (!target) return null;

  const subtitle = (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
      <span className="font-semibold text-slate-800">{target.displayName}</span>
      <span className="text-slate-400">·</span>
      <span className="font-mono text-slate-600">v{target.version}</span>
      {isSwitchVersion && target.activeInstalledVersion ? (
        <>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">
            {t('packages.install.switchingFrom', { version: `v${target.activeInstalledVersion}` })}
          </span>
        </>
      ) : null}
    </div>
  );

  return (
    <CreateEditModalShell
      size="2xl"
      shellClassName="flex min-h-[min(560px,88vh)] flex-col"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col"
      title={isSwitchVersion ? t('packages.install.switchTitle') : t('packages.install.title')}
      subtitle={subtitle}
      subtitleTone="elevated"
      subtitleClassName="py-2.5 text-[13px]"
      onClose={onClose}
      closeOnEscape={false}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
            {t('actions.cancel')}
          </AppButton>
          <AppButton intent="confirm" onClick={() => void onConfirm()} disabled={isInstalling || installPreview?.installBlocked}>
            {isInstalling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {confirmButtonLabel}
          </AppButton>
        </>
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        {isPreviewLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('packages.install.loadingPreview')}
          </div>
        ) : null}

        {manifestSummary ? (
          <FormSection title={t('packages.install.manifestOverview')} ink="accent">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col">
                <DetailField
                  label={t('packages.install.packageKind')}
                  value={formatPluginKind(manifestSummary.pluginKind, t)}
                  emphasize
                />
                <DetailField
                  label={t('packages.install.requiredAppVersion')}
                  value={manifestSummary.requiredAppVersion}
                  emphasize={manifestSummary.requiredAppVersion !== '-'}
                />
                <DetailField
                  label={t('packages.install.apis')}
                  value={manifestSummary.apiCount}
                  emphasize={manifestSummary.apiCount > 0}
                />
                <DetailField
                  label={t('packages.install.uiComponents')}
                  value={manifestSummary.uiCount}
                  emphasize={manifestSummary.uiCount > 0}
                />
                <DetailField
                  label={t('packages.install.workflows')}
                  value={manifestSummary.workflowCount}
                  emphasize={manifestSummary.workflowCount > 0}
                />
                <DetailField
                  label={t('packages.install.dbInstallScripts')}
                  value={<span className="inline-flex">{renderBooleanIcon(manifestSummary.hasInstallScripts)}</span>}
                  emphasize={manifestSummary.hasInstallScripts}
                />
                <DetailField
                  label={t('packages.install.dbUninstallScripts')}
                  value={<span className="inline-flex">{renderBooleanIcon(manifestSummary.hasUninstallScripts)}</span>}
                  emphasize={manifestSummary.hasUninstallScripts}
                />
                <DetailField
                  label={t('packages.install.dependencies')}
                  value={manifestSummary.dependencies.length}
                  emphasize={manifestSummary.dependencies.length > 0}
                />
                <DetailField
                  label="Libraries"
                  value={manifestSummary.libraries.length}
                  emphasize={manifestSummary.libraries.length > 0}
                />
              </div>

              {manifestSummary.description ? (
                <DetailField label={t('packages.common.description')} value={manifestSummary.description} emphasize />
              ) : null}

              {manifestSummary.dependencies.length > 0 ? (
                <div className="rounded-md border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-2.5 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-slate-500">
                          {t(columnCommonKey('dependency'))}
                        </th>
                        <th className="px-2.5 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-slate-500">
                          {t('packages.install.versionRange')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {manifestSummary.dependencies.map((dep) => (
                        <tr key={`${dep.packageId}-${dep.versionRange}`}>
                          <td className="px-2.5 py-2 font-mono text-slate-700">{dep.packageId ?? '-'}</td>
                          <td className="px-2.5 py-2 font-mono text-slate-600">{dep.versionRange ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {manifestSummary.libraries.length > 0 ? (
                <div className="rounded-md border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-2.5 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-slate-500">
                          Library
                        </th>
                        <th className="px-2.5 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-slate-500">
                          {t('packages.install.versionRange')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {manifestSummary.libraries.map((library) => (
                        <tr key={`${library.name}-${library.versionRange}`}>
                          <td className="px-2.5 py-2 font-mono text-slate-700">{library.name ?? '-'}</td>
                          <td className="px-2.5 py-2 font-mono text-slate-600">{library.versionRange ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </FormSection>
        ) : !isPreviewLoading ? (
          <p className="text-xs text-slate-500">{t('packages.install.previewUnavailable')}</p>
        ) : null}

        {hasDbScripts ? (
          <div className="flex flex-col gap-[2px]">
            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">{t('packages.install.targetDataSource')}</label>
            {dataSourcesQuery.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('packages.install.loadingConnections')}
              </div>
            ) : (
              <UiSelect
                value={targetDataSource}
                onChange={(event) => onTargetDataSourceChange(event.target.value)}
                disabled={isConnectionDisabled}
                ariaLabel={t('packages.install.targetDataSource')}
              >
                {dataSources.length === 0 ? (
                  <option value={targetDataSource}>{targetDataSource || 'default'}</option>
                ) : (
                  dataSources.map((source) => {
                    const label = `${source.name}${source.isDefault ? ` ${t('packages.install.dataSourceDefault')}` : ''}`;
                    return (
                      <option key={source.id} value={source.id}>
                        {label}
                      </option>
                    );
                  })
                )}
              </UiSelect>
            )}
          </div>
        ) : null}

        {hasOptionalRecords ? (
          <div className="flex flex-col gap-1">
            <UiCheckboxChoice
              id="package-install-optional-records"
              checked={installOptionalRecords}
              onChange={onInstallOptionalRecordsChange}
            >
              {t('packages.install.initialRecords')}
            </UiCheckboxChoice>
            <p className="text-[11px] text-slate-500">{t('packages.install.initialRecordsHint')}</p>
          </div>
        ) : null}

        {target.dependencyIssues.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <div className="font-semibold mb-1">{t('packages.install.dependencyWarnings')}</div>
            {target.dependencyIssues.map((issue) => (
              <div key={issue}>{issue}</div>
            ))}
          </div>
        )}

        {installPreview?.dependencyIssues.length ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <div className="font-semibold mb-1">{t('packages.install.dependencyIssues')}</div>
            {installPreview.dependencyIssues.map((issue) => (
              <div key={issue}>{issue}</div>
            ))}
          </div>
        ) : null}

        {installPreview?.conflicts.length ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <div className="font-semibold mb-1">{t('packages.install.objectConflicts')}</div>
            {installPreview.conflicts.map((item) => (
              <div key={`${item.objectType}-${item.conflictKey}`}>
                {item.objectType}: {item.conflictKey} (owned by {item.ownerPackageId})
                {item.blocked ? ' — blocked' : ' — will be overridden'}
              </div>
            ))}
          </div>
        ) : null}

        {installPreview?.installBlocked && installPreview.blockReason ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {installPreview.blockReason}
          </div>
        ) : null}
      </div>
    </CreateEditModalShell>
  );
};
