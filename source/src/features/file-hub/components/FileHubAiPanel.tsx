import React, { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { isAiModelChatCapable } from '../../../shared/api/contracts/ai/constants';
import { useAvailableAiModelsQuery } from '../../../shared/api/queries/aiModels';
import { useCultureT } from '../../../core/culture/CultureContext';
import { classifyFileHubCommand } from '../../../shared/lib/remoteAssist/classifyFileHubCommand';
import {
  persistChatAgencyMode,
  readChatAgencyMode,
  UI_CONTEXT_CHAT_AGENCY_MODES,
  UiContextChatPanel,
  type UiContextChatAgencyMode,
  type UiContextChatCommand,
  type UiContextChatSendRequest,
} from '../../../shared/ui';
import { WORKSPACE_SPLIT_PANEL_KEYS } from '../../../shared/ui/workspaceSplitStorage';

type FileHubAiPanelProps = {
  readSnapshot: () => string;
  onExecuteCommand: (command: string) => Promise<void>;
};

const AGENCY_SURFACE = 'file-hub';

export const FileHubAiPanel: React.FC<FileHubAiPanelProps> = ({
  readSnapshot,
  onExecuteCommand,
}) => {
  const t = useCultureT();
  const modelsQuery = useAvailableAiModelsQuery();
  const [agencyMode, setAgencyMode] = useState<UiContextChatAgencyMode>(
    () => readChatAgencyMode(AGENCY_SURFACE),
  );

  const chatModels = useMemo(
    () => (modelsQuery.data?.models ?? []).filter((model) => isAiModelChatCapable(model)),
    [modelsQuery.data?.models],
  );

  const handleSend = async ({ prompt, modelId, history }: UiContextChatSendRequest) => {
    const response = await apiFetch('/api/ai/file-hub/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        listingSnapshot: readSnapshot(),
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
      throw new Error(data.error || response.statusText || 'File Hub AI request failed.');
    }

    const rawCommands = Array.isArray(data.commands)
      ? data.commands.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

    const commands: UiContextChatCommand[] = rawCommands.map((command, index) => ({
      id: `file-cmd-${Date.now()}-${index}`,
      command,
      language: 'ftp',
      effect: classifyFileHubCommand(command),
      status: 'pending',
    }));

    return {
      text: data.text?.trim() || '',
      commands,
    };
  };

  return (
    <UiContextChatPanel
      welcomeText={t('fileHub.ai.welcome')}
      placeholder={t('fileHub.ai.placeholder')}
      sendingLabel={t('fileHub.ai.sending')}
      promptAriaLabel={t('fileHub.ai.promptAria')}
      sendTitle={t('fileHub.ai.sendTitle')}
      models={chatModels.map((model) => ({ id: model.id, name: model.name }))}
      defaultModelId={modelsQuery.data?.defaultModelId}
      modelsLoading={modelsQuery.isLoading}
      aiEnabled={modelsQuery.data?.enabled ?? false}
      disabledBanner={t('fileHub.ai.disabled')}
      emptyModelsBanner={t('fileHub.ai.noModels')}
      panelKey={WORKSPACE_SPLIT_PANEL_KEYS.fileHubAiPanel}
      commandRunLabel={t('fileHub.ai.run')}
      commandRunningLabel={t('fileHub.ai.running')}
      commandRanLabel={t('fileHub.ai.ran')}
      commandFailedLabel={t('fileHub.ai.failed')}
      commandPendingHint={t('fileHub.ai.pendingHint')}
      agencyModes={UI_CONTEXT_CHAT_AGENCY_MODES}
      agencyMode={agencyMode}
      agencyAriaLabel={t('fileHub.ai.modeAria')}
      onAgencyModeChange={(next) => {
        setAgencyMode(next);
        persistChatAgencyMode(AGENCY_SURFACE, next);
      }}
      onSend={handleSend}
      onRunCommand={async ({ command }) => {
        await onExecuteCommand(command.command);
      }}
    />
  );
};
