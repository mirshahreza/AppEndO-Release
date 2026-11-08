import React, { useState } from 'react';
import { ChevronDown, FilePenLine } from 'lucide-react';
import type { AppliedChangeItem, FileDiffZone } from '../../shared/api/contracts/ai/agentTypes';
import { formatDiffZoneLabel } from '../../shared/lib/appendoo/diffZones';
import { AppButton } from '../../shared/ui/AppButton';
import { NavigationIcon } from '../../shared/lib/navigationIcons/NavigationIcon';
import { cn } from '../../lib/utils';

export type VibeAppliedChangesFooterProps = {
  items: AppliedChangeItem[];
  onReject: (changeSetId: string) => void;
  onRevertZone?: (changeSetId: string, zone: FileDiffZone) => void;
  busy?: boolean;
  rejectingChangeSetId?: string | null;
  rejectingZoneKey?: string | null;
};

const zoneKey = (changeSetId: string, zone: FileDiffZone): string => (
  `${changeSetId}:${zone.startLine}-${zone.endLine}`
);

export const VibeAppliedChangesFooter = ({
  items,
  onReject,
  onRevertZone,
  busy,
  rejectingChangeSetId,
  rejectingZoneKey,
}: VibeAppliedChangesFooterProps) => {
  const [expanded, setExpanded] = useState(false);
  const activeItems = items.filter((item) => !item.rolledBack);
  if (activeItems.length === 0) {
    return null;
  }

  const countLabel = activeItems.length === 1
    ? '1 change'
    : `${activeItems.length} changes`;

  return (
    <div className="border-b border-slate-200 bg-slate-50/80">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-4 py-2 text-left transition-colors hover:bg-slate-100/80"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <FilePenLine className="h-3.5 w-3.5 shrink-0 text-indigo-600" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-[11px] font-semibold text-slate-700">
          Applied changes
          <span className="font-normal text-slate-500"> · {countLabel}</span>
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform',
            !expanded && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <ul className="space-y-1 px-4 pb-2">
          {activeItems.map((item) => {
            const isRejectingFile = busy && rejectingChangeSetId === item.changeSetId && !rejectingZoneKey;
            return (
              <li
                key={item.changeSetId}
                className="-mx-1 rounded px-1 py-1 transition-colors hover:bg-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-800"
                    title={item.label}
                  >
                    {item.label}
                  </span>
                  <button
                    type="button"
                    className={cn(
                      'shrink-0 border-0 bg-transparent p-0 text-slate-500 transition-colors',
                      'hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40',
                    )}
                    disabled={busy}
                    aria-label="Reject all changes in this file"
                    title="Reject all changes"
                    onClick={() => onReject(item.changeSetId)}
                  >
                    <NavigationIcon
                      iconRef="tabler:IconReload"
                      className={cn('h-3.5 w-3.5', isRejectingFile && 'animate-spin')}
                    />
                  </button>
                </div>
                {item.kind === 'file_patch' && item.diffZones?.length && onRevertZone ? (
                  <div className="mt-1 flex flex-wrap items-center gap-1 ps-0.5">
                    <span className="text-[10px] text-slate-500">Zones:</span>
                    {item.diffZones.map((zone) => {
                      const key = zoneKey(item.changeSetId, zone);
                      const isRejectingZone = busy && rejectingZoneKey === key;
                      return (
                        <span key={key} className="inline-flex items-center gap-0.5">
                          <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] text-slate-600">
                            {formatDiffZoneLabel(zone)}
                          </span>
                          <AppButton
                            intent="cancel"
                            size="xs"
                            className="!h-5 !min-h-5 !px-1 !text-[9px]"
                            disabled={busy}
                            onClick={() => onRevertZone(item.changeSetId, zone)}
                          >
                            {isRejectingZone ? '…' : 'Revert'}
                          </AppButton>
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
