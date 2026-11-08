import * as React from 'react';
import { CultureProvider } from '../../../core/culture/CultureContext';
import { DEFAULT_PREVIEW_CULTURE_ID } from '../lib/designerPreviewSession';
import type { UseDesignerStateResult } from '../hooks/useDesignerState';
import type { UseDesignerVersionsResult } from '../hooks/useDesignerVersions';
import { DesignerPaletteSidebar } from './DesignerPaletteSidebar';
import {
  DesignerDeleteComponentDialog,
  DesignerDraftDialog,
  DesignerTagsDialog,
  DesignerUnsavedChangesDialog,
  DesignerUnusedComponentsDialog,
} from './dialogs';
import { CreateComponentWizardDialog } from './create-wizard/CreateComponentWizardDialog';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { AppToast } from '../../../shared/ui';
import { resolveDesignerDraftPageKey } from '../../platform-navigations/hooks/useNavigationEditorOptions';
import { sanitizeDesignerComponentNameInput } from '../utils/componentName';
import { collectCatalogTagSuggestions } from '../../../shared/lib/catalogTags';

export type ComponentDesignerViewProps = UseDesignerStateResult
  & UseDesignerVersionsResult
  & {
    isCatalogListMode?: boolean;
    onOpenLiveDesigner?: (draftId: string) => void;
  };

const STUDIO_CULTURE_ID = DEFAULT_PREVIEW_CULTURE_ID;

