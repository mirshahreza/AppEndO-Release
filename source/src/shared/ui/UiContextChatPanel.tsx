import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  HelpCircle,
  History,
  Loader2,
  MessageSquarePlus,
  Play,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOptionalCultureT } from '../../core/culture/CultureContext';
import { cn } from '../../lib/utils';
import {
  DEFAULT_CHAT_AGENCY_MODE,
  resolveChatAgencyMode,
  shouldAutoRunChatCommand,
  UI_CONTEXT_CHAT_AGENCY_MODES,
  type UiContextChatAgencyMode,
} from '../lib/chatAgency';
import { getChatTextDirection } from '../lib/chatTextDirection';
import {
  deleteUiContextChatSession,
  readUiContextChatSessionStore,
  resolveLatestUiContextChatSession,
  setActiveUiContextChatSessionId,
  upsertUiContextChatSession,
  writeUiContextChatSessionStore,
  type UiContextChatStoredSession,
} from '../lib/uiContextChatSessionStore';
import { showAppFeedbackToast } from './appFeedbackToast';
import { AppButton } from './AppButton';
import { SPLIT_BUTTON_MENU_ITEM_CLASS, SPLIT_BUTTON_MENU_PANEL_CLASS, useSplitButtonMenu } from './AppSplitButton';
import { ChatCodeBlock, type ChatCodeBlockTone } from './ChatCodeBlock';
import { ChatMarkdown } from './ChatMarkdown';
import { ConfirmDialogShell } from './ConfirmDialogShell';
import { DestructiveConfirmBody } from './DestructiveConfirmBody';
import { UiTextareaCore } from './HeroFieldControls';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { UiSegmentedControl } from './UiSegmentedControl';
import { WorkspaceVerticalSplitHandle } from './WorkspaceVerticalSplitHandle';
import { useWorkspaceVerticalSplitPanel } from './useWorkspaceVerticalSplitPanel';
import type { WorkspaceSplitPanelKey } from './workspaceSplitStorage';
import {
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_DELETE_CLASS,
} from './surfaceClasses';

export {
  DEFAULT_CHAT_AGENCY_MODE,
  isUiContextChatAgencyMode,
  persistChatAgencyMode,
  readChatAgencyMode,
  resolveChatAgencyMode,
  shouldAutoRunChatCommand,
  UI_CONTEXT_CHAT_AGENCY_MODES,
  type UiContextChatAgencyMode,
} from '../lib/chatAgency';

const DEFAULT_PANEL_WIDTH = 320;
const MIN_PANEL_WIDTH = 240;
const MAX_PANEL_WIDTH = 560;
const DEFAULT_PROMPT_MIN_HEIGHT_PX = 36;
const DEFAULT_PROMPT_MAX_HEIGHT_PX = 400;
const WELCOME_MESSAGE_ID = 'welcome';
const AUTO_RUN_COMMAND_GAP_MS = 180;
const DEFAULT_AGENTIC_WARNING =
  'Warning: Agentic mode runs every suggested action immediately, including changes. Switch to Ask or Read only to review first.';
const DEFAULT_AGENTIC_TOAST =
  'Agentic mode is on. Suggested write actions will run immediately, without asking first.';

const AGENCY_PICKER_ITEMS = [
  { id: 'ask', label: 'Ask', accessibleLabel: 'Ask — replies in this panel only', icon: HelpCircle },
  { id: 'read-only', label: 'Read only', accessibleLabel: 'Read only — runs read commands automatically', icon: ShieldCheck },
  { id: 'agentic', label: 'Agentic', accessibleLabel: 'Agentic — runs every suggested action automatically', icon: Zap },
] as const;

const wait = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

export type UiContextChatPlacement = 'split' | 'fill';

export type UiContextChatAgencyPickerVariant = 'buttons' | 'dropdown';

export type UiContextChatRole = 'assistant' | 'user';

export type UiContextChatCommandStatus = 'pending' | 'running' | 'ran' | 'failed' | 'skipped';

export type UiContextChatCommand = {
  id: string;
  command: string;
  language: string;
  effect: 'read' | 'write';
  status: UiContextChatCommandStatus;
};

export type UiContextChatMessage = {
  id: string;
  role: UiContextChatRole;
  text: string;
  commands?: UiContextChatCommand[];
};

export type UiContextChatModelOption = {
  id: string;
  name: string;
};

export type UiContextChatHistoryItem = {
  role: UiContextChatRole;
  content: string;
};

export type UiContextChatSendRequest = {
  prompt: string;
  modelId: string;
  history: UiContextChatHistoryItem[];
  agencyMode: UiContextChatAgencyMode;
};

export type UiContextChatSendResult = {
  text: string;
  commands?: UiContextChatCommand[];
};

export type UiContextChatRunCommandRequest = {
  messageId: string;
  command: UiContextChatCommand;
};

export type UiContextChatSubmitPromptRequest = {
  prompt: string;
  modelId: string;
};

