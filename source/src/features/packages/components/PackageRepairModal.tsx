import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { AppButton, CreateEditModalShell, UiCheckboxChoice } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { FormSection } from '../../../shared/ui/FormSection';
import { fetchPackageRepackDrift } from '../../../shared/api/queries/packages';
import type {
  PackageRepackDriftPreview,
  PackageRepackItemCategory,
} from '../../../shared/api/contracts/package/repack';
import { PACKAGE_REPACK_CATEGORY_LABELS } from '../../../shared/api/contracts/package/repack';
import type { PackageRow } from '../types';

const CATEGORY_ORDER: PackageRepackItemCategory[] = [
  'apis',
  'ui_components',
  'ui_routes',
  'pages',
  'shell',
  'designer_layouts',
  'designer_shells',
  'db_objects',
  'static_assets',
  'portals',
  'navigations',
  'experience',
];

export type PackageRepairModalProps = {
  target: PackageRow | null;
  isRepairing: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export const PackageRepairModal: React.FC<PackageRepairModalProps> = ({
  target,
  isRepairing,
  onClose,
  onConfirm,
}) => {
  const [drift, setDrift] = useState<PackageRepackDriftPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const loadDrift = useCallback(async () => {
    if (!target) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const preview = await fetchPackageRepackDrift(target.packageId);
      setDrift(preview);
    } catch (err: unknown) {
      setDrift(null);
      setLoadError((err as Error).message || 'Failed to load package changes.');
    } finally {
      setIsLoading(false);
    }
  }, [target]);

  useEffect(() => {
    if (!target) {
      setDrift(null);
      setLoadError(null);
      setIsLoading(false);
      setAcknowledged(false);
      return;
    }
    setAcknowledged(false);
    void loadDrift();
  }, [loadDrift, target]);

  useEffect(() => {
    if (!drift?.hasChanges) {
      setAcknowledged(false);
    }
  }, [drift?.hasChanges]);

  const visibleCategories = useMemo(() => {
    if (!drift) return [];
    return CATEGORY_ORDER
      .map((category) => ({
        category,
        items: drift.changedByCategory[category] ?? [],
      }))
      .filter((group) => group.items.length > 0);
  }, [drift]);

  if (!target) return null;

  const installedVersion = drift?.baseVersion ?? target.version;

  const subtitle = (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
      <span className="font-semibold text-slate-800">{target.displayName}</span>
      <span className="text-slate-400">·</span>
      <span className="font-mono text-slate-600">v{installedVersion}</span>
    </div>
  );

  const hasRevertibleChanges = Boolean(drift?.hasChanges);
  const canStart = Boolean(
    drift
    && !loadError
    && !isLoading
    && !isRepairing
    && hasRevertibleChanges
    && acknowledged,
  );

  const auxiliaryFooter = (
    <UiCheckboxChoice
      checked={acknowledged}
      disabled={isRepairing || isLoading || !hasRevertibleChanges}
      onChange={setAcknowledged}
    >
      <span className={cn(
        'text-sm',
        hasRevertibleChanges ? 'text-slate-700' : 'text-slate-400',
      )}
      >
        I understand that by proceeding, the changes I made to package components will revert to their initial state.
      </span>
    </UiCheckboxChoice>
  );

  return (
    <CreateEditModalShell
      size="maximized"
      shellClassName="flex min-h-0 flex-1 flex-col"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      title="Repair Package"
      subtitle={subtitle}
      subtitleTone="elevated"
      subtitleClassName="py-2.5 text-[13px]"
      onClose={onClose}
      closeOnEscape={false}
      auxiliaryFooter={auxiliaryFooter}
      auxiliaryFooterClassName="!mt-0"
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose} disabled={isRepairing}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="warning"
            disabled={!canStart}
            onClick={() => void onConfirm()}
          >
            {isRepairing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Start
          </AppButton>
        </>
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <p className="font-semibold">What repair does</p>
          <p className="mt-1 text-xs text-amber-800">
            Repair reinstalls the package from its stored artifact at v{installedVersion}. Package-owned APIs,
            UI components, routes, pages, database objects, and other bundled assets are removed and rewritten
            from the baseline. Local edits to those components are lost unless you repack them into a new version first.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Scanning installed package for local changes…
          </div>
        ) : null}

        {loadError ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {loadError}
          </div>
        ) : null}

        {!isLoading && drift && !drift.hasChanges ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            No local modifications were detected compared to the installed package artifact. There is nothing to repair.
          </div>
        ) : null}

        {!isLoading && drift?.hasChanges ? (
          <p className="text-xs text-slate-600">
            The following items differ from the installed package baseline and will be overwritten during repair.
          </p>
        ) : null}

        {visibleCategories.map((group, index) => (
          <FormSection
            key={group.category}
            title={PACKAGE_REPACK_CATEGORY_LABELS[group.category]}
            ink={index % 3 === 0 ? 'accent' : index % 3 === 1 ? 'complement' : 'contrast'}
            divided={index > 0}
          >
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-2.5 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-slate-500">
                      Item
                    </th>
                    <th className="px-2.5 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-slate-500">
                      Path
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.items.map((item) => (
                    <tr key={item.itemId}>
                      <td className="px-2.5 py-2 font-medium text-slate-800">{item.label}</td>
                      <td className="px-2.5 py-2 font-mono text-[11px] text-slate-600">{item.entryPath}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FormSection>
        ))}
      </div>
    </CreateEditModalShell>
  );
};
