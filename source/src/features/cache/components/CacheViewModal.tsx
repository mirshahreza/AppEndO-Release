import React from 'react';
import { Key, Loader2 } from 'lucide-react';
import { CreateEditModalShell } from '../../../shared/ui';
import { FLOATING_ACTION_SEPARATOR_CLASS } from '../../../shared/ui/surfaceClasses';
import type { CacheEntryRecord } from '../../../shared/api/contracts/cache/types';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { interpolateOperationsTemplate } from '../../operations/operationsI18n';
import { formatCacheSize } from '../utils';

type CacheViewModalProps = {
  item: CacheEntryRecord;
  viewValue: string | null;
  isViewLoading: boolean;
  onClose: () => void;
};

const META_BADGE_CLASS =
  'inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[11px] font-medium';

export const CacheViewModal: React.FC<CacheViewModalProps> = ({
  item,
  viewValue,
  isViewLoading,
  onClose,
}) => {
  const t = useCultureT();

  return (
    <CreateEditModalShell
      size="maximized"
      shellClassName="rounded-xl border border-cyan-100/80"
      headerClassName="border-b-cyan-100/70 bg-gradient-to-r from-cyan-50/90 via-white to-indigo-50/80"
      subtitleClassName="border-t-cyan-100/60 bg-cyan-50/30"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
      title={(
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 text-cyan-600">
            <Key className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="truncate font-mono text-cyan-900" title={item.cacheKey}>
            {item.cacheKey}
          </span>
        </span>
      )}
      subtitle={(
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <span className={`${META_BADGE_CLASS} border-indigo-200 bg-indigo-50 text-indigo-700`}>
            {item.cacheType}
          </span>
          <span className={`${META_BADGE_CLASS} border-cyan-200 bg-cyan-50 font-mono text-cyan-700`}>
            {formatCacheSize(item.sizeBytes)}
          </span>
          {!isViewLoading && viewValue != null ? (
            <span className={`${META_BADGE_CLASS} border-violet-200 bg-violet-50 text-violet-700`}>
              {interpolateOperationsTemplate(t(operationsKey('common.chars')), { count: viewValue.length.toLocaleString() })}
            </span>
          ) : null}
          <span className={FLOATING_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
          <span className={`${META_BADGE_CLASS} border-emerald-200 bg-emerald-50 text-emerald-700`}>
            {interpolateOperationsTemplate(t(operationsKey('common.hits')), { count: item.hitCount.toLocaleString() })}
          </span>
        </div>
      )}
      onClose={onClose}
      onBackdropClick={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
        {isViewLoading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-cyan-700">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t(operationsKey('cache.loadingValue'))}
          </div>
        ) : (
          <pre className="m-0 h-full overflow-auto whitespace-pre-wrap p-0 font-mono text-xs leading-relaxed text-slate-700">
            {viewValue}
          </pre>
        )}
        </div>
      </div>
    </CreateEditModalShell>
  );
};
