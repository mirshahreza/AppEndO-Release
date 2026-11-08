import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AgentCapabilityDropdown } from '../../../components/ai/AgentCapabilityDropdown';
import { AskAgentChatModeDropdown, type AskAgentChatMode } from '../../../components/ai/AskAgentChatModeDropdown';
import { apiFetch } from '../../../shared/api/client';
import { DEFAULT_AGENT_CAPABILITY_SCOPE, type AiAgentCapabilityScope } from '../../../shared/api/contracts/ai/capabilityPacks';
import { isAiModelChatCapable } from '../../../shared/api/contracts/ai/constants';
import { useAiMcpAccessMeQuery } from '../../../shared/api/queries/aiMcpAccess';
import { useAvailableAiModelsQuery } from '../../../shared/api/queries/aiModels';
import { useCultureT } from '../../../core/culture/CultureContext';
import { resolveNavLabel } from '../../../core/culture/cultureShellKeys';
import { streamAiAgentRun } from '../../../shared/lib/aiAgentStream';
import {
  persistChatAgencyMode,
  readChatAgencyMode,
  UiContextChatPanel,
  type UiContextChatAgencyMode,
  type UiContextChatCommand,
  type UiContextChatRunCommandRequest,
  type UiContextChatSendRequest,
} from '../../../shared/ui';
import { WORKSPACE_SPLIT_PANEL_KEYS } from '../../../shared/ui/workspaceSplitStorage';
import { createServerFunctionAgentApplyCollector } from '../lib/serverFunctionAiAgentApply';

const AGENCY_SURFACE = 'server-functions';
const AGENCY_MODES = ['ask', 'agentic'] as const satisfies readonly UiContextChatAgencyMode[];

const toAskAgentMode = (agency: UiContextChatAgencyMode): AskAgentChatMode => (
  agency === 'agentic' ? 'agent' : 'ask'
);

const toStoredAgency = (mode: AskAgentChatMode): UiContextChatAgencyMode => (
  mode === 'agent' ? 'agentic' : 'ask'
);

type ServerFunctionAiPanelProps = {
  readSnapshot: () => string;
  language: 'typescript' | 'javascript';
  readOnly: boolean;
  functionId?: string;
  functionName?: string;
  onApplySource: (source: string) => void;
  /** Current Monaco source — chat code blocks render as a changed-line diff against this. */
  codeDiffBaseline?: string;
};

const buildUserContent = (prompt: string, snapshot: string): string => [
  'Current function snapshot (includes Test Console lastRun output and logs):',
  '```json',
  snapshot || '(empty)',
  '```',
  '',
  'Debug loop: read lastRun.output and lastRun.logs (same as the Execute panel). To run the current unsaved editor source the same way Execute does, call test_server_function with functionId, payload parsed from testPayload, and source from this snapshot.',
  'To change the editor, you MUST call draft_server_function with the full new source (and functionId from this snapshot). This panel writes that source into Monaco. Do not claim the editor changed unless you drafted source. test_server_function only runs — it does not edit.',
  'If you first need to look something up or test something (schema, existing code, a test run), do that — then immediately continue in this same turn and call draft_server_function. Do not end the turn after only investigating and describing what you found; a turn that reports findings but never calls draft_server_function leaves the editor unchanged and reads to the operator as a stall, not progress.',
  '',
  'Operator request:',
  prompt,
].join('\n');

