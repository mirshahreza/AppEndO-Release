import React, { useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../shared/api/client';
import { isAiModelChatCapable } from '../../shared/api/contracts/ai/constants';
import { useAvailableAiModelsQuery } from '../../shared/api/queries/aiModels';
import type { ExecuteDataSourceQueryResult } from '../../shared/api/contracts/data-sources/executeQuery';
import { validateExecuteDataSourceSql } from '../../shared/lib/executeDataSourceQuery';
import {
  persistChatAgencyMode,
  readChatAgencyMode,
  UI_CONTEXT_CHAT_AGENCY_MODES,
  UiContextChatPanel,
  type UiContextChatAgencyMode,
  type UiContextChatCommand,
  type UiContextChatSendRequest,
} from '../../shared/ui';
import { WORKSPACE_SPLIT_PANEL_KEYS } from '../../shared/ui/workspaceSplitStorage';

const MAX_RESULT_PREVIEW_ROWS = 20;
const AGENCY_SURFACE = 'sql-console';

const formatResultPreview = (sql: string, result: ExecuteDataSourceQueryResult | null): string => {
  if (!result) {
    return '';
  }
  const rows = Array.isArray(result.data) ? result.data.slice(0, MAX_RESULT_PREVIEW_ROWS) : [];
  const rowsText = rows.length > 0 ? JSON.stringify(rows) : '(no rows)';
  const truncatedNote = result.truncated ? ' (truncated)' : '';
  return `Query: ${sql}\nRows (${result.count}${truncatedNote}): ${rowsText}`;
};

type SqlConsoleAiPanelProps = {
  dataSourceId: string;
  sql: string;
  onRunSuggestedSql: (sql: string, allowWrite: boolean) => Promise<ExecuteDataSourceQueryResult | null>;
};

export const SqlConsoleAiPanel: React.FC<SqlConsoleAiPanelProps> = ({
  dataSourceId,
  sql,
  onRunSuggestedSql,
}) => {
  const modelsQuery = useAvailableAiModelsQuery();
  const [agencyMode, setAgencyMode] = useState<UiContextChatAgencyMode>(
    () => readChatAgencyMode(AGENCY_SURFACE, UI_CONTEXT_CHAT_AGENCY_MODES, 'read-only'),
  );

  const chatModels = useMemo(
    () => (modelsQuery.data?.models ?? []).filter((model) => isAiModelChatCapable(model)),
    [modelsQuery.data?.models],
  );

  const lastResultPreviewRef = useRef('');
  const agencyModeRef = useRef(agencyMode);
  agencyModeRef.current = agencyMode;

  const handleSend = async ({ prompt, modelId, history, agencyMode: sendAgency }: UiContextChatSendRequest) => {
    const allowWrite = sendAgency === 'agentic';
    const response = await apiFetch('/api/ai/sql-console/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        dataSourceId,
        sqlSnapshot: sql,
        previousResultPreview: lastResultPreviewRef.current,
        allowWrite,
        modelId,
        history,
      }),
    });

    const data = await response.json().catch(() => ({})) as {
      success?: boolean;
      text?: string;
      commands?: string[];
      error?: string;
    };

    if (!response.ok || !data.success) {
      throw new Error(data.error || response.statusText || 'SQL Console AI request failed.');
    }

    const rawCommands = Array.isArray(data.commands)
      ? data.commands.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

    const commands: UiContextChatCommand[] = rawCommands.map((command, index) => ({
      id: `sql-console-cmd-${Date.now()}-${index}`,
      command,
      language: 'sql',
      effect: validateExecuteDataSourceSql(command).ok ? 'read' : 'write',
      status: 'pending',
    }));

    return {
      text: data.text?.trim() || '',
      commands,
    };
  };

  return (
    <UiContextChatPanel
      welcomeText="Ask for a query in plain language. Ask keeps SQL in this panel. Read only runs SELECT automatically. Agentic also runs writes."
      placeholder="Ask for data, e.g. top 10 customers by revenue this month..."
      sendingLabel="Working..."
      promptAriaLabel="SQL Console AI prompt"
      sendTitle="Send prompt"
      models={chatModels.map((model) => ({ id: model.id, name: model.name }))}
      defaultModelId={modelsQuery.data?.defaultModelId}
      modelsLoading={modelsQuery.isLoading}
      aiEnabled={modelsQuery.data?.enabled ?? false}
      disabledBanner="AI is disabled in platform settings."
      emptyModelsBanner="Enable a chat model in AI settings."
      panelKey={WORKSPACE_SPLIT_PANEL_KEYS.sqlConsoleAiPanel}
      sessionHistoryKey={`sql-console:${dataSourceId}`}
      commandRunLabel="Run"
      commandRunningLabel="Running..."
      commandRanLabel="Ran"
      commandFailedLabel="Failed"
      commandPendingHint="Review this query, then run it."
      agencyModes={UI_CONTEXT_CHAT_AGENCY_MODES}
      agencyMode={agencyMode}
      agencyPickerVariant="dropdown"
      agencyAriaLabel="SQL assistant agency"
      onAgencyModeChange={(next) => {
        setAgencyMode(next);
        persistChatAgencyMode(AGENCY_SURFACE, next);
      }}
      onSend={handleSend}
      onRunCommand={async ({ command }) => {
        const result = await onRunSuggestedSql(command.command, agencyModeRef.current === 'agentic');
        if (result === null) {
          throw new Error('Query did not run.');
        }
        lastResultPreviewRef.current = formatResultPreview(command.command, result);
      }}
    />
  );
};
