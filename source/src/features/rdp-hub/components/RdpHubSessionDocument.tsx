import React, { useState } from 'react';
import { Pencil, RefreshCw } from 'lucide-react';
import { AppButton, UiChip } from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import type { RdpHubConnectionPublic } from '../../../shared/api/contracts/rdp-hub/types';
import type { RdpHubPageState } from '../hooks/useRdpHubPage';
import { RdpHubDesktopPanel, type RdpHubDesktopStatus } from './RdpHubDesktopPanel';

const statusChipClass: Record<RdpHubDesktopStatus, string> = {
  connecting: 'border-amber-200 bg-amber-50 text-amber-800',
  connected: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  disconnected: 'border-slate-200 bg-slate-50 text-slate-600',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
};

export function RdpHubSessionDocument({
  connection,
  onEdit,
}: {
  connection: RdpHubConnectionPublic;
  onEdit: RdpHubPageState['openSettings'];
}) {
  const t = useCultureT();
  const [status, setStatus] = useState<RdpHubDesktopStatus>('connecting');
  const [reconnectToken, setReconnectToken] = useState(0);

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
              {t(`rdpHub.editor.${status}`)}
            </UiChip>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <AppButton
              intent="utility"
              size="sm"
              onClick={() => {
                setStatus('connecting');
                setReconnectToken((value) => value + 1);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('rdpHub.editor.reconnect')}
            </AppButton>
            <AppButton intent="secondary" size="sm" onClick={() => onEdit(connection)}>
              <Pencil className="h-3.5 w-3.5" />
              {t('actions.edit')}
            </AppButton>
          </div>
        </div>
      </div>
      <RdpHubDesktopPanel
        connection={connection}
        reconnectToken={reconnectToken}
        onStatusChange={setStatus}
      />
    </div>
  );
}