/** Client Components catalog list — Live Designer is the only editor surface. */
export const ComponentDesignerView: React.FC<ComponentDesignerViewProps> = (props) => {
  const {
    state,
    dispatch,
    designerToast,
    isDraftsLoading,
    componentGroups,
    catalogKindFilter,
    setCatalogKindFilter,
    catalogBuiltInFilter,
    setCatalogBuiltInFilter,
    activeDraftId,
    loadingComponentId,
    handleRefreshComponents,
    handleDuplicateComponent,
    handleDeleteComponent,
    deleteTargetComponentName,
    deleteTargetDraftId,
    handleDuplicateDraft,
    handleSaveEditDraft,
    handleSaveComponentTags,
    handleEditComponent,
    handleEditComponentTags,
    handleConfirmDeleteComponent,
    handleCancelDraftDialog,
    openCreateWizard,
    isCreateWizardOpen,
    createWizardKind,
    setIsCreateWizardOpen,
    handleCreateWizardComplete,
    activeDraftSummary,
    activeComponentName,
    hasUnsavedChanges,
    draftDialogMode,
    draftDialogBusy,
    draftDialogError,
    draftNameInput,
    setDraftNameInput,
    draftTagsInput,
    setDraftTagsInput,
    isUnsavedChangesDialogOpen,
    handleCancelUnsavedChangesDialog,
    handleDiscardUnsavedChanges,
    handleSaveUnsavedChanges,
    onOpenLiveDesigner,
    drafts,
  } = props;

  const [isUnusedComponentsDialogOpen, setIsUnusedComponentsDialogOpen] = React.useState(false);
  const tagSuggestions = React.useMemo(() => collectCatalogTagSuggestions(drafts), [drafts]);
  const portal = useOptionalPortal();
  const isDesignerSurfaceShell = portal?.shellKey === 'designer';
  const pageWrapperClassName = isDesignerSurfaceShell
    ? 'h-full w-full overflow-hidden bg-white'
    : 'flex h-full min-h-0 w-full flex-col overflow-hidden bg-white';

  const handleDraftDialogClose = React.useCallback(() => {
    handleCancelDraftDialog();
  }, [handleCancelDraftDialog]);

  const handleDraftDialogSave = React.useCallback((tags: string[]) => {
    setDraftTagsInput(tags);
    if (draftDialogMode === 'duplicate') {
      void handleDuplicateDraft(tags);
      return;
    }
    if (draftDialogMode === 'edit') {
      void handleSaveEditDraft(tags);
    }
  }, [draftDialogMode, handleDuplicateDraft, handleSaveEditDraft, setDraftTagsInput]);

  return (
    <CultureProvider cultureId={STUDIO_CULTURE_ID}>
      <div id="component-designer-page-wrapper" className={pageWrapperClassName}>
        {designerToast ? <AppToast type={designerToast.type} text={designerToast.text} /> : null}
        <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
          <DesignerPaletteSidebar
            layout="page"
            paletteSearch={state.paletteSearch}
            onPaletteSearchChange={(value) => dispatch({ type: 'set-palette-search', value })}
            onOpenCreate={openCreateWizard}
            onRefreshComponents={handleRefreshComponents}
            catalogKindFilter={catalogKindFilter}
            onCatalogKindFilterChange={setCatalogKindFilter}
            catalogBuiltInFilter={catalogBuiltInFilter}
            onCatalogBuiltInFilterChange={setCatalogBuiltInFilter}
            onEditComponent={handleEditComponent}
            onEditComponentTags={handleEditComponentTags}
            onDuplicateComponent={handleDuplicateComponent}
            onDeleteComponent={handleDeleteComponent}
            isComponentActionBusy={draftDialogBusy}
            isDraftsLoading={isDraftsLoading}
            groups={componentGroups}
            activeDraftId={activeDraftId}
            loadingComponentId={loadingComponentId}
            onOpenLiveDesigner={onOpenLiveDesigner}
            onOpenUnusedComponents={() => setIsUnusedComponentsDialogOpen(true)}
          />
        </div>

        <CreateComponentWizardDialog
          open={isCreateWizardOpen}
          initialKind={createWizardKind}
          onClose={() => setIsCreateWizardOpen(false)}
          onComplete={(result) => {
            setIsCreateWizardOpen(false);
            handleCreateWizardComplete(result);
          }}
          tagSuggestions={tagSuggestions}
        />

        <DesignerDraftDialog
          mode={draftDialogMode === 'duplicate' || draftDialogMode === 'edit' ? draftDialogMode : null}
          busy={draftDialogBusy}
          error={draftDialogError}
          activeDraftId={activeDraftId}
          activeComponentName={activeComponentName}
          activePageKey={activeDraftSummary ? resolveDesignerDraftPageKey(activeDraftSummary) : null}
          draftNameInput={draftNameInput}
          onDraftNameInputChange={(value) => setDraftNameInput(sanitizeDesignerComponentNameInput(value))}
          onClose={handleDraftDialogClose}
          onCancel={handleCancelDraftDialog}
          onSave={() => handleDraftDialogSave(draftTagsInput)}
        />

        <DesignerTagsDialog
          open={draftDialogMode === 'tags'}
          error={draftDialogError}
          componentName={draftNameInput || activeComponentName}
          tags={draftTagsInput}
          suggestions={tagSuggestions}
          onTagsChange={(tags) => {
            setDraftTagsInput(tags);
            void handleSaveComponentTags(tags);
          }}
          onClose={handleDraftDialogClose}
        />

        <DesignerDeleteComponentDialog
          open={draftDialogMode === 'delete'}
          busy={draftDialogBusy}
          error={draftDialogError}
          componentName={deleteTargetComponentName}
          draftId={deleteTargetDraftId}
          hasUnsavedChanges={hasUnsavedChanges && false}
          onClose={handleCancelDraftDialog}
          onCancel={handleCancelDraftDialog}
          onConfirm={() => { void handleConfirmDeleteComponent(); }}
        />

        <DesignerUnsavedChangesDialog
          open={isUnsavedChangesDialogOpen}
          busy={draftDialogBusy}
          onCancel={handleCancelUnsavedChangesDialog}
          onDiscard={handleDiscardUnsavedChanges}
          onSave={() => { void handleSaveUnsavedChanges(); }}
        />

        <DesignerUnusedComponentsDialog
          open={isUnusedComponentsDialogOpen}
          onClose={() => setIsUnusedComponentsDialogOpen(false)}
          onDeleteComponent={handleDeleteComponent}
          isDeleteBusy={draftDialogBusy}
        />
      </div>
    </CultureProvider>
  );
};
