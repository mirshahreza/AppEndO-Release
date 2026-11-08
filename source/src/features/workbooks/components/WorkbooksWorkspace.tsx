import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { usePublishAiPageContext } from '../../../shared/lib/aiPageContextStore';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import {
  ConfirmDialogShell,
  DestructiveConfirmBody,
  showAppFeedbackToast,
  spreadsheetSheetsSignature,
  toPersistedSpreadsheetSheets,
  type UiSpreadsheetHandle,
  type UiSpreadsheetSheet,
} from '../../../shared/ui';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';
import type { WorkbookListItem } from '../../../shared/api/contracts/workbooks/types';
import {
  useCreateWorkbookMutation,
  useDeleteWorkbookMutation,
  useSharedWorkbooksListQuery,
  useUpdateWorkbookMutation,
  useWorkbookQuery,
  useWorkbooksListQuery,
} from '../../../shared/api/queries/workbooks';
import {
  WORKBOOKS_LIST_SEGMENT,
  buildWorkbookEditRelativePath,
  buildWorkbooksListRelativePath,
  parseWorkbookEditSlug,
  parseWorkbookEditSlugFromPathname,
  resolveWorkbookIdFromEditSlug,
} from '../workbookRoute';
import { WORKBOOKS_PAGE_KEY, useWorkbooksShellHeader } from '../hooks/useWorkbooksShellHeader';
import { WorkbookCreateModal } from './WorkbookCreateModal';
import { WorkbookEditor } from './WorkbookEditor';
import { WorkbookSharePanel } from './WorkbookSharePanel';
import { WorkbooksListPanel } from './WorkbooksListPanel';
import { useWorkbooksWorkspaceOverlayDeepLink } from '../hooks/useWorkbooksWorkspaceOverlayDeepLink';

const errorMessage = (error: unknown, fallback: string): string => {
  if (isApiError(error)) {
    return formatApiErrorMessage(error);
  }
  return error instanceof Error ? error.message : fallback;
};

type WorkbooksListFilters = {
  searchQuery: string;
};

const DEFAULT_WORKBOOKS_FILTERS: WorkbooksListFilters = {
  searchQuery: '',
};

function sanitizeWorkbooksFilters(raw: unknown): WorkbooksListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  return {
    searchQuery: typeof record.searchQuery === 'string' ? record.searchQuery : '',
  };
}

