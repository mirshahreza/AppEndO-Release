import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { formatQueryError } from '../../../../shared/api/client';
import {
  AppButton,
  AppToast,
  AppTableGrid,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  QueryErrorPanel,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  ListPageToolbarFrame,
} from '../../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../../shared/ui/list-page/listPageToolbarChrome';
import { useListPageToolbarScroll } from '../../../../shared/lib/useListPageToolbarScroll';
import { cn } from '../../../../lib/utils';
import { McpBuiltinPackModal } from './McpBuiltinPackModal';
import { McpServerDeleteModal } from './McpServerDeleteModal';
import { McpServerFormModal } from './McpServerFormModal';
import { McpHttpModal } from './McpHttpModal';
import { McpInboundHostModal } from './McpInboundHostModal';
import { McpWebSearchModal } from './McpWebSearchModal';
import { McpResourceAccessModal } from './McpResourceAccessModal';
import type { McpGridRow } from './buildMcpGridRows';
import type { McpServersSectionModel } from './useMcpServersSection';
import { getSettingsTypography } from '../../settingsSectionTypography';
import { useCultureT } from '../../../../core/culture/CultureContext';
import { createMcpServersGridColumns } from './mcpServersGridColumns';
import { APP_LIST_PREFERENCE_KEYS } from '../../../../shared/lib/listPreferenceKeys';

type McpServersSectionProps = {
  page: McpServersSectionModel;
};

const typo = getSettingsTypography('mcp-servers');

const isExternalEditRow = (row: McpGridRow | null): row is McpGridRow & { kind: 'external-server' } => (
  row?.kind === 'external-server'
);

