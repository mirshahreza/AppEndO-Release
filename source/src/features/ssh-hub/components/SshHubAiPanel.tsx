import React, { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { isAiModelChatCapable } from '../../../shared/api/contracts/ai/constants';
import { useAvailableAiModelsQuery } from '../../../shared/api/queries/aiModels';
import { useCultureT } from '../../../core/culture/CultureContext';
import { classifyShellCommand } from '../../../shared/lib/remoteAssist/classifyShellCommand';
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
import type { SshHubTerminalHandle } from './SshHubTerminalPanel';

type SshHubAiPanelProps = {
  terminalRef: React.RefObject<SshHubTerminalHandle | null>;
};

const AGENCY_SURFACE = 'ssh-hub';

const toShellInput = (command: string) => (
  command.endsWith('\n') || command.endsWith('\r') ? command : `${command}\r`
);

const sendCommand = (terminalRef: React.RefObject<SshHubTerminalHandle | null>, command: string): boolean => (
  terminalRef.current?.sendInput(toShellInput(command)) ?? false
);

export const SshHubAiPanel: React.FC<SshHubAiPanelProps> = ({ terminalRef }) => {
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
    const snapshot = terminalRef.current?.readSnapshot() ?? '';
    const response = await apiFetch('/api/ai/ssh/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        terminalSnapshot: snapshot,
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
      throw new Error(data.error || response.statusText || 'SSH AI request failed.');
    }

    const rawCommands = Array.isArray(data.commands)
      ? data.commands.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

    const commands: UiContextChatCommand[] = rawCommands.map((command, index) => ({
      id: `ssh-cmd-${Date.now()}-${index}`,
      command,
      language: 'bash',
      effect: classifyShellCommand(command),
      status: 'pending',
    }));

    return {
      text: data.text?.trim() || '',
      commands,
    };
  };

  return (
    <UiContextChatPanel
      welcomeText={t('sshHub.ai.welcome')}
      placeholder={t('sshHub.ai.placeholder')}
      sendingLabel={t('sshHub.ai.sending')}
      promptAriaLabel={t('sshHub.ai.promptAria')}
      sendTitle={t('sshHub.ai.sendTitle')}
      models={chatModels.map((model) => ({ id: model.id, name: model.name }))}
      defaultModelId={modelsQuery.data?.defaultModelId}
      modelsLoading={modelsQuery.isLoading}
      aiEnabled={modelsQuery.data?.enabled ?? false}
      disabledBanner={t('sshHub.ai.disabled')}
      emptyModelsBanner={t('sshHub.ai.noModels')}
      panelKey={WORKSPACE_SPLIT_PANEL_KEYS.sshHubAiPanel}
      commandRunLabel={t('sshHub.ai.run')}
      commandRunningLabel={t('sshHub.ai.running')}
      commandRanLabel={t('sshHub.ai.ran')}
      commandFailedLabel={t('sshHub.ai.failed')}
      commandPendingHint={t('sshHub.ai.pendingHint')}
      agencyModes={UI_CONTEXT_CHAT_AGENCY_MODES}
      agencyMode={agencyMode}
      agencyAriaLabel={t('sshHub.ai.modeAria')}
      onAgencyModeChange={(next) => {
        setAgencyMode(next);
        persistChatAgencyMode(AGENCY_SURFACE, next);
      }}
      onSend={handleSend}
      onRunCommand={async ({ command }) => {
        if (!sendCommand(terminalRef, command.command)) {
          throw new Error('Could not send command to the terminal.');
        }
      }}
    />
  );
};