const WorkbookEditorHost: React.FC<{
  workbookId: string;
  allowSharing: boolean;
  onBack: (dirty: boolean) => void;
  onMissing: () => void;
  onShare: () => void;
}> = ({ workbookId, allowSharing, onBack, onMissing, onShare }) => {
  const query = useWorkbookQuery(workbookId);
  const updateMutation = useUpdateWorkbookMutation();
  const [sheets, setSheets] = useState<UiSpreadsheetSheet[]>([]);
  const [hostGeneration, setHostGeneration] = useState(0);
  const [dirty, setDirty] = useState(false);
  const spreadsheetRef = useRef<UiSpreadsheetHandle>(null);
  const savedSignatureRef = useRef('');
  const workbook = query.data ?? null;
  const canEdit = workbook?.viewerRole !== 'can-view';
  const canShare = allowSharing && workbook?.viewerRole !== 'can-view' && workbook?.viewerRole !== 'can-edit';

  useEffect(() => {
    if (!workbook) {
      return;
    }
    setSheets(workbook.sheets);
    savedSignatureRef.current = spreadsheetSheetsSignature(workbook.sheets);
    setDirty(false);
    setHostGeneration((current) => current + 1);
  }, [workbook?.id]);

  useEffect(() => {
    if (!query.isError) {
      return;
    }
    onMissing();
  }, [onMissing, query.isError]);

  if (!workbook) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Loading workbook…
      </div>
    );
  }

  return (
    <>
      <WorkbookEditor
        workbook={workbook}
        sheets={sheets}
        hostKey={`${workbook.id}:${hostGeneration}`}
        dirty={dirty}
        isSaving={updateMutation.isPending}
        canEdit={canEdit}
        allowSharing={canShare}
        spreadsheetRef={spreadsheetRef}
        onShare={onShare}
        onSheetsChange={(next) => {
          setSheets(next);
          setDirty(spreadsheetSheetsSignature(next) !== savedSignatureRef.current);
        }}
        onSave={() => {
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
        onBack={() => onBack(dirty)}
      />
    </>
  );
};

export type WorkbooksWorkspaceProps = {
  listSegment?: string;
  pageKey?: string;
  allowSharing?: boolean;
};

export const WorkbooksWorkspace: React.FC<WorkbooksWorkspaceProps> = ({
  listSegment = WORKBOOKS_LIST_SEGMENT,
  pageKey = WORKBOOKS_PAGE_KEY,
  allowSharing = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mountId, toMountPath } = usePlatformMount();
  const application = useOptionalPortal();
  const routeParamSuffix = useParams()['*'];
  const applicationSuffix = application?.pageRemainderPath.replace(/^\/+/, '') || undefined;
  const pathSuffix = applicationSuffix ?? routeParamSuffix;
  const editSlugFromUrl = useMemo(
    () => parseWorkbookEditSlug(pathSuffix, listSegment)
      ?? parseWorkbookEditSlugFromPathname(location.pathname, listSegment),
    [listSegment, location.pathname, pathSuffix],
  );
  const workbookIdFromUrl = editSlugFromUrl
    ? resolveWorkbookIdFromEditSlug(editSlugFromUrl)
    : null;

  const [filters, setFilters] = usePersistedListFilters({
    listKey: allowSharing ? APP_LIST_PREFERENCE_KEYS.myWorkbooks : APP_LIST_PREFERENCE_KEYS.workbooks,
    defaultFilters: DEFAULT_WORKBOOKS_FILTERS,
    sanitize: sanitizeWorkbooksFilters,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingLeave, setPendingLeave] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkbookListItem | null>(null);
  const [shareWorkbookId, setShareWorkbookId] = useState<string | null>(null);
  const [listScope, setListScope] = useState<'mine' | 'shared'>('mine');

  const ownedQuery = useWorkbooksListQuery();
  const sharedQuery = useSharedWorkbooksListQuery(allowSharing);
  const listQuery = allowSharing && listScope === 'shared' ? sharedQuery : ownedQuery;
  const shareQuery = useWorkbookQuery(shareWorkbookId);
  const shareFromList = (listQuery.data ?? []).find((item) => item.id === shareWorkbookId);
  const shareWorkbook = shareQuery.data ?? (shareFromList
    ? { ...shareFromList, sheets: [], sharedMembers: [] }
    : null);
  const createMutation = useCreateWorkbookMutation();
  const deleteMutation = useDeleteWorkbookMutation();

  useWorkbooksShellHeader({ enabled: Boolean(workbookIdFromUrl), pageKey });

  usePublishAiPageContext({
    entityType: 'workbooks',
    activeFilters: { search: filters.searchQuery, selectedId: workbookIdFromUrl, listScope },
  });

  const navigateToList = useCallback(() => {
    navigate(toMountPath(buildWorkbooksListRelativePath(mountId, listSegment)));
  }, [listSegment, mountId, navigate, toMountPath]);

  const navigateToEdit = useCallback((id: string) => {
    navigate(toMountPath(buildWorkbookEditRelativePath(id, mountId, listSegment)));
  }, [listSegment, mountId, navigate, toMountPath]);

  const requestBack = useCallback((dirty: boolean) => {
    if (dirty) {
      setPendingLeave(true);
      return;
    }
    navigateToList();
  }, [navigateToList]);

  const handleMissingEditor = useCallback(() => {
    navigate(toMountPath(buildWorkbooksListRelativePath(mountId, listSegment)), { replace: true });
  }, [listSegment, mountId, navigate, toMountPath]);

  const listError = listQuery.error ? errorMessage(listQuery.error, 'Failed to load workbooks.') : null;

  useWorkbooksWorkspaceOverlayDeepLink({
    createOpen,
    setCreateOpen,
    shareWorkbookId,
    setShareWorkbookId,
    deleteOpen: Boolean(deleteTarget),
    leaveOpen: pendingLeave,
    setPendingLeave,
    onShareFromUrl: (workbookId) => setShareWorkbookId(workbookId),
  });

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white">
      {workbookIdFromUrl ? (
        <WorkbookEditorHost
          workbookId={workbookIdFromUrl}
          allowSharing={allowSharing}
          onBack={requestBack}
          onMissing={handleMissingEditor}
          onShare={() => setShareWorkbookId(workbookIdFromUrl)}
        />
      ) : (
        <WorkbooksListPanel
          items={listQuery.data ?? []}
          search={filters.searchQuery}
          onSearchChange={(searchQuery) => setFilters((prev) => ({ ...prev, searchQuery }))}
          isLoading={listQuery.isLoading && !listQuery.data}
          isRefreshing={listQuery.isFetching}
          loadError={listError}
          onRefresh={() => { void listQuery.refetch(); }}
          onCreate={() => { setCreateError(null); setCreateOpen(true); }}
          onOpen={navigateToEdit}
          onDelete={setDeleteTarget}
          onShare={allowSharing ? (item) => setShareWorkbookId(item.id) : undefined}
          isDeleting={deleteMutation.isPending}
          allowSharing={allowSharing}
          listScope={listScope}
          onListScopeChange={setListScope}
          mineCount={(ownedQuery.data ?? []).length}
          sharedCount={(sharedQuery.data ?? []).length}
        />
      )}

      <WorkbookCreateModal
        open={createOpen}
        isSaving={createMutation.isPending}
        error={createError}
        onClose={() => setCreateOpen(false)}
        onCreate={(input) => {
          void createMutation.mutateAsync(input).then((item) => {
            setCreateOpen(false);
            navigateToEdit(item.id);
            showAppFeedbackToast('Workbook created.', { type: 'success' });
          }).catch((error) => {
            setCreateError(errorMessage(error, 'Failed to create workbook.'));
          });
        }}
      />

      {allowSharing && shareWorkbook ? (
        <WorkbookSharePanel
          open={Boolean(shareWorkbookId)}
          workbook={shareWorkbook}
          onClose={() => setShareWorkbookId(null)}
        />
      ) : null}

      <ConfirmDialogShell
        open={pendingLeave}
        title="Discard unsaved cells?"
        onClose={() => setPendingLeave(false)}
        onConfirm={() => {
          setPendingLeave(false);
          navigateToList();
        }}
        confirmIntent="primary"
        confirmLabel="Discard"
      >
        <p className="text-sm text-slate-600">Leaving this workbook drops edits that were not saved.</p>
      </ConfirmDialogShell>

      <ConfirmDialogShell
        open={Boolean(deleteTarget)}
        title="Delete workbook"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }
          void deleteMutation.mutateAsync(deleteTarget.id).then(() => {
            setDeleteTarget(null);
            showAppFeedbackToast('Workbook deleted.', { type: 'success' });
          }).catch((error) => {
            showAppFeedbackToast(errorMessage(error, 'Failed to delete workbook.'), { type: 'error' });
          });
        }}
        confirmIntent="destructive"
        confirmLabel="Delete"
      >
        <DestructiveConfirmBody
          question="Delete this workbook? The sheets are removed. This does not change any database table."
          entityName={deleteTarget?.name}
        />
      </ConfirmDialogShell>
    </div>
  );
};
