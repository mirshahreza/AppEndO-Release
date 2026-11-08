import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2, Save, X } from 'lucide-react';
import { AppButton, CreateEditModalShell, FormField, UiTextarea } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import type { GitPageModel } from '../hooks/useGitPage';

type GitWorkflowEditorModalProps = {
  page: GitPageModel;
};

export const GitWorkflowEditorModal: React.FC<GitWorkflowEditorModalProps> = ({ page }) => {
  const [content, setContent] = useState('');
  const [isMaximized, setIsMaximized] = useState(true);
  const workflowFileQuery = page.workflowFileQuery;
  const filePath = workflowFileQuery.data?.path ?? '.github/workflows/appendo-ci.yml';

  useEffect(() => {
    if (!page.workflowEditorModalOpen) {
      return;
    }

    if (workflowFileQuery.data) {
      setContent(workflowFileQuery.data.content);
    }
  }, [page.workflowEditorModalOpen, workflowFileQuery.data]);

  if (!page.workflowEditorModalOpen) {
    return null;
  }

  const isDirty = workflowFileQuery.data ? content !== workflowFileQuery.data.content : content.length > 0;
  const isSaving = page.isSavingWorkflowFile;

  const handleSave = async () => {
    await page.saveWorkflowFile(content);
  };

  return (
    <CreateEditModalShell
      size={isMaximized ? 'maximized' : '5xl'}
      shellClassName={cn(!isMaximized && 'h-[min(85vh,52rem)]')}
      bodyOuterClassName="flex flex-col min-h-0 flex-1"
      bodyClassName="flex flex-col min-h-0 flex-1 overflow-hidden !p-0"
      title="CI Workflow"
      onClose={page.closeWorkflowEditorModal}
      onBackdropClick={page.closeWorkflowEditorModal}
      headerExtra={(
        <AppButton
          size="icon-sm"
          intent="cancel"
          aria-label={isMaximized ? 'Restore workflow editor size' : 'Maximize workflow editor'}
          title={isMaximized ? 'Restore size' : 'Maximize'}
          onClick={() => setIsMaximized((value) => !value)}
        >
          {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </AppButton>
      )}
      footer={(
        <div className="flex w-full items-center justify-end gap-2">
          <AppButton intent="cancel" size="sm" onClick={page.closeWorkflowEditorModal} disabled={isSaving}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            size="sm"
            onClick={() => { void handleSave(); }}
            disabled={!isDirty || isSaving || workflowFileQuery.isLoading}
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving…' : 'Save'}
          </AppButton>
        </div>
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-[15px]">
        <p className="shrink-0 ps-[4px] font-mono text-xs text-slate-500">{filePath}</p>

        {workflowFileQuery.isLoading ? (
          <p className="text-xs text-slate-500">Loading workflow file…</p>
        ) : workflowFileQuery.isError ? (
          <p className="text-xs text-rose-600">Failed to load workflow file.</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <FormField label="Workflow YAML" className="min-h-0 flex-1" reserveHintSlot={false}>
              <UiTextarea
                id="git-workflow-editor"
                size="sm"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="min-h-0 flex-1 font-mono text-xs leading-5"
                rows={24}
              />
            </FormField>
          </div>
        )}
      </div>
    </CreateEditModalShell>
  );
};
