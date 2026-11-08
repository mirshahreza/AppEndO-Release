import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { ConfirmDialogShell } from '../../../shared/ui';

export type PackageFailureDialogProps = {
  title: string;
  packageLabel?: string | null;
  lines: string[];
  rolledBack?: boolean;
  onClose: () => void;
};

export const PackageFailureDialog: React.FC<PackageFailureDialogProps> = ({
  title,
  packageLabel,
  lines,
  rolledBack = false,
  onClose,
}) => {
  const t = useCultureT();
  const [summary, ...detailLines] = lines;
  if (lines.length === 0) return null;

  return (
    <ConfirmDialogShell
      size="2xl"
      title={title}
      icon={<AlertTriangle className="h-4 w-4" />}
      tone="danger"
      subtitle={packageLabel ? <span className="font-medium text-slate-700">{packageLabel}</span> : undefined}
      hideConfirm
      cancelLabel={t('actions.close')}
      cancelIcon={<X className="h-3.5 w-3.5" />}
      onClose={onClose}
      initialFocus="cancel"
    >
      <div className="flex min-h-0 flex-col gap-3">
        {rolledBack ? (
          <p className="text-sm text-slate-700">{t('packages.install.rolledBack')}</p>
        ) : null}
        <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words">{summary}</p>
        {detailLines.length > 0 ? (
          <div className="flex min-h-0 flex-col gap-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {t('packages.install.failureDetails')}
            </div>
            <div className="max-h-[min(50vh,28rem)] overflow-auto rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-800">
              {detailLines.map((line, index) => (
                <div key={`${index}:${line}`} className="whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </ConfirmDialogShell>
  );
};