export const McpServersSection: React.FC<McpServersSectionProps> = ({ page }) => {
  const t = useCultureT();
  const { listToolbarCollapsed, handleGridScroll } = useListPageToolbarScroll();
  const columns = useMemo(
    () => createMcpServersGridColumns({
      testingServerId: page.testingServerId,
      onOpenAccess: page.openAccessRow,
      onTest: (server) => { void page.handleTest(server); },
      onEdit: page.openEditRow,
      onDelete: page.setDeleteTarget,
    }, t),
    [page.handleTest, page.openAccessRow, page.openEditRow, page.setDeleteTarget, page.testingServerId, t],
  );

  const isLoading = page.settingsQuery.isLoading || page.serversQuery.isLoading;
  const loadError = page.settingsQuery.isError
    ? page.settingsQuery.error
    : page.serversQuery.isError
      ? page.serversQuery.error
      : null;

  const editingExternal = isExternalEditRow(page.editRow) ? page.editRow : null;
  const editingExternalReadOnly = Boolean(editingExternal?.server?.managedByPlugin);

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-slate-50 font-sans">
      <ListPageToolbarFrame>

        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <ToolbarSearchInput
            value={page.searchInput}
            onChange={(value) => page.setSearchInput(value)}
            placeholder="Filter MCP servers and capability packs…"
          />
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <ToolbarActionGroupWithRefresh
            onRefresh={() => {
              void page.settingsQuery.refetch();
              void page.serversQuery.refetch();
            }}
            isRefreshing={(page.settingsQuery.isFetching || page.serversQuery.isFetching) && !isLoading}
            actions={[
              {
                id: 'add-mcp-server',
                label: 'Add MCP Server',
                icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'create',
                primary: true,
                onClick: page.openCreateModal,
              },
            ]}
          />
        </div>
      </ListPageToolbarFrame>

      <div className="min-h-0 flex-1 overflow-hidden">
        <AppTableGrid
          presentation="auto"
          persistListKey={APP_LIST_PREFERENCE_KEYS.mcpServers}
          size="sm"
          columns={columns}
          rows={page.filteredGridRows}
          getRowKey={(row) => row.id}
          onScroll={handleGridScroll}
          compact={{ tablet: { cardsPerRow: 2 } }}
          isLoading={isLoading}
          loadingMessage="Loading MCP servers…"
          errorContent={
            loadError ? (
              <QueryErrorPanel
                message="Failed to load MCP settings"
                detail={formatQueryError(loadError, 'Could not load MCP settings.')}
                onRetry={() => {
                  void page.settingsQuery.refetch();
                  void page.serversQuery.refetch();
                }}
              />
            ) : undefined
          }
          isEmpty={!isLoading && !loadError && page.filteredGridRows.length === 0}
          emptyMessage="No MCP servers or capability packs match your filter."
        />
      </div>

      <div className={cn('shrink-0 border-t border-slate-200 bg-white px-5 py-2', typo.statLine)}>
        {page.builtinCount} built-in pack{page.builtinCount === 1 ? '' : 's'} · {page.externalCount} external server{page.externalCount === 1 ? '' : 's'}
      </div>

      <McpServerFormModal
        open={page.showCreateModal}
        mode="create"
        form={page.form}
        formError={page.formError}
        isSaving={page.isSaving}
        onClose={() => page.setShowCreateModal(false)}
        onSubmit={() => { void page.handleSubmitCreateForm(); }}
        onFormChange={page.setForm}
      />

      <McpServerFormModal
        open={Boolean(editingExternal)}
        mode="edit"
        form={page.form}
        formError={page.formError}
        isSaving={page.isSaving}
        readOnly={editingExternalReadOnly}
        onClose={page.closeEditRow}
        onSubmit={() => { void page.handleSubmitEditForm(); }}
        onFormChange={page.setForm}
      />

      <McpWebSearchModal
        open={page.editRow?.kind === 'builtin-pack' && page.editRow.packId === 'appendo-web'}
        draft={page.webSearchDraft}
        formError={page.webSearchError}
        hasStoredApiKey={page.hasStoredWebSearchApiKey}
        isSaving={page.isSavingWebSearch}
        onClose={page.closeEditRow}
        onSubmit={() => { void page.handleSaveWebSearch(); }}
        onDraftChange={page.setWebSearchDraft}
      />

      <McpHttpModal
        open={page.editRow?.kind === 'builtin-pack' && page.editRow.packId === 'appendo-http'}
        draft={page.httpDraft}
        formError={page.httpError}
        isSaving={page.isSavingHttp}
        onClose={page.closeEditRow}
        onSubmit={() => { void page.handleSaveHttp(); }}
        onDraftChange={page.setHttpDraft}
      />

      <McpInboundHostModal
        open={page.editRow?.kind === 'inbound-host'}
        draft={page.inboundHostDraft}
        formError={page.inboundHostError}
        hasStoredApiKey={page.hasStoredInboundHostApiKey}
        isSaving={page.isSavingInboundHost}
        onClose={page.closeEditRow}
        onSubmit={() => { void page.handleSaveInboundHost(); }}
        onDraftChange={page.setInboundHostDraft}
      />

      <McpBuiltinPackModal
        open={
          page.editRow?.kind === 'builtin-pack'
          && page.editRow.packId !== 'appendo-web'
          && page.editRow.packId !== 'appendo-http'
        }
        pack={page.editRow?.pack ?? null}
        defaultEnabled={page.builtinDefaultEnabled}
        formError={page.builtinPackError}
        isSaving={page.isSavingBuiltinPack}
        onClose={page.closeEditRow}
        onSubmit={() => { void page.handleSaveBuiltinPack(); }}
        onDefaultEnabledChange={page.setBuiltinDefaultEnabled}
      />

      <McpServerDeleteModal
        server={page.deleteTarget}
        deleteError={page.deleteError}
        onCancel={() => page.setDeleteTarget(null)}
        onConfirm={() => { void page.handleDelete(); }}
      />

      <McpResourceAccessModal
        open={Boolean(page.accessTarget)}
        target={page.accessTarget}
        isSaving={page.isSavingAccess}
        onClose={page.closeAccessRow}
        onSave={async (accessControl) => { await page.handleSaveAccess(accessControl); }}
      />

      {page.toast ? (
        <AppToast
          type={page.toast.type}
          text={page.toast.text}
        />
      ) : null}
    </div>
  );
};
