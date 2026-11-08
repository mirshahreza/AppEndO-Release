import React from 'react';
import { useCultureT } from '../../../../core/culture/CultureContext';
import { attributeText } from '../../settingsAttributesI18n';
import { interpolateDesignerTemplate } from '../../../component-designer/designerI18n';
import { SettingsAttributeDeleteModal } from './SettingsAttributeDeleteModal';
import { SettingsAttributeFormModal } from './SettingsAttributeFormModal';
import { SettingsAttributesTableGrid } from './SettingsAttributesTableGrid';
import { SettingsAttributesToast } from './SettingsAttributesToast';
import { SettingsAttributesToolbar } from './SettingsAttributesToolbar';
import type { SettingsAttributesSectionProps } from './types';
import { useSettingsAttributesSection } from './useSettingsAttributesSection';

export const SettingsAttributesSection: React.FC<SettingsAttributesSectionProps> = ({ scope, title }) => {
  const t = useCultureT();
  const page = useSettingsAttributesSection(scope);
  const scopeLabel = title.replace(/ Attributes$/, '');

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 font-sans min-h-0">
      <SettingsAttributesToolbar
        searchInput={page.searchInput}
        onSearchInputChange={page.setSearchInput}
        activeFilter={page.activeFilter}
        onActiveFilterChange={page.setActiveFilter}
        onCreate={page.openCreateModal}
        createLabel={interpolateDesignerTemplate(attributeText('modal.createScoped', t), { scope: scopeLabel })}
        onRefresh={page.retryLoad}
        isRefreshing={page.isRefreshing}
        listToolbarCollapsed={page.listToolbarCollapsed}
      />

      <SettingsAttributesTableGrid
        isLoading={page.isLoading}
        isError={page.isError}
        error={page.error}
        onRetry={page.retryLoad}
        isRetrying={page.isRetrying}
        definitions={page.orderedDefinitions}
        canReorder={page.canReorder}
        isReordering={page.isReordering}
        onReorder={page.onReorder}
        renderActorLabel={page.renderActorLabel}
        onEdit={page.startEdit}
        onDelete={page.requestDelete}
        scope={scope}
        onScroll={page.handleGridScroll}
      />

      <SettingsAttributeFormModal
        open={page.showCreateModal}
        title={interpolateDesignerTemplate(attributeText('modal.createScoped', t), { scope: scopeLabel })}
        submitLabel={t('settings.ui.create')}
        form={page.form}
        onFormChange={page.setForm}
        formError={page.formError}
        isSaving={page.isSaving}
        scope={scope}
        onClose={() => page.setShowCreateModal(false)}
        onSubmit={() => void page.handleCreate()}
      />

      <SettingsAttributeFormModal
        open={Boolean(page.editingRecord)}
        title={page.editingRecord
          ? interpolateDesignerTemplate(attributeText('modal.editWithId', t), { id: String(page.editingRecord.id) })
          : attributeText('modal.editTitle', t)}
        submitLabel={attributeText('modal.saveSubmit', t)}
        form={page.editForm}
        onFormChange={page.setEditForm}
        formError={page.editError}
        isSaving={page.isUpdating}
        disableKey
        isEdit
        scope={scope}
        onClose={page.cancelEdit}
        onSubmit={() => void page.saveEdit()}
      />

      <SettingsAttributeDeleteModal
        deleteId={page.deleteId}
        deleteError={page.deleteError}
        onCancel={page.cancelDelete}
        onConfirm={() => void page.confirmDelete()}
      />

      <SettingsAttributesToast toast={page.toast} />
    </div>
  );
};
