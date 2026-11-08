import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AgentCapabilityDropdown } from '../../../../components/ai/AgentCapabilityDropdown';
import { AskAgentChatModeDropdown, type AskAgentChatMode } from '../../../../components/ai/AskAgentChatModeDropdown';
import { apiFetch } from '../../../../shared/api/client';
import { DEFAULT_AGENT_CAPABILITY_SCOPE, type AiAgentCapabilityScope } from '../../../../shared/api/contracts/ai/capabilityPacks';
import { isAiModelChatCapable } from '../../../../shared/api/contracts/ai/constants';
import { useAiMcpAccessMeQuery } from '../../../../shared/api/queries/aiMcpAccess';
import { useAvailableAiModelsQuery } from '../../../../shared/api/queries/aiModels';
import { useCultureT } from '../../../../core/culture/CultureContext';
import { resolveNavLabel } from '../../../../core/culture/cultureShellKeys';
import { streamAiAgentRun } from '../../../../shared/lib/aiAgentStream';
import {
  persistChatAgencyMode,
  readChatAgencyMode,
  UiContextChatPanel,
  type UiContextChatAgencyMode,
  type UiContextChatCommand,
  type UiContextChatRunCommandRequest,
  type UiContextChatSendRequest,
} from '../../../../shared/ui';
import { WORKSPACE_SPLIT_PANEL_KEYS } from '../../../../shared/ui/workspaceSplitStorage';
import type { DesignerBindingDefinitions } from '../../../../domain/component-designer/types';
import {
  createClientComponentAgentApplyCollector,
  isDesignerDocument,
  type ClientComponentLayoutApplyPayload,
} from '../../lib/clientComponentAiAgentApply';

const AGENCY_SURFACE = 'client-components';
const AGENCY_MODES = ['ask', 'agentic'] as const satisfies readonly UiContextChatAgencyMode[];

const toAskAgentMode = (agency: UiContextChatAgencyMode): AskAgentChatMode => (
  agency === 'agentic' ? 'agent' : 'ask'
);

const toStoredAgency = (mode: AskAgentChatMode): UiContextChatAgencyMode => (
  mode === 'agent' ? 'agentic' : 'ask'
);

type ClientComponentAiPanelProps = {
  readSnapshot: () => string;
  readOnly: boolean;
  layoutId?: string | null;
  componentName?: string;
  selectedNodeId?: string | null;
  onApplyLayout: (payload: ClientComponentLayoutApplyPayload) => void;
  codeDiffBaseline?: string;
};

const serializeLayoutCommand = (payload: ClientComponentLayoutApplyPayload): string => (
  JSON.stringify({
    document: payload.document,
    bindingDefinitions: payload.bindingDefinitions,
  }, null, 2)
);

const parseLayoutCommand = (raw: string): ClientComponentLayoutApplyPayload | null => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as { document?: unknown; bindingDefinitions?: unknown };
    if (!isDesignerDocument(record.document)) {
      return null;
    }
    const bindingDefinitions = record.bindingDefinitions && typeof record.bindingDefinitions === 'object'
      && !Array.isArray(record.bindingDefinitions)
      ? record.bindingDefinitions as DesignerBindingDefinitions
      : {};
    return { document: record.document, bindingDefinitions };
  } catch {
    return null;
  }
};

const buildUserContent = (prompt: string, snapshot: string): string => [
  'Current layout snapshot (includes the unsaved Live Designer canvas):',
  '```json',
  snapshot || '(empty)',
  '```',
  '',
  'To change the canvas, you MUST call draft_component_layout with name, layoutId from this snapshot, and the full updated document (and bindingDefinitions when bindings change). designer_set_prop / designer_insert_palette_item also work against this layoutId. This panel writes the drafted document onto the canvas. Do not claim the canvas changed unless you drafted a document. Nothing is saved until the operator clicks Save.',
  'If you first need to look something up (an API route, its schema, existing code), do that — then immediately continue in this same turn and call draft_component_layout. Do not end the turn after only investigating and describing what you found; a turn that reports findings but never calls draft_component_layout leaves the canvas unchanged and reads to the operator as a stall, not progress.',
  '',
  'Operator request:',
  prompt,
].join('\n');

