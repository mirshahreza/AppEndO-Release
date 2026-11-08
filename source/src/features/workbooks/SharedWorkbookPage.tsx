import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { formatApiErrorMessage, isApiError } from '../../shared/api/client';
import {
  useOpenWorkbookQuery,
  useUpdateOpenWorkbookMutation,
} from '../../shared/api/queries/workbooks';
import {
  AppButton,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  UiSpreadsheet,
  showAppFeedbackToast,
  spreadsheetSheetsSignature,
  toPersistedSpreadsheetSheets,
  type UiSpreadsheetHandle,
  type UiSpreadsheetSheet,
} from '../../shared/ui';
import { cn } from '../../lib/utils';

const errorStatus = (error: unknown): number => (
  typeof error === 'object' && error && 'status' in error
    ? Number((error as { status?: number }).status) || 0
    : 0
);

const errorMessage = (error: unknown, fallback: string): string => {
  if (isApiError(error)) {
    return formatApiErrorMessage(error);
  }
  return error instanceof Error ? error.message : fallback;
};

export const SharedWorkbookPage: React.FC = () => {
  const { workbookId } = useParams<{ workbookId: string }>();
  const query = useOpenWorkbookQuery(workbookId ?? null);
  const updateMutation = useUpdateOpenWorkbookMutation();
  const [sheets, setSheets] = useState<UiSpreadsheetSheet[]>([]);
  const [dirty, setDirty] = useState(false);
  const spreadsheetRef = useRef<UiSpreadsheetHandle>(null);
  const savedSignatureRef = useRef('');
  const workbook = query.data ?? null;
  const canEdit = workbook?.viewerRole === 'can-edit' || workbook?.viewerRole === 'owner';

  useEffect(() => {
    if (!workbook) {
      return;
    }
    setSheets(workbook.sheets);
    savedSignatureRef.current = spreadsheetSheetsSignature(workbook.sheets);
    setDirty(false);
  }, [workbook?.id]);

  if (query.isError && errorStatus(query.error) === 401) {
    const returnPath = `/shared/workbooks/${encodeURIComponent(workbookId ?? '')}`;
    return <Navigate to={`/login?return=${encodeURIComponent(returnPath)}`} replace />;
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-white" data-testid="shared-workbook-page">
      <div className={cn(PAGE_TOOLBAR_SINGLE_ROW_CLASS, 'shrink-0 border-b border-slate-200')}>
        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <span className="text-sm font-semibold text-slate-800">
            {workbook?.name ?? 'Workbook'}
          </span>
          {workbook?.viewerRole === 'can-view' ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              Can view
            </span>
          ) : null}
          {dirty ? <span className="text-xs font-medium text-amber-700">Unsaved</span> : null}
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          {canEdit ? (
            <AppButton
              size="sm"
              intent="primary"
              disabled={updateMutation.isPending || !dirty}
              onClick={() => {
                if (!workbook) {
                  return;
                }
                const persisted = toPersistedSpreadsheetSheets(
                  spreadsheetRef.current?.getPersistedSheets() ?? sheets,
                );
                void updateMutation.mutateAsync({ id: workbook.id, sheets: persisted }).then(() => {
                  savedSignatureRef.current = spreadsheetSheetsSignature(persisted);
                  setSheets(persisted);
                  setDirty(false);
                  showAppFeedbackToast('Workbook saved.', { type: 'success' });
                }).catch((error) => {
                  showAppFeedbackToast(errorMessage(error, 'Failed to save workbook.'), { type: 'error' });
                });
              }}
            >
              <Save className="h-3.5 w-3.5" />
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </AppButton>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {query.isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Opening workbook…
          </div>
        ) : query.isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
            <p className="text-sm font-semibold text-slate-700">This workbook is not available.</p>
            <p className="text-xs font-medium text-slate-500">
              {errorMessage(query.error, 'The link may be private or no longer shared.')}
            </p>
          </div>
        ) : workbook ? (
          <UiSpreadsheet
            key={workbook.id}
            ref={spreadsheetRef}
            data={sheets}
            onChange={(next) => {
              setSheets(next);
              setDirty(spreadsheetSheetsSignature(next) !== savedSignatureRef.current);
            }}
            height="full"
            showToolbar
            showFormulaBar
            showSheetTabs
            allowEdit={canEdit}
            toolbarPreset="full"
          />
        ) : null}
      </div>
    </div>
  );
};
