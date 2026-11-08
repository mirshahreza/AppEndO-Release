import React, { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, Layers } from 'lucide-react';
import { UiCheckboxChoice } from '../../shared/ui';
import {
  type AiAgentCapabilityScope,
  type AiCapabilityPack,
  type AiCapabilityPackId,
} from '../../shared/api/contracts/ai/capabilityPacks';
import type { AiMcpServerPublicConfig } from '../../shared/api/contracts/ai/types';
import {
  SPLIT_BUTTON_DROP_UP_MENU_FIXED_CLASS,
  SPLIT_BUTTON_MENU_ITEM_CLASS,
  useFixedDropUpMenuStyle,
  useSplitButtonMenu,
} from '../../shared/ui/AppSplitButton';
import { cn } from '../../lib/utils';

const toPascalCase = (name: string): string =>
  name
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');

const resolvePackIcon = (iconName: string): LucideIcon | null => {
  const icon = (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[toPascalCase(iconName)];
  return icon ?? null;
};

export type AgentCapabilityDropdownProps = {
  scope: AiAgentCapabilityScope;
  onChange: (scope: AiAgentCapabilityScope) => void;
  allowedPacks: ReadonlyArray<Pick<AiCapabilityPack, 'id' | 'label' | 'description' | 'icon' | 'hasWriteTools'>>;
  enabledMcpServers: AiMcpServerPublicConfig[];
  disabled?: boolean;
  compact?: boolean;
};

export const AgentCapabilityDropdown: React.FC<AgentCapabilityDropdownProps> = ({
  scope,
  onChange,
  allowedPacks,
  enabledMcpServers,
  disabled = false,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen);
  const menuStyle = useFixedDropUpMenuStyle(isOpen, menuRef, { minWidth: 256, maxHeight: 288 });

  const enabledPackSet = useMemo(() => new Set(scope.packIds), [scope.packIds]);
  const enabledMcpSet = useMemo(() => new Set(scope.mcpServerIds), [scope.mcpServerIds]);

  const enabledCount = scope.packIds.length + scope.mcpServerIds.length;

  const togglePack = (packId: AiCapabilityPackId, checked: boolean) => {
    const nextPackIds = checked
      ? [...scope.packIds, packId]
      : scope.packIds.filter((id) => id !== packId);
    onChange({
      packIds: [...new Set(nextPackIds)],
      mcpServerIds: scope.mcpServerIds,
    });
  };

  const toggleMcpServer = (serverId: string, checked: boolean) => {
    const nextMcpServerIds = checked
      ? [...scope.mcpServerIds, serverId]
      : scope.mcpServerIds.filter((id) => id !== serverId);
    onChange({
      packIds: scope.packIds,
      mcpServerIds: [...new Set(nextMcpServerIds)],
    });
  };

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        className={cn(
          'flex items-center rounded text-slate-500 transition-colors',
          compact ? 'h-5 gap-1 px-1 text-[10px] leading-none' : 'gap-1 px-1.5 py-0.5 text-[11px]',
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'hover:bg-slate-50 hover:text-slate-700',
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Agent capabilities: ${enabledCount} enabled`}
        title="Agent capabilities"
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => {
          if (disabled) return;
          setIsOpen((open) => !open);
        }}
      >
        <Layers className="h-3 w-3 shrink-0" />
        <span className="truncate font-medium">Capabilities</span>
        {enabledCount > 0 ? (
          <span className={cn(
            'rounded bg-indigo-50 font-semibold text-indigo-700',
            compact ? 'px-0.5 text-[8px] leading-none' : 'px-1 text-[10px]',
          )}
          >
            {enabledCount}
          </span>
        ) : null}
        <ChevronDown className={cn('shrink-0 transition-transform', compact ? 'h-2.5 w-2.5' : 'h-3 w-3', isOpen && 'rotate-180')} />
      </button>

      {isOpen && !disabled ? (
        <div
          className={cn(
            SPLIT_BUTTON_DROP_UP_MENU_FIXED_CLASS,
            'min-w-[16rem] max-w-[20rem] py-2',
          )}
          style={menuStyle}
          role="listbox"
          aria-label="Agent capabilities"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Built-in packs
          </div>
          <div className="flex flex-col gap-0.5 px-1.5">
            {allowedPacks.map((pack) => {
              const PackIcon = resolvePackIcon(pack.icon);
              const isChecked = enabledPackSet.has(pack.id);
              return (
                <UiCheckboxChoice
                  key={pack.id}
                  checked={isChecked}
                  onChange={(checked) => togglePack(pack.id, checked)}
                  className="items-start rounded px-1.5 py-1.5 hover:bg-slate-50"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      {PackIcon ? <PackIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : null}
                      <span className="truncate">{pack.label}</span>
                      {pack.hasWriteTools ? (
                        <span className="rounded border border-amber-200 bg-amber-50 px-1 text-[9px] font-semibold uppercase text-amber-700">
                          write
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[10px] leading-snug text-slate-400">{pack.description}</span>
                  </span>
                </UiCheckboxChoice>
              );
            })}
          </div>

          {enabledMcpServers.length > 0 ? (
            <>
              <div className="mx-2.5 my-2 border-t border-slate-100" />
              <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                External MCP
              </div>
              <div className="flex flex-col gap-0.5 px-1.5">
                {enabledMcpServers.map((server) => {
                  const isChecked = enabledMcpSet.has(server.id);
                  return (
                    <UiCheckboxChoice
                      key={server.id}
                      checked={isChecked}
                      onChange={(checked) => toggleMcpServer(server.id, checked)}
                      className="rounded px-1.5 py-1.5 hover:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
                        {server.label}
                      </span>
                    </UiCheckboxChoice>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