export type UiContextChatPanelProps = {
  /**
   * Host layout only — not a catalog option. `split` docks a trailing workspace
   * panel (SQL Console, Image Editor, SSH, File Hub). `fill` occupies the parent
   * (AppEndO header chat). The host decides this when mounting.
   */
  placement?: UiContextChatPlacement;
  welcomeText?: string;
  placeholder: string;
  sendingLabel?: string;
  promptAriaLabel: string;
  sendTitle?: string;
  sendAriaLabel?: string;
  sendButtonClassName?: string;
  models: UiContextChatModelOption[];
  modelId?: string;
  defaultModelId?: string;
  onModelChange?: (modelId: string) => void;
  modelsLoading?: boolean;
  aiEnabled: boolean;
  disabledBanner?: string;
  emptyModelsBanner?: string;
  panelKey?: WorkspaceSplitPanelKey;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  canSendExtra?: boolean;
  allowEmptyPrompt?: boolean;
  sendDisabled?: boolean;
  promptDisabled?: boolean;
  headerSlot?: React.ReactNode;
  headerClassName?: string;
  welcomeWarningText?: string;
  /**
   * Host-allowed agency levels. Omit to hide the picker (AppEndO Ask/Agent/Plan stays host-owned).
   * SQL Console and SSH typically pass all three; Image Editor may omit `read-only`.
   */
  agencyModes?: readonly UiContextChatAgencyMode[];
  agencyMode?: UiContextChatAgencyMode;
  defaultAgencyMode?: UiContextChatAgencyMode;
  onAgencyModeChange?: (mode: UiContextChatAgencyMode) => void;
  showAgencyPicker?: boolean;
  agencyPickerVariant?: UiContextChatAgencyPickerVariant;
  agencyAriaLabel?: string;
  agencyToastText?: string;
  commandRunLabel?: string;
  commandRunningLabel?: string;
  commandRanLabel?: string;
  commandFailedLabel?: string;
  commandPendingHint?: string;
  bodySlot?: React.ReactNode;
  messageListFooter?: React.ReactNode;
  messageListClassName?: string;
  footerAbove?: React.ReactNode;
  footerClassName?: string;
  promptValue?: string;
  onPromptChange?: (value: string) => void;
  promptAbove?: React.ReactNode;
  promptComposerStart?: React.ReactNode;
  promptToolbarStart?: React.ReactNode;
  promptToolbarEnd?: React.ReactNode;
  promptBelow?: React.ReactNode;
  promptRows?: number;
  promptAutoGrow?: boolean;
  promptMinHeightPx?: number;
  promptMaxHeightPx?: number;
  promptClassName?: string;
  promptSurfaceClassName?: string;
  promptFieldClassName?: string;
  onPromptKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPromptPaste?: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  onPromptPointerDown?: (event: React.PointerEvent<HTMLTextAreaElement>) => void;
  showModelPicker?: boolean;
  showSendButton?: boolean;
  showSendingIndicator?: boolean;
  showComposer?: boolean;
  sending?: boolean;
  className?: string;
  frameClassName?: string;
  onSend?: (request: UiContextChatSendRequest) => Promise<UiContextChatSendResult>;
  onSubmitPrompt?: (request: UiContextChatSubmitPromptRequest) => void;
  onRunCommand?: (request: UiContextChatRunCommandRequest) => Promise<void>;
  /** Host editor/source used to render chat code as a changed-line diff. */
  codeDiffBaseline?: string;
  /**
   * Session history + New chat chrome. Default **on** for managed side panels (`onSend`).
   * Host-owned AppEndO fill chats keep history in the host window — leave this off there.
   * Image Editor opts out (`sessionHistory={false}`).
   */
  sessionHistory?: boolean;
  /**
   * Storage scope for session history. Defaults to `panelKey`. Prefer a stable
   * resource key (function id, layout id, data source id) when the host has one.
   */
  sessionHistoryKey?: string;
};

const createMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatSessionHistoryDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toPersistedMessages = (messages: UiContextChatMessage[]): UiContextChatMessage[] => (
  messages.filter((message) => message.id !== WELCOME_MESSAGE_ID)
);

const buildWelcomeMessages = (welcomeText: string): UiContextChatMessage[] => (
  welcomeText.trim()
    ? [{ id: WELCOME_MESSAGE_ID, role: 'assistant', text: welcomeText }]
    : []
);

