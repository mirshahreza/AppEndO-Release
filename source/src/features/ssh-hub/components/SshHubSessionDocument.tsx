import React, { useRef, useState } from 'react';
import { Pencil, RefreshCw, Sparkles } from 'lucide-react';
import { AppButton, UiChip } from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import { useAiSettingsQuery } from '../../../shared/api/queries/aiModels';
import { isAiGloballyEnabled } from '../../../shared/lib/aiAccess';
import type { SshHubConnectionPublic } from '../../../shared/api/contracts/ssh-hub/types';
import type { SshHubPageState } from '../hooks/useSshHubPage';
import { SshHubAiPanel } from './SshHubAiPanel';
import { SshHubTerminalPanel, type SshHubTerminalHandle, type SshHubTerminalStatus } from './SshHubTerminalPanel';

const statusChipClass: Record<SshHubTerminalStatus, string> = {
  connecting: 'border-amber-200 bg-amber-50 text-amber-800',
  connected: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  disconnected: 'border-slate-200 bg-slate-50 text-slate-600',
};

export function SshHubSessionDocument({
  connection,
  onEdit,
}: {
  connection: SshHubConnectionPublic;
  onEdit: SshHubPageState['openSettings'];
}) {
  const t = useCultureT();
  const [status, setStatus] = useState<SshHubTerminalStatus>('connecting');
  const [reconnectToken, setReconnectToken] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const terminalRef = useRef<SshHubTerminalHandle | null>(null);
  const aiSettingsQuery = useAiSettingsQuery();
  const showAi = isAiGloballyEnabled(aiSettingsQuery.data?.enabled);
  const aiToggleLabel = aiOpen ? t('sshHub.ai.hide') : t('sshHub.ai.show');

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-[9px]">
        <div className="flex min-h-8 min-w-0 items-center justify-between gap-2 font-sans text-xs font-semibold text-slate-500">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <span className="truncate font-mono text-xs font-semibold text-slate-700" title={connection.name}>
              {connection.name}
            </span>
            <span className="hidden truncate font-mono text-[11px] text-slate-500 sm:inline">
              {connection.username}@{connection.host}:{connection.port}
            </span>
            <UiChip size="sm" variant="soft" className={cn(statusChipClass[status])}>
              {t(`sshHub.editor.${status}`)}
            </UiChip>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {showAi ? (
              <AppButton
                size="icon-md"
                intent={aiOpen ? 'toggle-on' : 'toggle-off'}
                aria-label={aiToggleLabel}
                title={aiToggleLabel}
                aria-pressed={aiOpen}
                onClick={() => setAiOpen((open) => !open)}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </AppButton>
            ) : null}
            <AppButton
              intent="utility"
              size="sm"
              onClick={() => {
                setStatus('connecting');
                setReconnectToken((value) => value + 1);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('sshHub.editor.reconnect')}
            </AppButton>
            <AppButton intent="secondary" size="sm" onClick={() => onEdit(connection)}>
              <Pencil className="h-3.5 w-3.5" />
              {t('actions.edit')}
            </AppButton>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <SshHubTerminalPanel
          ref={terminalRef}
          connection={connection}
          reconnectToken={reconnectToken}
          onStatusChange={setStatus}
        />
        {showAi && status === 'connected' ? (
          <div className={aiOpen ? 'contents' : 'hidden'}>
            <SshHubAiPanel key={connection.id} terminalRef={terminalRef} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