export const ClientComponentAiPanel: React.FC<ClientComponentAiPanelProps> = ({
  readSnapshot,
  readOnly,
  layoutId,
  componentName,
  selectedNodeId,
  onApplyLayout,
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
    readOnly,
    layoutId,
    componentName,
    selectedNodeId,
    onApplyLayout,
    path: location.pathname,
    capabilityScope,
  });
  propsRef.current = {
    readSnapshot,
    readOnly,
    layoutId,
    componentName,
    selectedNodeId,
    onApplyLayout,
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
    const response = await apiFetch('/api/ai/client-components/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        layoutSnapshot: propsRef.current.readSnapshot(),
        modelId,
        history,
      }),
    });

    const data = await response.json().catch(() => ({})) as {
      success?: boolean;
      text?: string;
      document?: unknown;
      bindingDefinitions?: unknown;
      error?: string;
    };

    if (!response.ok || !data.success) {
      throw new Error(data.error || response.statusText || 'Client Component AI request failed.');
    }

    const layout = isDesignerDocument(data.document) && !propsRef.current.readOnly
      ? {
          document: data.document,
          bindingDefinitions: (
            data.bindingDefinitions && typeof data.bindingDefinitions === 'object' && !Array.isArray(data.bindingDefinitions)
              ? data.bindingDefinitions as DesignerBindingDefinitions
              : {}
          ),
        }
      : null;
    const commands: UiContextChatCommand[] = layout
      ? [{
          id: `cc-layout-${Date.now()}`,
          command: serializeLayoutCommand(layout),
          language: 'json',
          effect: 'write',
          status: 'pending',
        }]
      : [];

    return { text: data.text?.trim() || '', commands };
  };

  const handleAgenticSend = async ({ prompt, modelId, history }: UiContextChatSendRequest) => {
    const selected = chatModels.find((model) => model.id === modelId);
    if (selected && !selected.capabilities.tools) {
      throw new Error(t('designer.ai.toolsRequired'));
    }

    const {
      capabilityScope: scope,
      path,
      layoutId: id,
      componentName: name,
      selectedNodeId: nodeId,
      readOnly: isReadOnly,
    } = propsRef.current;
    const warnings: string[] = [];
    const applyCollector = createClientComponentAgentApplyCollector();
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
          pageLabel: resolveNavLabel(t, 'client-components', 'Client Components'),
          pageKey: 'client-components',
          layoutId: id,
          selectedNodeId: nodeId,
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

    const layout = applyCollector.layout();
    const commands: UiContextChatCommand[] = layout && !isReadOnly
      ? [{
          id: `cc-layout-${Date.now()}`,
          command: serializeLayoutCommand(layout),
          language: 'json',
          effect: 'write',
          status: 'pending',
        }]
      : [];

    const text = [
      result.text.trim(),
      warnings.length > 0 ? `${t('designer.ai.mcpWarnings')}\n${warnings.join('\n')}` : '',
      !layout && !isReadOnly ? t('designer.ai.noLayoutApplied') : '',
    ].filter(Boolean).join('\n\n');

    return {
      text: text || t('designer.ai.agentDone'),
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
    const layout = parseLayoutCommand(command.command);
    if (!layout) {
      throw new Error(t('designer.ai.failed'));
    }
    propsRef.current.onApplyLayout(layout);
  };

  return (
    <UiContextChatPanel
      welcomeText={t('designer.ai.welcome')}
      placeholder={t('designer.ai.placeholder')}
      sendingLabel={t('designer.ai.sending')}
      promptAriaLabel={t('designer.ai.promptAria')}
      sendTitle={t('designer.ai.sendTitle')}
      models={chatModels.map((model) => ({ id: model.id, name: model.name }))}
      defaultModelId={modelsQuery.data?.defaultModelId}
      modelsLoading={modelsQuery.isLoading}
      aiEnabled={modelsQuery.data?.enabled ?? false}
      disabledBanner={t('designer.ai.disabled')}
      emptyModelsBanner={t('designer.ai.noModels')}
      panelKey={WORKSPACE_SPLIT_PANEL_KEYS.liveDesignerAiPanel}
      sessionHistoryKey={`client-components:${layoutId ?? 'new'}`}
      defaultWidth={360}
      commandRunLabel={t('designer.ai.apply')}
      commandRunningLabel={t('designer.ai.applying')}
      commandRanLabel={t('designer.ai.applied')}
      commandFailedLabel={t('designer.ai.failed')}
      commandPendingHint={t('designer.ai.pendingHint')}
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
        <p className="ps-[4px] text-[11px] text-amber-700">{t('designer.ai.toolsRequired')}</p>
      ) : null}
      onSend={handleSend}
      onRunCommand={handleRunCommand}
      codeDiffBaseline={codeDiffBaseline}
    />
  );
};
