import React, { Suspense, lazy } from 'react';
import {
  AppDialogShell,
  DialogBody,
  DialogPrimaryHeader,
} from '@/shared/ui';
import { useCultureT } from '@/core/culture/CultureContext';
import { operationsKey } from '@/core/culture/translations/cultureKeyHelpers';
import { interpolateOperationsTemplate } from '../../operations/operationsI18n';
import { parseLogParts } from '../utils/parseLogParts';
import type { LogsPageModel } from '../hooks/useLogsPage';

type LogDetailModalProps = {
  page: LogsPageModel;
};

const Editor = lazy(() => import('@monaco-editor/react'));

export const LogDetailModal: React.FC<LogDetailModalProps> = ({ page }) => {
  const t = useCultureT();

  if (!page.isDetailLoading && !page.selectedLog) {
    return null;
  }

  return (
    <AppDialogShell
      size="maximized"
      onClose={page.closeLogDetail}
      onBackdropClick={page.closeLogDetail}
      ariaLabel={t(operationsKey('logs.detailTitle'))}
    >
      <DialogPrimaryHeader
        title={page.detailHeaderMessage}
        onClose={page.closeLogDetail}
        titleClassName="text-sm"
      />
      <DialogBody
        gradient
        outerClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        innerClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-3"
      >
        {page.isDetailLoading ? (
          <div className="p-6 text-sm text-slate-500">{t(operationsKey('common.loadingDetail'))}</div>
        ) : page.selectedLog ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden text-sm">
            {(() => {
              const { folder, functionName, key } = parseLogParts(page.selectedLog.context, page.selectedLog.message);
              const compactItems = [
                page.selectedLog.actor || '-',
                folder,
                functionName,
                key,
                page.selectedLog.timestamp || '-',
                page.selectedLog.durationMs === null
                  ? '-'
                  : interpolateOperationsTemplate(t(operationsKey('common.ms')), { count: page.selectedLog.durationMs }),
                page.selectedLog.callSuccess === null
                  ? '-'
                  : (page.selectedLog.callSuccess ? t('grid.boolean.yes') : t('grid.boolean.no')),
                page.selectedLog.level,
                page.selectedLog.context || '-',
                page.selectedLog.failureReason || '-',
              ];

              return (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {compactItems.map((item, idx) => (
                    <span
                      key={`${idx}-${item}`}
                      className={`inline-flex max-w-[45%] items-center truncate rounded border px-2 py-0.5 text-[11px] ${
                        idx % 5 === 0
                          ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                          : idx % 5 === 1
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : idx % 5 === 2
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : idx % 5 === 3
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}
                      title={item}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              );
            })()}

            <div className="min-h-0 flex-1 overflow-hidden rounded border border-indigo-100 shadow-inset-surface-highlight">
              <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-slate-500">{t(operationsKey('common.loadingEditor'))}</div>}>
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={page.detailJsonPreview}
                  theme="vs"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    folding: true,
                    fontSize: 12,
                    tabSize: 2,
                  }}
                />
              </Suspense>
            </div>
          </div>
        ) : null}
      </DialogBody>
    </AppDialogShell>
  );
};
