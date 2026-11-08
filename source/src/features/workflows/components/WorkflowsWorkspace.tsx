import React from 'react';
import { AppToast } from '../../../shared/ui';
import { useWorkflowsPage } from '../hooks/useWorkflowsPage';
import { useWorkflowDesignerShellHeader } from '../hooks/useWorkflowDesignerShellHeader';
import { DuplicateDialog } from './DuplicateDialog';
import { WorkflowDeleteModal } from './WorkflowDeleteModal';
import { WorkflowEditorWorkspace } from './WorkflowEditorWorkspace';
import { WorkflowDossierDialog } from './WorkflowDossierDialog';
import { WorkflowsListPanel } from './WorkflowsListPanel';

export const WorkflowsWorkspace: React.FC = () => {
  const page = useWorkflowsPage();

  useWorkflowDesignerShellHeader({
    enabled: Boolean(page.editSlugFromUrl),
  });

  return (
    <div className="h-full w-full bg-white">
      {page.toast ? <AppToast type={page.toast.type} text={page.toast.text} /> : null}
      {page.openDefinitionId === null ? (
        <WorkflowsListPanel page={page} onOpen={page.setOpenDefinitionId} />
      ) : (
        <WorkflowEditorWorkspace
          definitionId={page.openDefinitionId}
          onBack={() => {
            page.setOpenDefinitionId(null);
            void page.refreshDefinitions();
          }}
          onPublicationChanged={() => { void page.refreshDefinitions(); }}
          dossierDefinitionId={page.dossierDefinitionId}
          onOpenDossier={page.openDossier}
          onCloseDossier={page.closeDossier}
        />
      )}
      {page.isDuplicateOpen && page.duplicateSource ? (
        <DuplicateDialog
          source={page.duplicateSource}
          onClose={page.closeDuplicateDialog}
          onDuplicated={(newId) => { void page.handleDuplicated(newId); }}
        />
      ) : null}
      {page.dossierDefinitionId ? (() => {
        const dossierDefinition = page.definitions.find((item) => item.id === page.dossierDefinitionId);
        if (!dossierDefinition) {
          return null;
        }
        return (
          <WorkflowDossierDialog
            definitionId={dossierDefinition.id}
            workflowKey={dossierDefinition.key}
            open
            onClose={page.closeDossier}
          />
        );
      })() : null}
      <WorkflowDeleteModal
        target={page.deleteTarget}
        preview={page.deletePreview}
        confirmName={page.deleteConfirmName}
        error={page.deleteError}
        isDeleting={page.isDeleting}
        isLoadingPreview={page.isDeletePreviewLoading}
        onConfirmNameChange={page.setDeleteConfirmName}
        onCancel={page.closeDeleteDialog}
        onConfirm={() => { void page.handleDeleteWorkflow(); }}
      />
    </div>
  );
};