export const ServerFunctionAiPanel: React.FC<ServerFunctionAiPanelProps> = ({
  readSnapshot,
  language,
  readOnly,
  functionId,
  functionName,
  onApplySource,
  codeDiffBaseline,
}) => {
  const t = useCultureT();
  const location = useLocation();
  const modelsQuery = useAvailableAiModelsQuery();
  const [chatMode, setChatMode] = useState<AskAgentChatMode>(
    () => toAskAgentMode(readChatAgencyMode(AGENCY_SURFACE, AGENCY_MODES, 'agentic')),
  );
  const mcpAccessQuery = useAiMcpAccessMeQuery(chatMode === 'agent');
  const [capabilityScope, setCapabilityScope] = useState<AiAgentCapabilityScope>(() => ({
    packIds: [...DEFAULT_AGENT_CAPABILITY_SCOPE.packIds],
    mcpServerIds: [],
  }));
  const mcpScopeReadyRef = useRef(false);

  const propsRef = useRef({
    readSnapshot,
    language,
    readOnly,
    functionId,
    functionName,
    onApplySource,
    path: location.pathname,
    capabilityScope,
  });
  propsRef.current = {
    readSnapshot,
    language,
    readOnly,
    functionId,
    functionName,
    onApplySource,
    path: location.pathname,
    capabilityScope,
  };

  const allowedPacks = mcpAccessQuery.data?.packs ?? [];
  const enabledMcpServers = mcpAccessQuery.data?.mcpServers ?? [];

  useEffect(() => {
    const access = mcpAccessQuery.data;
    if (!access) {
      return;
    }
    const allowedPackIds = new Set(access.packs.map((pack) => pack.id));
    const allowedMcpIds = access.mcpServers.map((server) => server.id);
    const allowedMcpSet = new Set(allowedMcpIds);

    setCapabilityScope((current) => {
      if (!mcpScopeReadyRef.current) {
        mcpScopeReadyRef.current = true;
        const packIds = (access.defaultScope.packIds.length > 0
          ? access.defaultScope.packIds
          : DEFAULT_AGENT_CAPABILITY_SCOPE.packIds
        ).filter((packId) => allowedPackIds.has(packId));
        return {
          packIds,
          mcpServerIds: allowedMcpIds,
        };
      }

      const nextPackIds = current.packIds.filter((packId) => allowedPackIds.has(packId));
      const nextMcpServerIds = current.mcpServerIds.filter((serverId) => allowedMcpSet.has(serverId));
      if (
        nextPackIds.length === current.packIds.length
        && nextMcpServerIds.length === current.mcpServerIds.length
      ) {
        return current;
      }
      return { packIds: nextPackIds, mcpServerIds: nextMcpServerIds };
    });
  }, [mcpAccessQuery.data]);

  const chatModels = useMemo(
    () => (modelsQuery.data?.models ?? []).filter((model) => isAiModelChatCapable(model)),
    [modelsQuery.data?.models],
  );

  const handleAskSend = async ({ prompt, modelId, history }: UiContextChatSendRequest) => {
    const response = await apiFetch('/api/ai/server-functions/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        functionSnapshot: propsRef.current.readSnapshot(),
        modelId,
        history,
      }),
    });

    const data = await response.json().catch(() => ({})) as {
      success?: boolean;
      text?: string;
      source?: string;
      error?: string;
    };

    if (!response.ok || !data.success) {
      throw new Error(data.error || response.statusText || 'Server Function AI request failed.');
    }

    const source = typeof data.source === 'string' ? data.source : '';
    const commands: UiContextChatCommand[] = source.trim() && !propsRef.current.readOnly
      ? [{
          id: `sf-src-${Date.now()}`,
          command: source,
          language: propsRef.current.language,
          effect: 'write',
          status: 'pending',
        }]
      : [];

    return { text: data.text?.trim() || '', commands };
  };

  const handleAgenticSend = async ({ prompt, modelId, history }: UiContextChatSendRequest) => {
    const selected = chatModels.find((model) => model.id === modelId);
    if (selected && !selected.capabilities.tools) {
      throw new Error(t('serverFunctions.ai.toolsRequired'));
    }

    const { capabilityScope: scope, path, functionId: id, functionName: name, readOnly, language } = propsRef.current;
    const warnings: string[] = [];
    const applyCollector = createServerFunctionAgentApplyCollector();
    const result = await streamAiAgentRun(
      {
        mode: 'agent',
        messages: [
          ...history.map((item) => ({ role: item.role, content: item.content })),
          { role: 'user', content: buildUserContent(prompt, propsRef.current.readSnapshot()) },
        ],
        modelId,
        pageContext: {
          path,
          pageLabel: resolveNavLabel(t, 'server-functions', 'Server Functions'),
          pageKey: 'server-functions',
          functionId: id,
          functionName: name,
        },
        enabledMcpServerIds: scope.mcpServerIds,
        enabledCapabilityPackIds: scope.packIds,
        agentPlanActMode: 'implement',
      },
      {
        onEvent: (event) => {
          applyCollector.ingest(event);
          if (event.type === 'mcp_warning') {
            warnings.push(`${event.serverLabel}: ${event.message}`);
          }
        },
      },
    );

    const source = applyCollector.source();
    const commands: UiContextChatCommand[] = source && !readOnly
      ? [{
          id: `sf-src-${Date.now()}`,
          command: source,
          language,
          effect: 'write',
          status: 'pending',
        }]
      : [];

    const text = [
      result.text.trim(),
      warnings.length > 0 ? `${t('serverFunctions.ai.mcpWarnings')}\n${warnings.join('\n')}` : '',
      !source && !readOnly ? t('serverFunctions.ai.noSourceApplied') : '',
    ].filter(Boolean).join('\n\n');

    return {
      text: text || t('serverFunctions.ai.agentDone'),
      commands,
    };
  };

  const handleSend = async (request: UiContextChatSendRequest) => {
    if (chatMode === 'agent') {
      return handleAgenticSend(request);
    }
    return handleAskSend(request);
  };

  const handleChatModeChange = (next: AskAgentChatMode) => {
    setChatMode(next);
    persistChatAgencyMode(AGENCY_SURFACE, toStoredAgency(next));
  };

  const handleRunCommand = async ({ command }: UiContextChatRunCommandRequest) => {
    propsRef.current.onApplySource(command.command);
  };

  return (
    <UiContextChatPanel
      welcomeText={t('serverFunctions.ai.welcome')}
      placeholder={t('serverFunctions.ai.placeholder')}
      sendingLabel={t('serverFunctions.ai.sending')}
      promptAriaLabel={t('serverFunctions.ai.promptAria')}
      sendTitle={t('serverFunctions.ai.sendTitle')}
      models={chatModels.map((model) => ({ id: model.id, name: model.name }))}
      defaultModelId={modelsQuery.data?.defaultModelId}
      modelsLoading={modelsQuery.isLoading}
      aiEnabled={modelsQuery.data?.enabled ?? false}
      disabledBanner={t('serverFunctions.ai.disabled')}
      emptyModelsBanner={t('serverFunctions.ai.noModels')}
      panelKey={WORKSPACE_SPLIT_PANEL_KEYS.serverFunctionsAiPanel}
      sessionHistoryKey={`server-functions:${functionId ?? 'new'}`}
      defaultWidth={360}
      commandRunLabel={t('serverFunctions.ai.apply')}
      commandRunningLabel={t('serverFunctions.ai.applying')}
      commandRanLabel={t('serverFunctions.ai.applied')}
      commandFailedLabel={t('serverFunctions.ai.failed')}
      commandPendingHint={t('serverFunctions.ai.pendingHint')}
      agencyMode={chatMode === 'agent' ? 'agentic' : 'ask'}
      showAgencyPicker={false}
      promptToolbarStart={(
        <>
          <AskAgentChatModeDropdown mode={chatMode} onChange={handleChatModeChange} compact />
          {chatMode === 'agent' ? (
            <AgentCapabilityDropdown
              scope={capabilityScope}
              onChange={setCapabilityScope}
              allowedPacks={allowedPacks}
              enabledMcpServers={enabledMcpServers}
              disabled={chatModels.length === 0}
              compact
            />
          ) : null}
        </>
      )}
      promptBelow={chatMode === 'agent' && chatModels.length > 0 && !chatModels.some((model) => model.capabilities.tools) ? (
        <p className="ps-[4px] text-[11px] text-amber-700">{t('serverFunctions.ai.toolsRequired')}</p>
      ) : null}
      onSend={handleSend}
      onRunCommand={handleRunCommand}
      codeDiffBaseline={codeDiffBaseline}
    />
  );
};