const ContextChatHistoryPanel: React.FC<{
  items: UiContextChatStoredSession[];
  activeSessionId: string | null;
  filterQuery: string;
  onFilterQueryChange: (value: string) => void;
  onSelectSession: (sessionId: string) => void;
  onRequestDelete: (session: { id: string; title: string }) => void;
  onClose: () => void;
  labels: {
    title: string;
    closeAria: string;
    filterPlaceholder: string;
    filterAria: string;
    empty: string;
    noFilterMatch: string;
    messageCount: (count: number) => string;
    deleteAria: (title: string) => string;
  };
}> = ({
  items,
  activeSessionId,
  filterQuery,
  onFilterQueryChange,
  onSelectSession,
  onRequestDelete,
  onClose,
  labels,
}) => {
  const filteredItems = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((session) => (
      session.title.toLowerCase().includes(query)
      || session.modelId.toLowerCase().includes(query)
    ));
  }, [filterQuery, items]);

  return (
    <aside className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <History className="h-3.5 w-3.5" />
          {labels.title}
        </div>
        <AppButton
          closeIcon
          onClick={onClose}
          aria-label={labels.closeAria}
        />
      </div>

      <div className="shrink-0 border-b border-slate-200 px-3 py-2">
        <UiInput
          size="sm"
          aiAssist={false}
          value={filterQuery}
          onChange={(event) => onFilterQueryChange(event.target.value)}
          placeholder={labels.filterPlaceholder}
          ariaLabel={labels.filterAria}
          className="h-8"
          startContent={<Search className="h-3.5 w-3.5 text-slate-400" />}
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-1 select-text">
        {filteredItems.length === 0 ? (
          <div className="px-3 py-2 text-xs text-slate-500">
            {filterQuery.trim() ? labels.noFilterMatch : labels.empty}
          </div>
        ) : (
          filteredItems.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                className={cn(
                  'group flex items-center gap-0.5 px-1',
                  isActive && 'bg-indigo-50',
                )}
              >
                <button
                  type="button"
                  className={cn(
                    'min-w-0 flex-1 rounded px-2 py-2.5 text-left transition-colors hover:bg-slate-50',
                    isActive && 'text-indigo-700 hover:bg-indigo-50',
                  )}
                  onClick={() => onSelectSession(session.id)}
                >
                  <span className="block w-full text-sm font-medium leading-snug break-words">{session.title}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {formatSessionHistoryDate(session.updatedAt)}
                    {' · '}
                    {labels.messageCount(session.messages.length)}
                    {session.modelId ? ` · ${session.modelId}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  className={cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-7 w-7 shrink-0', ICON_ACTION_DELETE_CLASS)}
                  aria-label={labels.deleteAria(session.title)}
                  onClick={() => onRequestDelete({ id: session.id, title: session.title })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

const commandTone = (status: UiContextChatCommandStatus): ChatCodeBlockTone => {
  if (status === 'pending' || status === 'running') {
    return 'pending';
  }
  if (status === 'ran') {
    return 'ran';
  }
  if (status === 'failed') {
    return 'failed';
  }
  return 'default';
};

const historyContentForMessage = (message: UiContextChatMessage): string => {
  if (!message.commands?.length) {
    return message.text;
  }
  const listed = message.commands.map((command) => `$ ${command.command}`).join('\n');
  return [message.text.trim(), listed].filter(Boolean).join('\n\n');
};

type ContextChatCommandCardProps = {
  command: UiContextChatCommand;
  runLabel: string;
  runningLabel: string;
  ranLabel: string;
  failedLabel: string;
  pendingHint: string;
  onRun?: () => void;
  diffAgainst?: string;
};

const ContextChatCommandCard: React.FC<ContextChatCommandCardProps> = ({
  command,
  runLabel,
  runningLabel,
  ranLabel,
  failedLabel,
  pendingHint,
  onRun,
  diffAgainst,
}) => {
  const showRun = Boolean(onRun) && command.status !== 'running';
  const statusLabel = command.status === 'pending' ? pendingHint : null;

  return (
    <div className="space-y-1">
      <ChatCodeBlock
        code={command.command}
        language={command.language}
        tone={commandTone(command.status)}
        diffAgainst={diffAgainst}
        diffMode="always"
        actions={showRun && onRun ? (
          <div className="flex items-center gap-1.5">
            {command.status === 'ran' ? (
              <span className="px-1 text-[10px] font-semibold text-emerald-700">{ranLabel}</span>
            ) : command.status === 'failed' ? (
              <span className="px-1 text-[10px] font-semibold text-rose-700">{failedLabel}</span>
            ) : null}
            <AppButton
              intent="primary"
              size="sm"
              className="h-6 min-h-0 px-2 text-[10px]"
              onClick={onRun}
            >
              <Play className="h-3 w-3" />
              {runLabel}
            </AppButton>
          </div>
        ) : command.status === 'running' ? (
          <span className="inline-flex items-center gap-1 px-1 text-[10px] font-semibold text-amber-700">
            <Loader2 className="h-3 w-3 animate-spin" />
            {runningLabel}
          </span>
        ) : null}
      />
      {showRun && command.status === 'pending' && statusLabel ? (
        <p className="px-1 text-[10px] text-amber-700">{statusLabel}</p>
      ) : null}
    </div>
  );
};

const ContextChatBubble: React.FC<{
  message: UiContextChatMessage;
  runLabel: string;
  runningLabel: string;
  ranLabel: string;
  failedLabel: string;
  pendingHint: string;
  welcomeWarningText?: string;
  onRunCommand?: (command: UiContextChatCommand) => void;
  codeDiffBaseline?: string;
}> = ({
  message,
  runLabel,
  runningLabel,
  ranLabel,
  failedLabel,
  pendingHint,
  welcomeWarningText,
  onRunCommand,
  codeDiffBaseline,
}) => {
  const direction = useMemo(() => getChatTextDirection(message.text), [message.text]);

  return (
    <div
      dir={direction}
      data-chat-role={message.role}
      className={cn(
        'space-y-2 text-start',
        message.role === 'assistant'
          ? welcomeWarningText
            ? 'w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-slate-700'
            : 'w-full rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700'
          : 'ml-auto w-fit max-w-[85%] rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900',
      )}
    >
      {message.text.trim() ? (
        message.role === 'assistant' ? (
          <ChatMarkdown
            content={message.text}
            dir={direction}
            tone="assistant"
            className="gap-2"
            diffAgainst={codeDiffBaseline}
          />
        ) : (
          <p className="whitespace-pre-wrap">{message.text}</p>
        )
      ) : null}
      {welcomeWarningText ? (
        <p className="font-semibold text-rose-700">{welcomeWarningText}</p>
      ) : null}
      {message.commands?.length ? (
        <div className="space-y-2">
          {message.commands.map((command) => (
            <ContextChatCommandCard
              key={command.id}
              command={command}
              runLabel={runLabel}
              runningLabel={runningLabel}
              ranLabel={ranLabel}
              failedLabel={failedLabel}
              pendingHint={pendingHint}
              onRun={onRunCommand ? () => onRunCommand(command) : undefined}
              diffAgainst={codeDiffBaseline}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

type ContextChatModelDropdownProps = {
  modelId: string;
  models: UiContextChatModelOption[];
  disabled: boolean;
  onChange: (modelId: string) => void;
};

const ContextChatModelDropdown: React.FC<ContextChatModelDropdownProps> = ({
  modelId,
  models,
  disabled,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen);
  const selectedModel = models.find((model) => model.id === modelId);
  const displayLabel = selectedModel?.name ?? (models.length === 0 ? 'No models' : 'Select model');

  return (
    <div ref={menuRef} className="relative min-w-0 shrink-0">
      <button
        type="button"
        disabled={disabled || models.length === 0}
        className="flex h-5 max-w-full min-w-0 items-center gap-1 rounded px-1.5 py-0 text-[11px] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`AI model: ${displayLabel}`}
        title={displayLabel}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="truncate font-medium">{displayLabel}</span>
        <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && models.length > 0 ? (
        <div
          className={cn(SPLIT_BUTTON_MENU_PANEL_CLASS, 'bottom-[calc(100%+4px)] left-0 top-auto max-h-48 min-w-[12rem] overflow-y-auto py-1')}
          role="listbox"
          aria-label="AI model"
        >
          {models.map((model) => {
            const isSelected = model.id === modelId;
            return (
              <button
                key={model.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn(
                  SPLIT_BUTTON_MENU_ITEM_CLASS,
                  isSelected && 'bg-indigo-50 text-indigo-700',
                )}
                onClick={() => {
                  onChange(model.id);
                  setIsOpen(false);
                }}
              >
                <span className="truncate font-medium">{model.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

type ContextChatAgencyDropdownProps = {
  mode: UiContextChatAgencyMode;
  modes: readonly UiContextChatAgencyMode[];
  ariaLabel: string;
  disabled?: boolean;
  onChange: (mode: UiContextChatAgencyMode) => void;
};

const ContextChatAgencyDropdown: React.FC<ContextChatAgencyDropdownProps> = ({
  mode,
  modes,
  ariaLabel,
  disabled = false,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen);
  const items = AGENCY_PICKER_ITEMS.filter((item) => modes.includes(item.id));
  const active = items.find((item) => item.id === mode) ?? items[0];
  const ActiveIcon = active?.icon ?? HelpCircle;

  return (
    <div ref={menuRef} className="relative min-w-0 shrink-0">
      <button
        type="button"
        disabled={disabled || items.length === 0}
        className={cn(
          'flex h-5 max-w-full min-w-0 items-center gap-1 rounded px-1.5 py-0 text-[11px] transition-colors',
          'text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50',
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${ariaLabel}: ${active?.label ?? 'Ask'}`}
        title={active?.accessibleLabel ?? active?.label}
        onClick={() => setIsOpen((open) => !open)}
      >
        <ActiveIcon className="h-3 w-3 shrink-0" />
        <span className="truncate font-medium">{active?.label ?? 'Ask'}</span>
        <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && items.length > 0 ? (
        <div
          className={cn(SPLIT_BUTTON_MENU_PANEL_CLASS, 'bottom-[calc(100%+4px)] left-0 top-auto max-h-48 min-w-[10rem] overflow-y-auto py-1')}
          role="listbox"
          aria-label={ariaLabel}
        >
          {items.map((item) => {
            const ItemIcon = item.icon;
            const isSelected = item.id === mode;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn(
                  SPLIT_BUTTON_MENU_ITEM_CLASS,
                  'gap-2',
                  isSelected && 'bg-rose-50 text-rose-700',
                )}
                onClick={() => {
                  onChange(item.id);
                  setIsOpen(false);
                }}
              >
                <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

type ChatPanelChromeProps = UiContextChatPanelProps & {
  frameRef?: React.Ref<HTMLElement>;
};

const ChatPanelChrome: React.FC<ChatPanelChromeProps> = ({
  welcomeText = '',
  placeholder,
  sendingLabel = 'Working…',
  promptAriaLabel,
  sendTitle = 'Send prompt',
  sendAriaLabel,
  sendButtonClassName,
  models,
  modelId: modelIdProp,
  defaultModelId,
  onModelChange,
  modelsLoading = false,
  aiEnabled,
  disabledBanner = 'AI is disabled in platform settings.',
  emptyModelsBanner = 'Enable a compatible AI model in AI settings.',
  canSendExtra = true,
  allowEmptyPrompt = false,
  sendDisabled = false,
  promptDisabled = false,
  headerSlot,
  headerClassName,
  welcomeWarningText,
  agencyModes: agencyModesProp,
  agencyMode: agencyModeProp,
  defaultAgencyMode = DEFAULT_CHAT_AGENCY_MODE,
  onAgencyModeChange,
  showAgencyPicker,
  agencyPickerVariant = 'buttons',
  agencyAriaLabel = 'Chat agency',
  agencyToastText,
  commandRunLabel = 'Run',
  commandRunningLabel = 'Running…',
  commandRanLabel = 'Ran',
  commandFailedLabel = 'Failed',
  commandPendingHint = 'Review this command, then run it.',
  bodySlot,
  messageListFooter,
  messageListClassName,
  footerAbove,
  footerClassName,
  promptValue,
  onPromptChange,
  promptAbove,
  promptComposerStart,
  promptToolbarStart,
  promptToolbarEnd,
  promptBelow,
  promptRows = 3,
  promptAutoGrow = false,
  promptMinHeightPx = DEFAULT_PROMPT_MIN_HEIGHT_PX,
  promptMaxHeightPx = DEFAULT_PROMPT_MAX_HEIGHT_PX,
  promptClassName,
  promptSurfaceClassName,
  promptFieldClassName,
  onPromptKeyDown,
  onPromptPaste,
  onPromptPointerDown,
  showModelPicker = true,
  showSendButton = true,
  showSendingIndicator = true,
  showComposer = true,
  sending,
  className,
  frameClassName,
  frameRef,
  onSend,
  onSubmitPrompt,
  onRunCommand,
  codeDiffBaseline,
  sessionHistory: sessionHistoryProp,
  sessionHistoryKey,
  panelKey,
}) => {
  const hostOwnsTurns = Boolean(onSubmitPrompt);
  const hostOwnsBody = bodySlot !== undefined;
  const isPromptControlled = promptValue !== undefined;
  const isModelControlled = modelIdProp !== undefined;
  const isAgencyControlled = agencyModeProp !== undefined;
  const resolvedAgencyModes = agencyModesProp && agencyModesProp.length > 0
    ? agencyModesProp
    : UI_CONTEXT_CHAT_AGENCY_MODES;
  const [internalAgencyMode, setInternalAgencyMode] = useState<UiContextChatAgencyMode>(
    () => resolveChatAgencyMode(defaultAgencyMode, resolvedAgencyModes),
  );
  const activeAgencyMode = resolveChatAgencyMode(
    isAgencyControlled ? agencyModeProp : internalAgencyMode,
    resolvedAgencyModes,
  );
  const agencyPickerVisible = showAgencyPicker ?? Boolean(agencyModesProp && resolvedAgencyModes.length > 1);
  const showHeaderAgency = agencyPickerVisible && agencyPickerVariant !== 'dropdown';
  const showPromptAgency = agencyPickerVisible && agencyPickerVariant === 'dropdown';
  const isAgentic = activeAgencyMode === 'agentic';
  const resolvedWelcomeWarning = welcomeWarningText !== undefined
    ? welcomeWarningText
    : (isAgentic ? DEFAULT_AGENTIC_WARNING : undefined);
  const cultureT = useOptionalCultureT();
  const { currentUser } = useAuth();
  const currentUserId = currentUser?.id ?? null;
  const resolvedHistoryKey = (sessionHistoryKey ?? panelKey ?? '').trim();
  const sessionHistoryEnabled = (
    sessionHistoryProp ?? true
  ) && !hostOwnsTurns && !hostOwnsBody && Boolean(resolvedHistoryKey);

  const historyLabels = useMemo(() => ({
    newChat: cultureT?.('appendoo.panel.newChat') ?? 'New chat',
    chatHistory: cultureT?.('appendoo.panel.chatHistory') ?? 'Chat history',
    chatTitle: cultureT?.('appendoo.panel.chatTitle') ?? 'Chat',
    title: cultureT?.('appendoo.chat.history.title') ?? 'Chat history',
    closeAria: cultureT?.('appendoo.chat.history.closeAria') ?? 'Close chat history',
    filterPlaceholder: cultureT?.('appendoo.chat.history.filterPlaceholder') ?? 'Filter chats...',
    filterAria: cultureT?.('appendoo.chat.history.filterAria') ?? 'Filter chat history',
    empty: cultureT?.('appendoo.chat.history.empty') ?? 'No saved chats yet.',
    noFilterMatch: cultureT?.('appendoo.chat.history.noFilterMatch') ?? 'No chats match your filter.',
    messageCount: (count: number) => (
      count === 1
        ? (cultureT?.('appendoo.chat.history.messageCount') ?? '{count} message').replace('{count}', String(count))
        : (cultureT?.('appendoo.chat.history.messageCountPlural') ?? '{count} messages').replace('{count}', String(count))
    ),
    deleteAria: (title: string) => (
      (cultureT?.('appendoo.chat.history.deleteAria') ?? 'Delete {title}').replace('{title}', title)
    ),
    deleteQuestion: cultureT?.('appendoo.chat.delete.question')
      ?? 'Are you sure you want to remove this chat from your history?',
    deleteConfirm: cultureT?.('actions.delete') ?? 'Delete',
    cancel: cultureT?.('actions.cancel') ?? 'Cancel',
  }), [cultureT]);

  const handleAgencyModeChange = (key: string) => {
    const next = resolveChatAgencyMode(key, resolvedAgencyModes);
    if (!isAgencyControlled) {
      setInternalAgencyMode(next);
    }
    onAgencyModeChange?.(next);
    if (next === 'agentic' && agencyToastText !== '') {
      showAppFeedbackToast(agencyToastText ?? DEFAULT_AGENTIC_TOAST, { type: 'warning', durationMs: 6500 });
    }
  };

  const resolvedDefaultModelId = useMemo(() => {
    if (defaultModelId && models.some((model) => model.id === defaultModelId)) {
      return defaultModelId;
    }
    return models[0]?.id ?? '';
  }, [defaultModelId, models]);
  const [internalModelId, setInternalModelId] = useState('');
  const [internalPrompt, setInternalPrompt] = useState('');
  const [messages, setMessages] = useState<UiContextChatMessage[]>(() => buildWelcomeMessages(welcomeText));
  const [internalSending, setInternalSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState(historyLabels.chatTitle);
  const [historySessions, setHistorySessions] = useState<UiContextChatStoredSession[]>([]);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [historyFilterQuery, setHistoryFilterQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const promptFieldRef = useRef<HTMLDivElement>(null);
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;
  const onSubmitPromptRef = useRef(onSubmitPrompt);
  onSubmitPromptRef.current = onSubmitPrompt;
  const onRunCommandRef = useRef(onRunCommand);
  onRunCommandRef.current = onRunCommand;
  const activeSessionIdRef = useRef<string | null>(null);
  const skipNextPersistRef = useRef(false);
  const hasRestoredSessionRef = useRef(false);

  const activeModelId = isModelControlled ? modelIdProp : internalModelId;
  const prompt = isPromptControlled ? promptValue : internalPrompt;
  const isSending = sending ?? internalSending;

  const setActiveModelId = useCallback((nextModelId: string) => {
    if (isModelControlled) {
      onModelChange?.(nextModelId);
      return;
    }
    setInternalModelId(nextModelId);
  }, [isModelControlled, onModelChange]);

  const setPrompt = useCallback((nextPrompt: string) => {
    if (isPromptControlled) {
      onPromptChange?.(nextPrompt);
      return;
    }
    setInternalPrompt(nextPrompt);
  }, [isPromptControlled, onPromptChange]);

  useEffect(() => {
    if (isModelControlled) {
      return;
    }
    if (!resolvedDefaultModelId) {
      return;
    }
    if (!internalModelId || !models.some((model) => model.id === internalModelId)) {
      setInternalModelId(resolvedDefaultModelId);
    }
  }, [internalModelId, isModelControlled, models, resolvedDefaultModelId]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    hasRestoredSessionRef.current = false;
  }, [resolvedHistoryKey, currentUserId]);

  useEffect(() => {
    if (!sessionHistoryEnabled || hasRestoredSessionRef.current) {
      return;
    }
    hasRestoredSessionRef.current = true;
    const store = readUiContextChatSessionStore(resolvedHistoryKey, currentUserId);
    setHistorySessions(store.sessions);
    const latest = resolveLatestUiContextChatSession(store);
    if (!latest) {
      skipNextPersistRef.current = true;
      setActiveSessionId(null);
      setChatTitle(historyLabels.chatTitle);
      setMessages(buildWelcomeMessages(welcomeText));
      return;
    }
    skipNextPersistRef.current = true;
    setActiveSessionId(latest.id);
    setChatTitle(latest.title);
    setMessages(latest.messages.length > 0 ? latest.messages : buildWelcomeMessages(welcomeText));
    if (latest.modelId && !isModelControlled) {
      setInternalModelId(latest.modelId);
    }
  }, [
    currentUserId,
    historyLabels.chatTitle,
    isModelControlled,
    resolvedHistoryKey,
    sessionHistoryEnabled,
    welcomeText,
  ]);

  useEffect(() => {
    if (!sessionHistoryEnabled) {
      return;
    }
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    const persisted = toPersistedMessages(messages);
    if (persisted.length === 0) {
      return;
    }
    const store = readUiContextChatSessionStore(resolvedHistoryKey, currentUserId);
    const next = upsertUiContextChatSession(store, {
      sessionId: activeSessionIdRef.current,
      modelId: activeModelId,
      messages: persisted,
    });
    writeUiContextChatSessionStore(resolvedHistoryKey, currentUserId, next.store);
    setActiveSessionId(next.session.id);
    setChatTitle(next.session.title);
    setHistorySessions(next.store.sessions);
  }, [activeModelId, currentUserId, messages, resolvedHistoryKey, sessionHistoryEnabled]);

  const startNewChat = useCallback(() => {
    skipNextPersistRef.current = true;
    setMessages(buildWelcomeMessages(welcomeText));
    setPrompt('');
    setError(null);
    setActiveSessionId(null);
    activeSessionIdRef.current = null;
    setChatTitle(historyLabels.chatTitle);
    setIsHistoryPanelOpen(false);
    setHistoryFilterQuery('');
    setDeleteTarget(null);
    if (sessionHistoryEnabled) {
      const store = readUiContextChatSessionStore(resolvedHistoryKey, currentUserId);
      const next = setActiveUiContextChatSessionId(store, null);
      writeUiContextChatSessionStore(resolvedHistoryKey, currentUserId, next);
      setHistorySessions(next.sessions);
    }
  }, [
    currentUserId,
    historyLabels.chatTitle,
    resolvedHistoryKey,
    sessionHistoryEnabled,
    setPrompt,
    welcomeText,
  ]);

  const loadChatSession = useCallback((sessionId: string) => {
    const store = readUiContextChatSessionStore(resolvedHistoryKey, currentUserId);
    const session = store.sessions.find((item) => item.id === sessionId);
    if (!session) {
      return;
    }
    skipNextPersistRef.current = true;
    const next = setActiveUiContextChatSessionId(store, session.id);
    writeUiContextChatSessionStore(resolvedHistoryKey, currentUserId, next);
    setHistorySessions(next.sessions);
    setActiveSessionId(session.id);
    setChatTitle(session.title);
    setMessages(session.messages.length > 0 ? session.messages : buildWelcomeMessages(welcomeText));
    if (session.modelId && !isModelControlled) {
      setInternalModelId(session.modelId);
    }
    setIsHistoryPanelOpen(false);
    setError(null);
  }, [currentUserId, isModelControlled, resolvedHistoryKey, welcomeText]);

  const confirmDeleteChatSession = useCallback(() => {
    if (!deleteTarget) {
      return;
    }
    const store = readUiContextChatSessionStore(resolvedHistoryKey, currentUserId);
    const next = deleteUiContextChatSession(store, deleteTarget.id);
    writeUiContextChatSessionStore(resolvedHistoryKey, currentUserId, next);
    setHistorySessions(next.sessions);
    if (activeSessionIdRef.current === deleteTarget.id) {
      skipNextPersistRef.current = true;
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
      setMessages(buildWelcomeMessages(welcomeText));
      setChatTitle(historyLabels.chatTitle);
    }
    setDeleteTarget(null);
  }, [currentUserId, deleteTarget, historyLabels.chatTitle, resolvedHistoryKey, welcomeText]);

  const syncPromptHeight = useCallback(() => {
    if (!promptAutoGrow) {
      return;
    }
    const textarea = promptFieldRef.current?.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) {
      return;
    }
    textarea.style.height = 'auto';
    const nextHeight = Math.max(
      promptMinHeightPx,
      Math.min(textarea.scrollHeight, promptMaxHeightPx),
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > promptMaxHeightPx ? 'auto' : 'hidden';
  }, [promptAutoGrow, promptMaxHeightPx, promptMinHeightPx]);

  useLayoutEffect(() => {
    syncPromptHeight();
  }, [prompt, promptAutoGrow, syncPromptHeight]);

  const modelsReady = !modelsLoading;
  const promptDirection = useMemo(() => getChatTextDirection(prompt), [prompt]);
  const canSend = hostOwnsTurns
    ? Boolean(!sendDisabled && !isSending && aiEnabled && models.length > 0)
    : Boolean(
      aiEnabled
      && activeModelId
      && (prompt.trim() || allowEmptyPrompt)
      && !isSending
      && models.length > 0
      && canSendExtra
      && !sendDisabled,
    );

  const updateCommandStatus = (
    messageId: string,
    commandId: string,
    status: UiContextChatCommandStatus,
  ) => {
    setMessages((current) => current.map((message) => {
      if (message.id !== messageId || !message.commands) {
        return message;
      }
      return {
        ...message,
        commands: message.commands.map((command) => (
          command.id === commandId ? { ...command, status } : command
        )),
      };
    }));
  };

  const handleRunCommand = async (messageId: string, command: UiContextChatCommand) => {
    if (!onRunCommandRef.current || command.status === 'running') {
      return;
    }
    updateCommandStatus(messageId, command.id, 'running');
    try {
      await onRunCommandRef.current({ messageId, command });
      updateCommandStatus(messageId, command.id, 'ran');
    } catch {
      updateCommandStatus(messageId, command.id, 'failed');
    }
  };

  const handleSend = async () => {
    const trimmedPrompt = prompt.trim();
    if (isSending) {
      return;
    }

    if (hostOwnsTurns) {
      if (sendDisabled) {
        return;
      }
      onSubmitPromptRef.current?.({ prompt: trimmedPrompt, modelId: activeModelId });
      return;
    }

    if ((!trimmedPrompt && !allowEmptyPrompt) || !activeModelId || !onSendRef.current) {
      return;
    }

    const userMessage: UiContextChatMessage = {
      id: createMessageId(),
      role: 'user',
      text: trimmedPrompt,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setPrompt('');
    setError(null);
    setInternalSending(true);

    const history = nextMessages
      .filter((message) => message.id !== WELCOME_MESSAGE_ID)
      .slice(0, -1)
      .map((message) => ({ role: message.role, content: historyContentForMessage(message) }));

    try {
      const result = await onSendRef.current({
        prompt: trimmedPrompt,
        modelId: activeModelId,
        history,
        agencyMode: activeAgencyMode,
      });
      const reply = result.text.trim();
      const commands = Array.isArray(result.commands) ? result.commands : [];
      if (reply || commands.length) {
        const assistantId = createMessageId();
        setMessages((current) => [
          ...current,
          {
            id: assistantId,
            role: 'assistant',
            text: reply,
            commands,
          },
        ]);
        for (const command of commands) {
          if (command.status === 'pending' && shouldAutoRunChatCommand(command.effect, activeAgencyMode)) {
            await handleRunCommand(assistantId, command);
            await wait(AUTO_RUN_COMMAND_GAP_MS);
          }
        }
      }
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'AI request failed.';
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          text: `Error: ${message}`,
        },
      ]);
    } finally {
      setInternalSending(false);
    }
  };

  const handleComposerSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleSend();
  };

  const handlePromptKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onPromptKeyDown?.(event);
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const isPromptFieldDisabled = promptDisabled || !aiEnabled || isSending || models.length === 0;

  const composer = (
    <form onSubmit={handleComposerSubmit} className="flex flex-col">
      {promptAbove}
      <div className={cn('flex flex-col bg-white', promptClassName)}>
        {promptComposerStart}
        <div
          ref={promptFieldRef}
          className={promptFieldClassName}
          onPaste={onPromptPaste}
        >
          <UiTextareaCore
            size="sm"
            rows={promptAutoGrow ? 1 : promptRows}
            value={prompt}
            disabled={isPromptFieldDisabled}
            placeholder={placeholder}
            ariaLabel={promptAriaLabel}
            dir={promptDirection}
            className={cn(
              'w-full resize-none text-start !rounded-none !border-0 !shadow-none',
              promptAutoGrow && 'min-h-[2.25rem] max-h-[400px] overflow-y-hidden',
            )}
            surfaceClassName={promptSurfaceClassName ?? '!bg-white hover:!bg-white data-[hover=true]:!bg-white'}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handlePromptKeyDown}
            onPointerDown={onPromptPointerDown}
          />
        </div>
        <div className="-mt-px flex h-5 items-center justify-between gap-1 bg-white px-[3px] pb-[3px]">
          <div className="flex min-h-0 min-w-0 flex-1 items-center">
            {promptToolbarStart}
            {showPromptAgency ? (
              <ContextChatAgencyDropdown
                mode={activeAgencyMode}
                modes={resolvedAgencyModes}
                ariaLabel={agencyAriaLabel}
                disabled={!aiEnabled || isSending}
                onChange={handleAgencyModeChange}
              />
            ) : null}
            {showModelPicker ? (
              <ContextChatModelDropdown
                modelId={activeModelId}
                models={models}
                disabled={!aiEnabled || isSending}
                onChange={setActiveModelId}
              />
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {promptToolbarEnd}
            {showSendButton ? (
              <AppButton
                type="submit"
                intent="primary"
                size="icon-sm"
                className={cn('h-5 w-5 min-h-0 min-w-0', sendButtonClassName)}
                disabled={!canSend}
                title={sendTitle}
                aria-label={sendAriaLabel ?? sendTitle}
              >
                {isSending && !hostOwnsTurns ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              </AppButton>
            ) : null}
          </div>
        </div>
      </div>
      {promptBelow}
    </form>
  );

  return (
    <aside
      ref={frameRef as React.Ref<HTMLElement>}
      data-ui-ai-chat-panel=""
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col bg-white', frameClassName, className)}
    >
      {sessionHistoryEnabled ? (
        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50 px-2">
          <div className="min-w-0 flex-1 truncate px-0.5 text-[11px] font-medium text-slate-700" title={chatTitle}>
            {chatTitle}
          </div>
          <AppButton
            closeIcon
            aria-label={historyLabels.newChat}
            title={historyLabels.newChat}
            onClick={startNewChat}
            className="h-5 w-5 shrink-0"
          >
            <MessageSquarePlus className="h-3 w-3" />
          </AppButton>
          <AppButton
            closeIcon
            aria-label={historyLabels.chatHistory}
            aria-pressed={isHistoryPanelOpen}
            title={historyLabels.chatHistory}
            onClick={() => setIsHistoryPanelOpen((open) => !open)}
            className={cn(
              'h-5 w-5 shrink-0',
              isHistoryPanelOpen && 'bg-sky-50 text-sky-500 hover:bg-sky-50 hover:text-sky-600',
            )}
          >
            <History className="h-3 w-3" />
          </AppButton>
        </div>
      ) : null}

      {showHeaderAgency || headerSlot ? (
        <div className={cn(
          'border-b',
          headerClassName ? undefined : 'px-3 py-2',
          showHeaderAgency && (isAgentic || (resolvedWelcomeWarning && !headerClassName))
            ? 'border-amber-200 bg-amber-50'
            : 'border-slate-200',
          showHeaderAgency && headerSlot ? 'space-y-2' : undefined,
          headerClassName,
        )}>
          {showHeaderAgency ? (
            <UiSegmentedControl
              ariaLabel={agencyAriaLabel}
              visualMode="icon-label"
              width="equal"
              className={cn(
                'w-full',
                isAgentic && 'border-amber-300 bg-amber-100 [&_[data-selected]]:bg-amber-50 [&_[data-selected]]:text-amber-800 [&_[data-selected]]:shadow-none',
              )}
              selectedKey={activeAgencyMode}
              items={AGENCY_PICKER_ITEMS.filter((item) => resolvedAgencyModes.includes(item.id))}
              onSelectionChange={handleAgencyModeChange}
            />
          ) : null}
          {headerSlot}
        </div>
      ) : null}
      {!aiEnabled && modelsReady && disabledBanner ? (
        <p className="border-b border-slate-200 px-3 py-2 text-[10px] text-rose-600">{disabledBanner}</p>
      ) : null}
      {aiEnabled && modelsReady && models.length === 0 && emptyModelsBanner ? (
        <p className="border-b border-slate-200 px-3 py-2 text-[10px] text-amber-700">{emptyModelsBanner}</p>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {sessionHistoryEnabled && isHistoryPanelOpen ? (
          <ContextChatHistoryPanel
            items={historySessions}
            activeSessionId={activeSessionId}
            filterQuery={historyFilterQuery}
            onFilterQueryChange={setHistoryFilterQuery}
            onSelectSession={loadChatSession}
            onRequestDelete={setDeleteTarget}
            onClose={() => setIsHistoryPanelOpen(false)}
            labels={historyLabels}
          />
        ) : hostOwnsBody ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {bodySlot}
          </div>
        ) : (
          <div className={cn(
            'min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-0 pt-3',
            messageListClassName,
          )}>
            {messages.map((message) => (
              <ContextChatBubble
                key={message.id}
                message={message}
                runLabel={commandRunLabel}
                runningLabel={commandRunningLabel}
                ranLabel={commandRanLabel}
                failedLabel={commandFailedLabel}
                pendingHint={commandPendingHint}
                welcomeWarningText={message.id === WELCOME_MESSAGE_ID ? resolvedWelcomeWarning : undefined}
                onRunCommand={onRunCommand ? (command) => {
                  void handleRunCommand(message.id, command);
                } : undefined}
                codeDiffBaseline={codeDiffBaseline}
              />
            ))}
            {showSendingIndicator && isSending ? (
              <div className="flex w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {sendingLabel}
              </div>
            ) : null}
            {messageListFooter}
          </div>
        )}
        {!(sessionHistoryEnabled && isHistoryPanelOpen) && hostOwnsBody && showSendingIndicator && isSending ? (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {sendingLabel}
          </div>
        ) : null}
        {!(sessionHistoryEnabled && isHistoryPanelOpen) && hostOwnsBody ? messageListFooter : null}

        {showComposer && !(sessionHistoryEnabled && isHistoryPanelOpen) ? (
        <div className={cn('border-t border-slate-200 bg-white', footerClassName)}>
          {footerAbove}
          {error ? <p className="bg-white px-[3px] py-[3px] text-[10px] text-rose-600">{error}</p> : null}
          {composer}
        </div>
        ) : null}
      </div>

      {deleteTarget ? (
        <ConfirmDialogShell
          title={historyLabels.chatHistory}
          onClose={() => setDeleteTarget(null)}
          onBackdropClick={() => setDeleteTarget(null)}
          footer={(
            <>
              <AppButton intent="cancel" onClick={() => setDeleteTarget(null)}>
                {historyLabels.cancel}
              </AppButton>
              <AppButton intent="destructive" onClick={confirmDeleteChatSession}>
                {historyLabels.deleteConfirm}
              </AppButton>
            </>
          )}
        >
          <DestructiveConfirmBody question={historyLabels.deleteQuestion} />
        </ConfirmDialogShell>
      ) : null}
    </aside>
  );
};

const ChatPanelSplit: React.FC<UiContextChatPanelProps> = (props) => {
  const {
    panelKey,
    defaultWidth = DEFAULT_PANEL_WIDTH,
    minWidth = MIN_PANEL_WIDTH,
    maxWidth = MAX_PANEL_WIDTH,
  } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const panelSplit = useWorkspaceVerticalSplitPanel({
    panelKey: panelKey as WorkspaceSplitPanelKey,
    defaultSize: defaultWidth,
    minSize: minWidth,
    maxSize: maxWidth,
    measure: 'trailing',
    containerRef: panelRef,
    side: 'start',
    collapsible: false,
    displayClassName: 'block',
  });

  return (
    <div
      ref={panelRef}
      className="flex h-full min-h-0 shrink-0 items-stretch"
      style={{ width: panelSplit.size }}
    >
      <WorkspaceVerticalSplitHandle {...panelSplit.splitHandleProps} />
      <ChatPanelChrome
        {...props}
        frameClassName={cn('border-l border-slate-200', props.frameClassName)}
      />
    </div>
  );
};

export const UiContextChatPanel: React.FC<UiContextChatPanelProps> = (props) => (
  props.placement === 'fill'
    ? <ChatPanelChrome {...props} />
    : <ChatPanelSplit {...props} />
);
