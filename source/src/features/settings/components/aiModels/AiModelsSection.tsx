import React from 'react';
import { Bot, Plus, Settings2 } from 'lucide-react';
import { BaseTreeGrid } from '../../../../components/ui/BaseTreeGrid';
import { formatQueryError } from '../../../../shared/api/client';
import {
  AppButton,
  AppToast,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  QueryErrorPanel,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  ToolbarFilterCheckbox,
  ListPageToolbarFrame,
} from '../../../../shared/ui';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import { AiChatPreferencesModal } from './AiChatPreferencesModal';
import { AiAgentPreferencesModal } from './AiAgentPreferencesModal';
import { AiProviderDeleteModal } from './AiProviderDeleteModal';
import { AiModelDeleteModal } from './AiModelDeleteModal';
import { AiModelFormModal } from './AiModelFormModal';
import { AiProviderFormModal } from './AiProviderFormModal';
import type { AiModelsTreeRow } from './aiModelsTree';
import type { AiModelsSectionModel } from './useAiModelsSection';
import { getSettingsTypography } from '../../settingsSectionTypography';
import { ListPageToolbarScrollRoot } from '../../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../../lib/utils';

type AiModelsSectionProps = {
  page: AiModelsSectionModel;
};

export const AiModelsSection: React.FC<AiModelsSectionProps> = ({ page }) => {
  const t = useSettingsFormT();
  const typo = getSettingsTypography('ai-models');

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-slate-50 font-sans">
      <ListPageToolbarFrame>

        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <ToolbarSearchInput
            value={page.searchInput}
            onChange={page.setSearchInput}
            placeholder={t('settings.ai.filterPlaceholder')}
          />
          <ToolbarFilterCheckbox
            id="ai-models-filter-enabled-only"
            checked={page.showEnabledOnly}
            onChange={page.setShowEnabledOnly}
          >
            {t('settings.ui.enabledOnly')}
          </ToolbarFilterCheckbox>
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <AppButton intent="utility" size="sm" onClick={page.openAgentPreferencesModal}>
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            {t('settings.ai.agentContext')}
          </AppButton>
          <AppButton intent="utility" size="sm" onClick={page.openPreferencesModal}>
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('settings.ai.preferences')}
          </AppButton>
          <ToolbarActionGroupWithRefresh
            onRefresh={() => { void page.settingsQuery.refetch(); }}
            isRefreshing={page.settingsQuery.isFetching && !page.settingsQuery.isLoading}
            actions={[
              {
                id: 'create-ai-provider',
                label: t('settings.ai.addProvider'),
                icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'create',
                onClick: page.openCreateProviderModal,
              },
              {
                id: 'create-ai-model',
                label: t('settings.ui.create'),
                icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'create',
                primary: true,
                onClick: page.openCreateModal,
              },
            ]}
          />
        </div>
      </ListPageToolbarFrame>

      <div className="flex-1 min-h-0">
        {page.settingsQuery.isLoading ? (
          <div className="h-40 flex items-center justify-center">
            <span className={typo.loadingText}>{t('settings.ai.loading')}</span>
          </div>
        ) : page.settingsQuery.isError ? (
          <QueryErrorPanel
            message={t('settings.ai.loadError')}
            detail={formatQueryError(page.settingsQuery.error, t('settings.ai.loadError'))}
            onRetry={() => void page.settingsQuery.refetch()}
            isRetrying={page.settingsQuery.isFetching}
          />
        ) : page.treeRows.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 px-4 text-center">
            <span className={typo.loadingText}>{t('settings.ai.emptyProvidersHint')}</span>
            <AppButton intent="create" size="sm" onClick={page.openCreateProviderModal}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('settings.ai.addProvider')}
            </AppButton>
          </div>
        ) : (
          <div className="h-full min-h-0">
            <BaseTreeGrid<AiModelsTreeRow>
              rows={page.treeRows}
              onScroll={page.handleTreeScroll}
              expandedById={page.expandedById}
              loadingByParent={{}}
              moveDisabled
              showIdColumn={false}
              nodeColumnHeader={t('settings.ai.modelColumn')}
              nodeColumnWidth={380}
              rowClassName={(row) => (row.kind === 'provider' ? 'font-semibold' : '')}
              onToggleExpand={page.toggleExpand}
              onRowClick={page.handleTreeRowClick}
              isRowClickable={page.isTreeRowClickable}
              onMove={async () => {}}
              getNodeLabel={page.getNodeLabel}
              columns={page.treeColumns}
            />
          </div>
        )}
      </div>

      <AiChatPreferencesModal
        open={page.showPreferencesModal}
        draft={page.preferencesDraft}
        isSaving={page.isSavingPreferences}
        onClose={() => page.setShowPreferencesModal(false)}
        onSubmit={() => { void page.handleSavePreferences(); }}
        onDraftChange={page.setPreferencesDraft}
      />

      <AiAgentPreferencesModal
        open={page.showAgentPreferencesModal}
        draft={page.agentPreferencesDraft}
        isSaving={page.isSavingAgentPreferences}
        onClose={() => page.setShowAgentPreferencesModal(false)}
        onSubmit={() => { void page.handleSaveAgentPreferences(); }}
        onDraftChange={page.setAgentPreferencesDraft}
      />

      <AiModelFormModal
        open={page.showModelModal}
        mode={page.modelModalMode}
        form={page.modelForm}
        configuredProviderKinds={page.configuredProviderKinds}
        providerBaseUrl={page.modelProviderBaseUrl}
        formError={page.modelFormError}
        isSaving={page.isSavingModel}
        onClose={() => page.setShowModelModal(false)}
        onSubmit={() => { void page.handleSaveModel(); }}
        onFormChange={page.setModelForm}
      />

      <AiProviderFormModal
        open={page.showProviderModal}
        mode={page.providerModalMode}
        form={page.providerForm}
        configuredProviderKinds={page.configuredProviderKinds}
        hasStoredApiKey={page.providerHasStoredApiKey}
        formError={page.providerFormError}
        isSaving={page.isSavingProvider}
        onClose={() => page.setShowProviderModal(false)}
        onSubmit={() => { void page.handleSaveProvider(); }}
        onFormChange={page.setProviderForm}
      />

      <AiModelDeleteModal
        model={page.deleteTarget}
        deleteError={page.deleteError}
        onCancel={() => page.setDeleteTarget(null)}
        onConfirm={() => { void page.confirmDelete(); }}
      />

      <AiProviderDeleteModal
        target={page.deleteProviderTarget}
        deleteError={page.deleteProviderError}
        onCancel={() => page.setDeleteProviderTarget(null)}
        onConfirm={() => { void page.confirmDeleteProvider(); }}
      />

      {page.toast ? <AppToast type={page.toast.type} text={page.toast.text} /> : null}
    </div>
  );
};
