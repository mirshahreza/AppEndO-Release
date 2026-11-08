import React, { useMemo, useRef } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { isAiModelChatCapable } from '../../../shared/api/contracts/ai/constants';
import { useAvailableAiModelsQuery } from '../../../shared/api/queries/aiModels';
import { UiContextChatPanel, type UiContextChatCommand, type UiContextChatRunCommandRequest, type UiContextChatSendRequest } from '../../../shared/ui';
import { WORKSPACE_SPLIT_PANEL_KEYS } from '../../../shared/ui/workspaceSplitStorage';
import type { WorkflowDesignerProjection, WorkflowModel } from '../types';

/**
 * p-99/WFT-12 (scoped, independent slice — see `workflowDesignerAi.service.ts`'s doc comment) — a
 * chat sidebar for the Workflow Designer, built on the same reusable pattern as
 * `ImageEditorAiPanel`/`FileHubAiPanel`/`SqlConsoleAiPanel`/`SshHubAiPanel`: a thin wrapper around the
 * shared `UiContextChatPanel`. Beyond plain explanation, it can propose a workflow change as ONE
 * reviewable "write" command — the exact JSON array of `WorkflowDraftOperation`s the backend already
 * validated (`workflowDraftOperationListSchema`). No `agencyModes` are passed, so the panel stays in
 * the base component's default 'ask' mode and a proposal never auto-runs — the operator must click
 * Apply, same as `FileHubAiPanel`'s command cards. "Applying" only stages the operations into the
 * Designer's existing local-preview + pending-operations queue (`onApplyOperations` -> `queueOps` in
 * `WorkflowEditorWorkspace.tsx`) — nothing reaches the database until the operator's own Save.
 */

const buildWorkflowSnapshot = (
  model: WorkflowModel,
  actionCatalog: WorkflowDesignerProjection['actionCatalog'],
  readOnly: boolean,
): string => JSON.stringify({
  key: model.key,
  name: model.name,
  start: model.start,
  readOnly,
  nodes: model.nodes.map((node) => {
    const { key, kind, ...rest } = node;
    return { key, kind, ...rest };
  }),
  edges: model.edges,
  availableActionKeys: actionCatalog.map((action) => action.key),
}, null, 2);

type WorkflowDesignerAiPanelProps = {
  model: WorkflowModel;
  actionCatalog: WorkflowDesignerProjection['actionCatalog'];
  readOnly: boolean;
  onApplyOperations: (operations: unknown[]) => void;
};

export const WorkflowDesignerAiPanel: React.FC<WorkflowDesignerAiPanelProps> = ({ model, actionCatalog, readOnly, onApplyOperations }) => {
  const modelsQuery = useAvailableAiModelsQuery();
  const stateRef = useRef({ model, actionCatalog, readOnly });
  stateRef.current = { model, actionCatalog, readOnly };

  const chatModels = useMemo(
    () => (modelsQuery.data?.models ?? []).filter((entry) => isAiModelChatCapable(entry)),
    [modelsQuery.data?.models],
  );

  const handleSend = async ({ prompt, modelId, history }: UiContextChatSendRequest) => {
    const { model: currentModel, actionCatalog: currentCatalog, readOnly: currentReadOnly } = stateRef.current;
    const response = await apiFetch('/api/ai/workflow-designer/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        workflowSnapshot: buildWorkflowSnapshot(currentModel, currentCatalog, currentReadOnly),
        modelId,
        history,
      }),
    });

    const data = await response.json().catch(() => ({})) as { success?: boolean; text?: string; operations?: unknown[]; error?: string };
    if (!response.ok || !data.success) {
      throw new Error(data.error || response.statusText || 'Workflow Designer AI request failed.');
    }

    const operations = Array.isArray(data.operations) ? data.operations : [];
    const commands: UiContextChatCommand[] = operations.length > 0 ? [{
      id: `wf-ops-${Date.now()}`,
      command: JSON.stringify(operations, null, 2),
      language: 'json',
      effect: 'write',
      status: 'pending',
    }] : [];

    return { text: data.text?.trim() || '', commands };
  };

  const handleRunCommand = async ({ command }: UiContextChatRunCommandRequest) => {
    let operations: unknown[];
    try {
      const parsed = JSON.parse(command.command) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('empty');
      }
      operations = parsed;
    } catch {
      throw new Error('Could not read the proposed change.');
    }
    onApplyOperations(operations);
  };

  return (
    <UiContextChatPanel
      welcomeText="Ask about this workflow, or ask me to add or change something — I'll propose the exact change for you to review and apply, never apply it myself."
      placeholder="Ask about this workflow, or ask for a change..."
      sendingLabel="Thinking..."
      promptAriaLabel="Workflow AI assist prompt"
      models={chatModels.map((entry) => ({ id: entry.id, name: entry.name }))}
      defaultModelId={modelsQuery.data?.defaultModelId}
      modelsLoading={modelsQuery.isLoading}
      aiEnabled={modelsQuery.data?.enabled ?? false}
      disabledBanner="AI is disabled in platform settings."
      emptyModelsBanner="Enable a chat-capable AI model in AI settings."
      panelKey={WORKSPACE_SPLIT_PANEL_KEYS.workflowDesignerAiPanel}
      sessionHistoryKey={`workflow-designer:${model.key || 'new'}`}
      commandRunLabel="Apply"
      commandRunningLabel="Applying..."
      commandRanLabel="Applied"
      commandFailedLabel="Failed"
      commandPendingHint="Review this change, then click Apply. Nothing is saved until you click Save in the toolbar."
      onSend={handleSend}
      onRunCommand={handleRunCommand}
    />
  );
};
