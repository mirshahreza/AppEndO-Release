import React, { memo, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  APPENDOO_DOCK_WIDTH_PX,
  clearAppEndooDockDocumentInsets,
  clampAppEndooDockWidth,
  persistAppEndooDockWidth,
  readStoredAppEndooDockWidth,
  syncAppEndooDockDocumentInsets,
  type AppEndooDockSide,
} from '../shared/ui/appendooDock';
import {
  persistAppEndooUiState,
  resolveInitialAppEndooUiState,
} from '../shared/ui/appendooPreferences';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  FileText,
  GripHorizontal,
  History,
  Image,
  Loader2,
  Maximize2,
  PanelLeft,
  PanelRight,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  Minimize2,
  Pencil,
  Plus,
  ScrollText,
  Search,
  Settings,
  Blocks,
  Code2,
  LayoutDashboard,
  Network,
  NotebookPen,
  Trash2,
  Undo2,
  Volume2,
  Wrench,
  X,
  AlertTriangle,
} from 'lucide-react';
import { UiCheckbox } from '../components/ui/HeroFieldControls';
import { UiOptionCardGroup } from '../shared/ui';
import { useCurrentUserDisplay } from '../hooks/useCurrentUserDisplay';
import { apiFetch } from '../shared/api/client';
import { useAvailableAiModelsQuery, useAiSettingsQuery } from '../shared/api/queries/aiModels';
import { useAiMcpAccessMeQuery } from '../shared/api/queries/aiMcpAccess';
import {
  fetchAiChatSession,
  useAiChatSessionsQuery,
  useCreateAiChatSessionMutation,
  useDeleteAiChatSessionMutation,
  useUpdateAiChatSessionMutation,
} from '../shared/api/queries/aiChatHistory';
import { AgentCapabilityDropdown } from './ai/AgentCapabilityDropdown';
import { AiPanelMessageList } from './ai/AiPanelMessageList';
import { ChatModeDropdown, getPanelChatModeIcon, useAiChatStream, type PanelChatMode } from '../features/ai-chat';
import { DEFAULT_AGENT_CAPABILITY_SCOPE } from '../shared/api/contracts/ai/capabilityPacks';
import type { AiAgentCapabilityScope } from '../shared/api/contracts/ai/capabilityPacks';
import { generateChatTitleFromMessage } from '../shared/api/contracts/ai/chatHistoryValidators';
import type { AiChatSessionSummary } from '../shared/api/contracts/ai/chatHistoryTypes';
import { buildDesignerHandoffUrl } from '../features/component-designer/lib/designerDraftPath';
import { resolveStudioMountPathPrefix } from '../shared/lib/designerComponentPath';
import {
  DEFAULT_CHAT_CONTEXT_RESOURCE_IDS,
  buildEffectivePageContext,
  resolveAgentRunPageContext,
  getAvailableChatContextResources,
  getChatContextResourceOption,
  isChatContextResourceAvailable,
  isVibeStudioPageContext,
  resolveChatContextResources,
  resolveDefaultAgentContextResourceIds,
  resolveDefaultChatMode,
  type AiChatContextResourceId,
  type ChatContextResourceEnv,
} from '../shared/api/contracts/ai/chatContextResources';
import { enrichAskModeAssistantWithAgentSuggestion } from '../shared/lib/agentModeSwitchSuggestion';
import {
  archiveAgentThinkingIntoSteps,
  preserveActivityStepsOnConnectionFailure,
} from '../shared/lib/appendoo/preserveActivityOnConnectionFailure';
import { classifyConnectionError, type ClassifiedConnectionError } from '../shared/lib/appendoo/classifyConnectionError';
import {
  ensureStoredMessagesHaveTokenUsage,
  estimateAssistantTurnTokenUsage,
  estimateChatMessagesTokens,
  estimateStoredMessageTokens,
  estimateTextTokens,
  formatApproxTokensK,
} from '../shared/lib/appendoo/chatTurnTokenUsage';
import type { AiChatMessageTokenUsage } from '../shared/api/contracts/ai/chatHistoryTypes';
import { ConnectionErrorBanner } from '../features/appendoo/components/ConnectionErrorBanner';
import {
  detectProposalConfirmIntent,
  findPendingVibeProposal,
  proposalHasValidationErrors,
} from '../shared/lib/vibeProposalUi';
import { AI_CAPABILITY_GROUPS, getAiProviderLabel, isAiModelEmbeddingOnly, resolveModelContextWindowTokens } from '../shared/api/contracts/ai/constants';
import { AiCapabilityGroupSeparator, renderAiModelEmbeddingOnlyLabel } from '../shared/lib/aiModelCapabilityDisplay';
import type { AiAvailableModel, AiModelCapabilities } from '../shared/api/contracts/ai/types';
import { AppButton } from '../shared/ui/AppButton';
import { useCultureT, useOptionalCulture } from '../core/culture/CultureContext';
import type { TranslationFn } from '../core/culture/TranslationRuntime';
import { lookupEmbeddedEnglish } from '../core/culture/embeddedTranslationBundles';
import { SPLIT_BUTTON_MENU_ITEM_CLASS, SPLIT_BUTTON_MENU_PANEL_CLASS, SPLIT_BUTTON_DROP_UP_MENU_FIXED_CLASS, useFixedDropDownMenuStyle, useFixedDropUpMenuStyle, useSplitButtonMenu } from '../shared/ui/AppSplitButton';
import { ConfirmDialogShell, CreateEditModalShell, DestructiveConfirmBody, UiContextChatPanel, UiInput } from '../shared/ui';
import {
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_CONFIRM_CLASS,
  ICON_ACTION_CANCEL_CLASS,
  ICON_ACTION_DELETE_CLASS,
} from '../shared/ui/surfaceClasses';
import { ChatMessageAttachments } from '../shared/ui/ChatMessageAttachments';
import { ChatMessageContent } from '../shared/ui/ChatMessageContent';
import { collectChatImageGallery } from '../shared/ui/chatImageGallery';
import type { ChatImageGalleryItem } from '../shared/ui/ChatImageLightbox';
import type { AgentMode, ToolResult, ChangeSet, ProposalViolation, AgentPlanPayload, PromptTaskDecompositionPayload, DesignerHandoffPayload, PostApplyVerificationResult, AppliedChangeItem, AgentStreamRequestRoutingEvent, AgentStreamEngineeringPipelineEvent, AgentPlanActMode, AgentTodoListItem, FileDiffZone } from '../shared/api/contracts/ai/agentTypes';
import { formatAgentActivityArgsOneLiner } from '../shared/lib/appendoo/agentActivityLabels';
import { computeLineDiffZones, revertDiffZone, type DiffZone } from '../shared/lib/appendoo/diffZones';
import {
  appendImmediateUserEcho,
  dequeueSubmitTurn,
  enqueueSubmitTurn,
  resolveChatSubmitDispatch,
} from '../shared/lib/appendoo/chatSubmitQueue';
import {
  beginPerceivedLatencyTurn,
  completePerceivedLatencyTurn,
  type PerceivedActivityKind,
} from '../shared/lib/appendoo/chatPerceivedLatencyTelemetry';
import { EngineeringPipelineStatus } from '../features/appendoo/components/EngineeringPipelineStatus';
import { ContextUnderstandingPanel } from '../features/appendoo/components/ContextUnderstandingPanel';
import { ChangeGraphPanel } from '../features/appendoo/components/ChangeGraphPanel';
import { SemanticPlanPanel } from '../features/appendoo/components/SemanticPlanPanel';
import { SemanticPlanApprovalBar } from '../features/appendoo/components/SemanticPlanApprovalBar';
import { EngineeringVerificationPanel } from '../features/appendoo/components/EngineeringVerificationPanel';
import { EngineeringWorkspacePanel } from '../features/appendoo/components/EngineeringWorkspacePanel';
import { AgentActivityFeed } from '../features/appendoo/components/AgentActivityFeed';
import { AgentTodoListWidget } from '../features/appendoo/components/AgentTodoListWidget';
import {
  buildEngineeringPipelineViewModel,
  toEngineeringPipelineSnapshot,
  type EngineeringPipelineViewModel,
} from '../shared/api/contracts/appendoo/engineeringPipeline.types';
import {
  resolvePanelApplyBlockedReason,
  shouldBlockPanelAutoApply,
  V1_DIRECT_WRITE_BLOCKED_MESSAGE,
} from '../shared/lib/appendoo/appendooCutover';
import { VibeProposalPanel } from './ai/VibeProposalPanel';
import { VibeAppliedChangesFooter } from './ai/VibeAppliedChangesFooter';
import {
  cloneAgentMessageAttachments,
  resolveChatMessageDisplayContent,
  sanitizeUserMessageForUi,
} from '../shared/api/contracts/ai/agentMessageAttachments';
import { streamAiAgentRun } from '../shared/lib/aiAgentStream';
import {
  resolvePreferredAgentModelId,
  shouldAutoUpgradeAgentModel,
} from '../shared/lib/resolvePreferredAgentModel';
import { formatChangeSetPreview } from '../shared/lib/changeSetPreview';
import { cn } from '../lib/utils';
import { detectInformationalQuery } from '../shared/lib/detectCodingIntent';
import { useViewportTier } from '../shared/lib/useViewportTier';
import { isCompactChromeTier } from '../shared/lib/viewportTokens';
import { motion, AnimatePresence } from 'motion/react';

interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'file';
  previewUrl?: string;
  size: number;
}

type AgentToolStep = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  result?: ToolResult;
  activityTitle?: string;
  intention?: string;
  argsOneLiner?: string;
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: ChatAttachment[];
  tokenUsage?: AiChatMessageTokenUsage;
  toolSteps?: AgentToolStep[];
  agentThinking?: string;
  turnProfileLabel?: string;
  clarifyingQuestion?: { question: string; options?: string[]; reason?: string };
  iterationLimitOffer?: { message: string; iterationCount: number };
  agentTodos?: AgentTodoListItem[];
  taskDecomposition?: PromptTaskDecompositionPayload;
  vibePlan?: AgentPlanPayload;
  vibeProposal?: { proposalId: string; changeSets: ChangeSet[] };
  vibeValidation?: { ok: boolean; violations: ProposalViolation[] };
  vibeApplied?: boolean;
  vibeVerification?: PostApplyVerificationResult;
  designerHandoff?: DesignerHandoffPayload[];
  engineeringRouting?: AgentStreamRequestRoutingEvent;
  engineeringPipeline?: AgentStreamEngineeringPipelineEvent;
  connectionError?: ClassifiedConnectionError;
  turnTelemetry?: {
    tokensEstimate?: number;
    tokensBudget?: number;
    retrievalOperationCount?: number;
    draftToolCount?: number;
    iterationCount?: number;
  };
}

type ChatEditConfirmAction =
  | { type: 'deleteSingle'; messageIndex: number }
  | { type: 'truncateAfter'; messageIndex: number }
  | { type: 'truncateFrom'; messageIndex: number };

type ChatTurnRequest = {
  userMessageIndex: number;
  baseMessages: ChatMessage[];
  trimmedInput: string;
  effectiveChatMode: PanelChatMode;
  submitContextResources: AiChatContextResourceId[];
  agentPlanActMode?: AgentPlanActMode;
};

type QueuedChatTurn = Omit<ChatTurnRequest, 'baseMessages'>;

const withQueuedMessageTail = (
  userMessageIndex: number,
  updateTurn: (turnMessages: ChatMessage[]) => ChatMessage[],
) => (current: ChatMessage[]): ChatMessage[] => {
  let turnEnd = userMessageIndex + 1;
  if (current[turnEnd]?.role === 'assistant') {
    turnEnd += 1;
  }
  const turnSlice = current.slice(0, turnEnd);
  const tail = current.slice(turnEnd);
  return [...updateTurn(turnSlice), ...tail];
};

const updateTurnAssistantMessage = (
  prefix: ChatMessage[],
  update: (last: ChatMessage) => ChatMessage,
): ChatMessage[] => {
  const last = prefix[prefix.length - 1];
  if (!last || last.role !== 'assistant') return prefix;
  return [...prefix.slice(0, -1), update(last)];
};

const commitTurnMessages = (
  current: ChatMessage[],
  userMessageIndex: number,
  finalPrefix: ChatMessage[],
): ChatMessage[] => {
  let tailStart = userMessageIndex + 1;
  if (current[tailStart]?.role === 'assistant') {
    tailStart += 1;
  }
  return [...finalPrefix, ...current.slice(tailStart)];
};

const pinUserTurnSnapshot = (
  messages: ChatMessage[],
  userMessageIndex: number,
  snapshot: ChatMessage,
): ChatMessage[] => {
  const pinnedUserMessage = sanitizeUserMessageForUi({
    role: 'user',
    content: snapshot.content,
    attachments: snapshot.attachments,
  });

  return messages.map((message, index) => (
    index === userMessageIndex
      ? pinnedUserMessage
      : message
  ));
};

const updatePinnedTurnMessages = (
  userMessageIndex: number,
  userTurnSnapshot: ChatMessage,
  updateTurn: (turnMessages: ChatMessage[]) => ChatMessage[],
) => (current: ChatMessage[]): ChatMessage[] => (
  pinUserTurnSnapshot(
    withQueuedMessageTail(userMessageIndex, updateTurn)(current),
    userMessageIndex,
    userTurnSnapshot,
  )
);

const commitPinnedTurnMessages = (
  userMessageIndex: number,
  userTurnSnapshot: ChatMessage,
  finalPrefix: ChatMessage[],
) => (current: ChatMessage[]): ChatMessage[] => (
  pinUserTurnSnapshot(
    commitTurnMessages(current, userMessageIndex, finalPrefix),
    userMessageIndex,
    userTurnSnapshot,
  )
);

/**
 * Stream-time updates must keep the exact frozen user snapshot reference.
 * Re-sanitizing/cloning on every agent event re-copies huge previewUrl strings and
 * was the window where the user bubble flickered to raw attachment markdown.
 */
const applyPinnedTurnUpdate = (
  messagesRef: React.MutableRefObject<ChatMessage[]>,
  setMessagesFn: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  userMessageIndex: number,
  userTurnSnapshot: ChatMessage,
  updateTurn: (turnMessages: ChatMessage[]) => ChatMessage[],
) => {
  const updated = withQueuedMessageTail(userMessageIndex, updateTurn)(messagesRef.current);
  const next = updated.map((message, index) => (
    index === userMessageIndex ? userTurnSnapshot : message
  ));
  messagesRef.current = next;
  setMessagesFn(next);
};

const commitPinnedTurnToRef = (
  messagesRef: React.MutableRefObject<ChatMessage[]>,
  setMessagesFn: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  userMessageIndex: number,
  userTurnSnapshot: ChatMessage,
  finalPrefix: ChatMessage[],
) => {
  const committed = commitTurnMessages(messagesRef.current, userMessageIndex, finalPrefix);
  const next = committed.map((message, index) => (
    index === userMessageIndex ? userTurnSnapshot : message
  ));
  messagesRef.current = next;
  setMessagesFn(next);
  return next;
};

interface AppEndooPanelProps {
  isOpen: boolean;
  onClose: () => void;
  pageContext?: AiPageContext;
}

const PANEL_MIN_WIDTH = 792;
const PANEL_MAX_WIDTH = 2196;
const PANEL_MIN_HEIGHT = 682;
const PANEL_DEFAULT_WIDTH = 1026;
const PANEL_DEFAULT_HEIGHT = 1202;
const AI_PANEL_DOCK_SPLITTER_CLASS =
  'absolute top-0 bottom-0 z-10 w-1.5 shrink-0 cursor-col-resize touch-none bg-transparent hover:bg-primary-500/25 active:bg-primary-500/40';
const PANEL_MAXIMIZE_INSET = 16;

const AI_PANEL_DOCK_BUTTON_ACTIVE_CLASS =
  'bg-sky-50 text-sky-500 hover:bg-sky-50 hover:text-sky-600';
/** Chat-panel surface palette — white theme aligned with the main app shell. */
const AI_PANEL_BORDER_CLASS = 'border-slate-200';
const AI_PANEL_SURFACE_CLASS = 'bg-white';
const AI_PANEL_HEADER_SURFACE_CLASS = 'bg-white';
const AI_PANEL_SUBBAR_SURFACE_CLASS = 'bg-white';
/** Top header rows — darkest at top, lighter toward the chat body. */
const AI_PANEL_HEADER_ROW1_SURFACE_CLASS = 'bg-slate-100';
const AI_PANEL_HEADER_ROW2_SURFACE_CLASS = 'bg-slate-50';
const AI_PANEL_HEADER_ROW3_SURFACE_CLASS = 'bg-white';
const AI_PANEL_BODY_SURFACE_CLASS = 'bg-white';
const AI_PANEL_FOOTER_SURFACE_CLASS = 'bg-white';
const AI_PANEL_CARD_SURFACE_CLASS = 'bg-white';
const AI_PANEL_PROMPT_BOX_CLASS = 'px-2 pt-2 pb-1';
const AI_PANEL_PROMPT_SURFACE_CLASS = 'bg-white';
const AI_PANEL_PROMPT_INPUT_SURFACE_CLASS =
  '!bg-transparent hover:!bg-transparent data-[hover=true]:!bg-transparent';
const AI_PANEL_ASSISTANT_AVATAR_CLASS =
  'border border-cyan-200/80 bg-cyan-50/90 text-primary-600 shadow-lg shadow-slate-400/35 ring-2 ring-white';
const AI_PANEL_MAIN_HEADER_HEIGHT_CLASS = 'h-8';
const AI_PANEL_MAIN_HEADER_HEIGHT_DOCKED_CLASS = 'h-8';
const AI_PANEL_SUBBAR_INSET_CLASS = 'px-2';
const AI_PANEL_HEADER_ICON_BUTTON_CLASS = 'h-5 w-5';
const AI_PANEL_HEADER_ACTION_SEPARATOR_CLASS =
  `mx-[2px] h-3 shrink-0 border-l ${AI_PANEL_BORDER_CLASS}`;
const AI_PANEL_PROMPT_TOOLBAR_SEPARATOR_CLASS =
  `mx-0.5 h-2.5 shrink-0 border-l ${AI_PANEL_BORDER_CLASS}`;

const AiPanelPromptToolbarSeparator = () => (
  <span className={AI_PANEL_PROMPT_TOOLBAR_SEPARATOR_CLASS} aria-hidden="true" />
);

const withCultureVars = (text: string, vars: Record<string, string | number>): string => (
  Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    text,
  )
);

const AGENT_PLAN_ACT_OPTIONS = (t: TranslationFn): { id: AgentPlanActMode; label: string; title: string }[] => [
  { id: 'review', label: t('appendoo.planMode.review.label'), title: t('appendoo.planMode.review.title') },
  { id: 'implement', label: t('appendoo.planMode.implement.label'), title: t('appendoo.planMode.implement.title') },
];

const AgentPlanActToggle: React.FC<{
  mode: AgentPlanActMode;
  onChange: (mode: AgentPlanActMode) => void;
  disabled?: boolean;
}> = ({ mode, onChange, disabled }) => {
  const t = useCultureT();

  return (
  <div
    className="flex h-5 items-center rounded border border-slate-200 bg-slate-50/80 p-0.5 text-[10px] leading-none"
    role="group"
    aria-label={t('appendoo.planMode.ariaLabel')}
  >
    {AGENT_PLAN_ACT_OPTIONS(t).map((option) => {
      const isActive = option.id === mode;
      return (
        <button
          key={option.id}
          type="button"
          disabled={disabled}
          title={option.title}
          aria-pressed={isActive}
          className={cn(
            'rounded px-1.5 py-0.5 font-medium transition-colors',
            isActive ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      );
    })}
  </div>
  );
};

const getAiPanelDockButtonClassName = (isActive: boolean) => cn(
  ICON_ACTION_BUTTON_BASE_CLASS,
  AI_PANEL_HEADER_ICON_BUTTON_CLASS,
  isActive ? AI_PANEL_DOCK_BUTTON_ACTIVE_CLASS : ICON_ACTION_CANCEL_CLASS,
);
const DEFAULT_CHAT_TITLE_KEY = 'appendoo.chat.defaultTitle';

type ChatHandoffMode = 'full-handoff' | 'brief' | 'action-items' | 'technical' | 'bullet';

interface ChatHandoffModeOption {
  id: ChatHandoffMode;
  label: string;
  description: string;
  resultTitle: string;
  systemPrompt: string;
}

const CHAT_HANDOFF_SYSTEM_PROMPTS: Record<ChatHandoffMode, string> = {
  'full-handoff': `You are preparing a conversation handoff document. Summarize the entire conversation below into a concise, structured handoff that another assistant (or a future session) can use to continue work without losing context.

Include:
- Primary goal and current status
- Key decisions made
- Important technical details, file paths, code references, and constraints mentioned
- Open questions and next steps
- Any unresolved issues or blockers

Write in clear prose with short sections and bullet points where helpful. Be thorough but compact. Do not include filler or meta commentary about being an AI.`,
  brief: `Summarize the conversation below in a brief overview.

Write 2-4 short paragraphs covering the main topic, what was decided or learned, and where things stand now. Keep it readable and compact. Skip minor tangents. Do not include filler or meta commentary about being an AI.`,
  'action-items': `Extract an action-oriented summary from the conversation below.

Use these sections:
- Current status (1-2 sentences)
- Next steps (numbered, actionable)
- Open questions
- Blockers or risks

Focus only on what still needs to happen. Omit background that does not affect future work. Do not include filler or meta commentary about being an AI.`,
  technical: `Create a technical digest of the conversation below for a developer continuing the work.

Include:
- Problem and goal
- Architecture or approach decisions
- Files, modules, endpoints, tables, configs, and code references mentioned
- Constraints, standards, and rejected alternatives
- Implementation status and remaining technical work

Prefer precise references over narrative retelling. Use sections and bullet points. Do not include filler or meta commentary about being an AI.`,
  bullet: `Compress the conversation below into a dense bullet-list digest.

Rules:
- Use only bullet points grouped under short section headings
- Keep each bullet to one line when possible
- Preserve names, paths, decisions, and unresolved items
- Target maximum compression while keeping the result useful
- No intro, outro, or meta commentary about being an AI`,
};

const getChatHandoffModes = (t: TranslationFn): ChatHandoffModeOption[] => [
  {
    id: 'full-handoff',
    label: t('appendoo.handoff.modes.fullHandoff.label'),
    description: t('appendoo.handoff.modes.fullHandoff.description'),
    resultTitle: t('appendoo.handoff.modes.fullHandoff.resultTitle'),
    systemPrompt: CHAT_HANDOFF_SYSTEM_PROMPTS['full-handoff'],
  },
  {
    id: 'brief',
    label: t('appendoo.handoff.modes.brief.label'),
    description: t('appendoo.handoff.modes.brief.description'),
    resultTitle: t('appendoo.handoff.modes.brief.resultTitle'),
    systemPrompt: CHAT_HANDOFF_SYSTEM_PROMPTS.brief,
  },
  {
    id: 'action-items',
    label: t('appendoo.handoff.modes.actionItems.label'),
    description: t('appendoo.handoff.modes.actionItems.description'),
    resultTitle: t('appendoo.handoff.modes.actionItems.resultTitle'),
    systemPrompt: CHAT_HANDOFF_SYSTEM_PROMPTS['action-items'],
  },
  {
    id: 'technical',
    label: t('appendoo.handoff.modes.technical.label'),
    description: t('appendoo.handoff.modes.technical.description'),
    resultTitle: t('appendoo.handoff.modes.technical.resultTitle'),
    systemPrompt: CHAT_HANDOFF_SYSTEM_PROMPTS.technical,
  },
  {
    id: 'bullet',
    label: t('appendoo.handoff.modes.bullet.label'),
    description: t('appendoo.handoff.modes.bullet.description'),
    resultTitle: t('appendoo.handoff.modes.bullet.resultTitle'),
    systemPrompt: CHAT_HANDOFF_SYSTEM_PROMPTS.bullet,
  },
];

const DEFAULT_CHAT_HANDOFF_MODE: ChatHandoffMode = 'full-handoff';
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ESTIMATED_IMAGE_TOKENS = 765;
const MESSAGE_ROLE_OVERHEAD_TOKENS = 4;

const getCapabilityIcons = (t: TranslationFn): Array<{
  key: keyof AiModelCapabilities;
  icon: React.ReactNode;
  label: string;
}> => [
  { key: 'chat', icon: <MessageSquare className="h-3 w-3" />, label: t('appendoo.capability.chat') },
  { key: 'vision', icon: <Eye className="h-3 w-3" />, label: t('appendoo.capability.vision') },
  { key: 'imageGeneration', icon: <Image className="h-3 w-3" />, label: t('appendoo.capability.image') },
  { key: 'speechToText', icon: <Mic className="h-3 w-3" />, label: t('appendoo.capability.speechToText') },
  { key: 'textToSpeech', icon: <Volume2 className="h-3 w-3" />, label: t('appendoo.capability.textToSpeech') },
  { key: 'tools', icon: <Wrench className="h-3 w-3" />, label: t('appendoo.capability.tools') },
];

const renderCapabilities = (capabilities: AiModelCapabilities, t: TranslationFn, size: 'sm' | 'xs' = 'sm') => {
  if (isAiModelEmbeddingOnly({ capabilities })) {
    return renderAiModelEmbeddingOnlyLabel();
  }

  const capabilityIcons = getCapabilityIcons(t);
  const groups = AI_CAPABILITY_GROUPS
    .map((group) => (
      group
        .map((key) => capabilityIcons.find((item) => item.key === key))
        .filter((item): item is (typeof capabilityIcons)[number] => (
          Boolean(item && capabilities[item.key])
        ))
    ))
    .filter((group) => group.length > 0);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {groups.map((group, groupIndex) => (
        <React.Fragment key={group.map((item) => item.key).join('-')}>
          {groupIndex > 0 ? <AiCapabilityGroupSeparator className="h-4" /> : null}
          {group.map((item) => (
            <span
              key={item.key}
              className={cn(
                'inline-flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-600',
                size === 'sm' ? 'h-5 w-5' : 'h-4 w-4',
              )}
              title={item.label}
              aria-label={item.label}
            >
              {item.icon}
            </span>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

const getDefaultPanelHeight = () => Math.min(PANEL_DEFAULT_HEIGHT, window.innerHeight - 120);

const getCenteredPanelPos = (width: number, height: number) => ({
  x: Math.max(10, Math.round((window.innerWidth - width) / 2)),
  y: Math.max(10, Math.round((window.innerHeight - height) / 2)),
});

const createDefaultFloatingPanelGeometry = () => {
  const height = getDefaultPanelHeight();
  const width = PANEL_DEFAULT_WIDTH;
  return {
    size: { width, height },
    pos: getCenteredPanelPos(width, height),
  };
};

const estimateAttachmentTokens = (attachments: ChatAttachment[] | undefined): number => {
  if (!attachments?.length) return 0;
  return attachments.reduce((sum, attachment) => (
    sum + (attachment.kind === 'image' ? ESTIMATED_IMAGE_TOKENS : estimateTextTokens(attachment.name) + 32)
  ), 0);
};

const estimateChatTokens = (messages: ChatMessage[]): number => estimateChatMessagesTokens(messages);

const estimateMessageTokens = (message: ChatMessage): number => estimateStoredMessageTokens(message);

const formatApproxTurnTokensK = formatApproxTokensK;

const estimateCurrentTokens = (
  messages: ChatMessage[],
  draftText: string,
  draftAttachments: ChatAttachment[],
): number => {
  const historyTokens = estimateChatTokens(messages);
  const draftTokens = estimateTextTokens(draftText) + estimateAttachmentTokens(draftAttachments);
  const draftOverhead = draftText.trim() || draftAttachments.length ? MESSAGE_ROLE_OVERHEAD_TOKENS : 0;
  return historyTokens + draftTokens + draftOverhead;
};

const formatTokenCount = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 100_000) return `${Math.round(tokens / 1000)}k`;
  if (tokens >= 10_000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(tokens);
};

const getRingFillRatio = (usedTokens: number, limitTokens: number): number => {
  if (usedTokens <= 0 || limitTokens <= 0) return 0;
  const ratio = usedTokens / limitTokens;
  // Boost low ratios so the ring visibly tracks chat growth on large context windows.
  return Math.min(1, Math.sqrt(ratio * 12));
};

const createAttachmentId = () => `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.onerror = () => reject(reader.error ?? new Error(lookupEmbeddedEnglish('appendoo.agent.readFileFailed')));
  reader.readAsDataURL(file);
});

const collectClipboardFiles = (clipboardData: DataTransfer): File[] => {
  const directFiles = Array.from(clipboardData.files);
  if (directFiles.length) return directFiles;

  return Array.from(clipboardData.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
};

const normalizePastedFile = (file: File): File => {
  if (file.name.trim()) return file;
  const extension = file.type.startsWith('image/')
    ? (file.type.split('/')[1] || 'png')
    : 'bin';
  return new File([file], `pasted-${Date.now()}.${extension}`, { type: file.type || 'application/octet-stream' });
};

const fileToAttachment = async (file: File): Promise<ChatAttachment> => {
  const isImage = file.type.startsWith('image/');
  const previewUrl = await readFileAsDataUrl(file);
  return {
    id: createAttachmentId(),
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    kind: isImage ? 'image' : 'file',
    previewUrl,
    size: file.size,
  };
};

const filesToAttachments = async (files: File[]): Promise<ChatAttachment[]> => {
  const nextAttachments: ChatAttachment[] = [];
  for (const rawFile of files) {
    if (rawFile.size > MAX_ATTACHMENT_BYTES) continue;
    const file = normalizePastedFile(rawFile);
    try {
      nextAttachments.push(await fileToAttachment(file));
    } catch {
      // Skip unreadable files.
    }
  }
  return nextAttachments;
};

const formatAttachmentShortName = (name: string): string => {
  if (name.length <= 9) return name;
  return `${name.slice(0, 3)}...${name.slice(-3)}`;
};

const formatAttachmentCopyText = (attachments: ChatAttachment[]): string => (
  `[Attachments: ${attachments.map((attachment) => attachment.name).join(', ')}]`
);

const formatToolStepsCopyText = (steps: AgentToolStep[], thinking?: string): string => {
  const lines = ['[Agent steps]'];
  if (thinking?.trim()) {
    lines.push(thinking.trim());
  }
  steps.forEach((step) => {
    const label = step.activityTitle || step.name;
    const intention = step.intention ? ` — ${step.intention}` : '';
    const argsLine = step.argsOneLiner ? ` · ${step.argsOneLiner}` : '';
    const summary = step.result?.summary ? `: ${step.result.summary}` : '';
    lines.push(`- ${label} (${step.status})${intention}${argsLine}${summary}`);
  });
  return lines.join('\n');
};

const formatPlanCopyText = (plan: AgentPlanPayload): string => {
  const lines = ['[Plan]', plan.intent];
  plan.steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });
  if (plan.targetFiles.length) {
    lines.push(`Surface: ${plan.targetFiles.join(', ')}`);
  }
  return lines.join('\n');
};

const formatProposalCopyText = (
  proposal: { proposalId: string; changeSets: ChangeSet[] },
  validation?: { ok: boolean; violations: ProposalViolation[] },
): string => {
  const lines = [`[Proposed changes (${proposal.changeSets.length})]`];
  if (validation) {
    lines.push(validation.ok ? 'Validation passed' : 'Validation blocked confirm');
    validation.violations.forEach((violation) => {
      lines.push(`- ${violation.message}${violation.ruleId ? ` (${violation.ruleId})` : ''}`);
    });
  }
  proposal.changeSets.forEach((changeSet) => {
    lines.push('');
    lines.push(changeSet.title);
    if (changeSet.summary?.trim()) {
      lines.push(changeSet.summary.trim());
    }
    lines.push(formatChangeSetPreview(changeSet));
  });
  return lines.join('\n');
};

const formatVerificationCopyText = (verification: PostApplyVerificationResult): string => {
  const lines = [
    verification.ok ? 'Post-apply verification passed' : 'Post-apply verification failed',
  ];
  verification.checks.forEach((check) => {
    lines.push(`${check.ok ? '✓' : '✗'} ${check.message}`);
  });
  return lines.join('\n');
};

const formatDesignerHandoffCopyText = (items: DesignerHandoffPayload[]): string => (
  ['[Designer handoff]', ...items.map((item) => `- ${item.name} (${item.layoutId})`)].join('\n')
);

const buildMessageCopyText = (message: ChatMessage): string => {
  const sections: string[] = [];

  if (message.attachments?.length) {
    sections.push(formatAttachmentCopyText(message.attachments));
  }
  if (message.toolSteps?.length || message.agentThinking?.trim()) {
    sections.push(formatToolStepsCopyText(message.toolSteps ?? [], message.agentThinking));
  }
  if (message.vibePlan) {
    sections.push(formatPlanCopyText(message.vibePlan));
  }
  if (message.vibeProposal) {
    sections.push(formatProposalCopyText(message.vibeProposal, message.vibeValidation));
  }
  if (message.vibeVerification) {
    sections.push(formatVerificationCopyText(message.vibeVerification));
  }

  const content = resolveChatMessageDisplayContent(message.content ?? '', message.attachments);
  if (content) {
    sections.push(content);
  }

  if (message.designerHandoff?.length) {
    sections.push(formatDesignerHandoffCopyText(message.designerHandoff));
  }

  return sections.join('\n\n').trim();
};

const buildConversationTranscript = (messages: ChatMessage[]): string => (
  messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      const speaker = message.role === 'user' ? 'User' : 'Assistant';
      return `${speaker}: ${buildMessageCopyText(message)}`;
    })
    .join('\n\n')
);

const TokenUsageRing: React.FC<{
  usedTokens: number;
  limitTokens: number;
}> = ({
  usedTokens,
  limitTokens,
}) => {
  const fillRatio = getRingFillRatio(usedTokens, limitTokens);
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - fillRatio);
  const fillPercent = limitTokens > 0 ? Math.min(100, (usedTokens / limitTokens) * 100) : 0;
  const progressColor = fillPercent >= 90
    ? '#f43f5e'
    : fillPercent >= 75
      ? '#f59e0b'
      : '#0891b2';

  return (
    <svg
      className="h-3.5 w-3.5 shrink-0 -rotate-90"
      viewBox="0 0 18 18"
      aria-hidden
    >
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth="2"
      />
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        stroke={progressColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
      />
    </svg>
  );
};

const ChatTokenIndicator: React.FC<{
  usedTokens: number;
  limitTokens: number;
  onHandoffClick?: () => void;
  disabled?: boolean;
}> = ({
  usedTokens,
  limitTokens,
  onHandoffClick,
  disabled = false,
}) => {
  const t = useCultureT();
  const fillPercent = limitTokens > 0 ? Math.min(100, (usedTokens / limitTokens) * 100) : 0;
  const tokenLabel = withCultureVars(t('appendoo.tokenUsage.label'), {
    tokens: formatTokenCount(usedTokens),
    percent: Math.round(fillPercent),
  });
  const canHandoff = Boolean(onHandoffClick) && !disabled;

  return (
    <button
      type="button"
      data-chat-handoff
      className={cn(
        'flex items-center rounded p-0 transition-colors',
        canHandoff && 'cursor-pointer hover:bg-slate-100',
        !canHandoff && 'cursor-default',
        disabled && 'opacity-50',
      )}
      title={canHandoff ? withCultureVars(t('appendoo.tokenUsage.summarizeTitle'), { label: tokenLabel }) : tokenLabel}
      aria-label={canHandoff
        ? withCultureVars(t('appendoo.tokenUsage.summarizeAria'), { tokens: usedTokens })
        : withCultureVars(t('appendoo.tokenUsage.aria'), { tokens: usedTokens })}
      disabled={!canHandoff}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onHandoffClick}
    >
      <TokenUsageRing usedTokens={usedTokens} limitTokens={limitTokens} />
    </button>
  );
};

const PendingImageAttachmentChip: React.FC<{
  attachment: ChatAttachment;
  onRemove?: () => void;
  compact?: boolean;
}> = ({
  attachment,
  onRemove,
  compact = false,
}) => {
  const t = useCultureT();

  return (
  <div
    className="group relative"
    title={attachment.name}
  >
    {attachment.previewUrl ? (
      <img
        src={attachment.previewUrl}
        alt={attachment.name}
        className={cn('rounded object-cover', compact ? 'h-12 w-12' : 'h-14 w-14')}
      />
    ) : null}
    {onRemove ? (
      <AppButton
        type="button"
        closeIcon
        size="icon-sm"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        className="absolute -right-1 -top-1 h-5 w-5 min-h-0 min-w-0 shrink-0 bg-white shadow-sm"
        aria-label={withCultureVars(t('appendoo.panel.removeAttachment'), { name: attachment.name })}
      >
        <X className="h-3 w-3" />
      </AppButton>
    ) : null}
  </div>
  );
};

const PendingFileAttachmentChip: React.FC<{
  attachment: ChatAttachment;
  onRemove?: () => void;
}> = ({
  attachment,
  onRemove,
}) => (
  <div
    className="group relative inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-700"
    title={attachment.name}
  >
    <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
    <span className="truncate max-w-[10rem] font-medium">
      {formatAttachmentShortName(attachment.name)}
    </span>
    {onRemove ? (
      <AppButton
        type="button"
        closeIcon
        size="icon-sm"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        className="ms-0.5 h-4 w-4 min-h-0 min-w-0 shrink-0"
        aria-label={`Remove ${attachment.name}`}
      >
        <X className="h-2.5 w-2.5" />
      </AppButton>
    ) : null}
  </div>
);

const groupModelsByProvider = (models: AiAvailableModel[]) => {
  const groups = new Map<string, AiAvailableModel[]>();

  for (const model of models) {
    const label = getAiProviderLabel(model.provider, model.providerLabel);
    const existing = groups.get(label) ?? [];
    existing.push(model);
    groups.set(label, existing);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([providerLabel, providerModels]) => ({
      providerLabel,
      models: providerModels.sort((left, right) => left.name.localeCompare(right.name)),
    }));
};

const formatChatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isChatSessionNotFoundError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|HTTP 404|\b404\b/i.test(message);
};

const serializeMessagesForStorage = (messages: ChatMessage[]) => (
  ensureStoredMessagesHaveTokenUsage(
    messages.map((message) => (
      message.role === 'user'
        ? sanitizeUserMessageForUi(message)
        : {
          role: message.role,
          content: message.content,
          attachments: cloneAgentMessageAttachments(message.attachments),
          ...(message.tokenUsage ? { tokenUsage: message.tokenUsage } : {}),
        }
    )),
  )
);

const cloneChatMessages = (messages: ChatMessage[]): ChatMessage[] => (
  messages.map((message) => {
    if (message.role === 'user') {
      const sanitized = sanitizeUserMessageForUi(message);
      return {
        ...message,
        content: sanitized.content,
        attachments: sanitized.attachments,
      };
    }

    return {
      ...message,
      attachments: cloneAgentMessageAttachments(message.attachments),
    };
  })
);

const getChatHandoffModeOption = (mode: ChatHandoffMode, t: TranslationFn): ChatHandoffModeOption => (
  getChatHandoffModes(t).find((option) => option.id === mode) ?? getChatHandoffModes(t)[0]
);

const AI_PANEL_DIALOG_BACKDROP_CLASS = 'z-[110]';

const ChatHistoryDeleteConfirmModal: React.FC<{
  session: { id: number; title: string } | null;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({
  session,
  onCancel,
  onConfirm,
}) => {
  const t = useCultureT();
  if (!session) return null;

  return (
    <ConfirmDialogShell
      size="md"
      title={t('appendoo.chat.delete.title')}
      icon={<Trash2 className="h-4 w-4" />}
      backdropClassName={AI_PANEL_DIALOG_BACKDROP_CLASS}
      onClose={onCancel}
      onConfirm={onConfirm}
      confirmLabel={t('actions.delete')}
    >
      <DestructiveConfirmBody
        question={t('appendoo.chat.delete.question')}
        entityName={session.title}
      />
    </ConfirmDialogShell>
  );
};

const formatChatHistoryTokenTotals = (
  session: Pick<AiChatSessionSummary, 'totalInputTokens' | 'totalOutputTokens'>,
  t: TranslationFn,
): string | null => {
  const { totalInputTokens, totalOutputTokens } = session;
  if (totalInputTokens <= 0 && totalOutputTokens <= 0) return null;

  return withCultureVars(t('appendoo.chat.history.tokenTotals'), {
    input: formatApproxTurnTokensK(totalInputTokens),
    output: formatApproxTurnTokensK(totalOutputTokens),
  });
};

const ChatHistoryPanel: React.FC<{
  items: AiChatSessionSummary[];
  activeSessionId: number | null;
  filterQuery: string;
  onFilterQueryChange: (value: string) => void;
  isLoading: boolean;
  isLoadingSession: boolean;
  deletePendingId: number | null;
  onSelectSession: (sessionId: number) => void;
  onRequestDelete: (session: { id: number; title: string }) => void;
  onClose: () => void;
}> = ({
  items,
  activeSessionId,
  filterQuery,
  onFilterQueryChange,
  isLoading,
  isLoadingSession,
  deletePendingId,
  onSelectSession,
  onRequestDelete,
  onClose,
}) => {
  const t = useCultureT();
  const filteredItems = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return items;

    return items.filter((session) =>
      session.title.toLowerCase().includes(query)
      || (session.modelId?.toLowerCase().includes(query) ?? false),
    );
  }, [filterQuery, items]);

  return (
    <aside className={cn('flex min-h-0 min-w-0 flex-1 flex-col', AI_PANEL_BORDER_CLASS, AI_PANEL_SURFACE_CLASS)}>
      <div className={cn('flex h-10 shrink-0 items-center justify-between border-b px-3', AI_PANEL_BORDER_CLASS, AI_PANEL_SUBBAR_SURFACE_CLASS)}>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <History className="h-3.5 w-3.5" />
          {t('appendoo.chat.history.title')}
        </div>
        <AppButton
          closeIcon
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          aria-label={t('appendoo.chat.history.closeAria')}
        />
      </div>

      <div className={cn('shrink-0 border-b px-3 py-2', AI_PANEL_BORDER_CLASS)}>
        <UiInput
          size="sm"
          aiAssist={false}
          value={filterQuery}
          onChange={(event) => onFilterQueryChange(event.target.value)}
          placeholder={t('appendoo.chat.history.filterPlaceholder')}
          ariaLabel={t('appendoo.chat.history.filterAria')}
          className="h-8"
          startContent={<Search className="h-3.5 w-3.5 text-slate-400" />}
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-1 select-text">
        {isLoading ? (
          <div className="px-3 py-2 text-xs text-slate-500">{t('appendoo.chat.history.loading')}</div>
        ) : filteredItems.length === 0 ? (
          <div className="px-3 py-2 text-xs text-slate-500">
            {filterQuery.trim() ? t('appendoo.chat.history.noFilterMatch') : t('appendoo.chat.history.empty')}
          </div>
        ) : (
          filteredItems.map((session) => {
            const isActive = session.id === activeSessionId;
            const isDeleting = deletePendingId === session.id;
            const tokenTotalsLabel = formatChatHistoryTokenTotals(session, t);
            const messageCountLabel = session.messageCount === 1
              ? t('appendoo.chat.history.messageCount').replace('{count}', String(session.messageCount))
              : t('appendoo.chat.history.messageCountPlural').replace('{count}', String(session.messageCount));

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
                  disabled={Boolean(deletePendingId) || isLoadingSession}
                  onClick={() => onSelectSession(session.id)}
                >
                  <span className="block w-full text-sm font-medium leading-snug break-words">{session.title}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {formatChatDate(session.updatedAt)}
                    {' · '}
                    {messageCountLabel}
                    {tokenTotalsLabel ? (
                      <>
                        {' · '}
                        {tokenTotalsLabel}
                      </>
                    ) : null}
                    {session.modelId ? ` · ${session.modelId}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  className={cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-7 w-7 shrink-0', ICON_ACTION_DELETE_CLASS)}
                  aria-label={withCultureVars(t('appendoo.chat.history.deleteAria'), { title: session.title })}
                  disabled={Boolean(deletePendingId)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onRequestDelete({ id: session.id, title: session.title })}
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

const ChatHandoffConfirmModal: React.FC<{
  isOpen: boolean;
  messageCount: number;
  onCancel: () => void;
  onConfirm: (mode: ChatHandoffMode) => void;
}> = ({
  isOpen,
  messageCount,
  onCancel,
  onConfirm,
}) => {
  const t = useCultureT();
  const [selectedMode, setSelectedMode] = useState<ChatHandoffMode>(DEFAULT_CHAT_HANDOFF_MODE);

  useEffect(() => {
    if (isOpen) {
      setSelectedMode(DEFAULT_CHAT_HANDOFF_MODE);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handoffModes = getChatHandoffModes(t);
  const selectedOption = getChatHandoffModeOption(selectedMode, t);

  return (
    <CreateEditModalShell
      size="md"
      backdropClassName={AI_PANEL_DIALOG_BACKDROP_CLASS}
      title={(
        <span className="inline-flex items-center gap-2 text-cyan-600">
          <ScrollText className="h-4 w-4" />
          <span className="text-slate-800">{t('appendoo.handoff.summarizeTitle')}</span>
        </span>
      )}
      onClose={onCancel}
      onBackdropClick={onCancel}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
            {t('actions.cancel')}
          </AppButton>
          <AppButton intent="confirm" onClick={() => onConfirm(selectedMode)}>
            <Check className="h-3.5 w-3.5" />
            {t('appendoo.handoff.createSummary')}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-slate-600">
          {messageCount === 1
            ? t('appendoo.handoff.replaceOneMessage')
            : withCultureVars(t('appendoo.handoff.replaceManyMessages'), { count: messageCount })}
        </p>

        <UiOptionCardGroup
          value={selectedMode}
          onChange={(value) => setSelectedMode(value as ChatHandoffMode)}
          label={t('appendoo.handoff.summaryStyle')}
          ariaLabel={t('appendoo.handoff.summaryStyleAria')}
          columns={1}
          density="compact"
          accentClassName="border-cyan-300 bg-cyan-50/60"
          accentIconClassName="text-cyan-700"
          options={handoffModes.map((option) => ({
            value: option.id,
            title: option.label,
            description: option.description,
          }))}
        />

        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          {t('appendoo.handoff.output')} <span className="font-medium text-slate-700">{selectedOption.resultTitle}</span>
        </p>
      </div>
    </CreateEditModalShell>
  );
};

const ChatEditConfirmModal: React.FC<{
  action: ChatEditConfirmAction | null;
  messageCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({
  action,
  messageCount,
  onCancel,
  onConfirm,
}) => {
  const t = useCultureT();
  if (!action) return null;

  let title = t('appendoo.edit.title');
  let description = t('appendoo.edit.description');

  if (action.type === 'deleteSingle') {
    title = t('appendoo.edit.deleteMessage');
    description = t('appendoo.edit.removeSingleMessage');
  } else if (action.type === 'truncateAfter') {
    const removedCount = messageCount - action.messageIndex - 1;
    title = t('appendoo.edit.rewindTitle');
    description = removedCount === 1
      ? t('appendoo.edit.removeOneAfter')
      : withCultureVars(t('appendoo.edit.removeManyAfter'), { count: removedCount });
  } else if (action.type === 'truncateFrom') {
    const removedCount = messageCount - action.messageIndex;
    title = t('appendoo.edit.deleteFromTitle');
    description = removedCount === 1
      ? t('appendoo.edit.deleteThisMessage')
      : removedCount - 1 === 1
        ? withCultureVars(t('appendoo.edit.deleteThisAndAfter'), { count: removedCount - 1 })
        : withCultureVars(t('appendoo.edit.deleteThisAndAfterPlural'), { count: removedCount - 1 });
  }

  const isDestructive = action.type === 'deleteSingle' || action.type === 'truncateFrom';

  return (
    <ConfirmDialogShell
      size="md"
      title={title}
      icon={<Trash2 className="h-4 w-4" />}
      tone={isDestructive ? 'danger' : 'default'}
      iconToneClassName={isDestructive ? 'text-rose-600' : 'text-amber-600'}
      confirmIntent={isDestructive ? 'destructive' : 'primary'}
      backdropClassName={AI_PANEL_DIALOG_BACKDROP_CLASS}
      onClose={onCancel}
      onConfirm={onConfirm}
      confirmLabel={isDestructive ? t('actions.delete') : t('actions.confirm')}
    >
      <DestructiveConfirmBody
        question={description}
        warning={isDestructive ? undefined : null}
      />
    </ConfirmDialogShell>
  );
};

const summarizeAgentPlan = (plan: AgentPlanPayload, t: TranslationFn): string => (
  plan.steps.length === 1
    ? t('appendoo.plan.stepsOne')
    : withCultureVars(t('appendoo.plan.stepsMany'), { count: plan.steps.length })
);

const summarizeTaskDecomposition = (decomposition: PromptTaskDecompositionPayload, t: TranslationFn): string => (
  decomposition.workUnits.length === 1
    ? t('appendoo.taskBreakdown.oneUnit')
    : withCultureVars(t('appendoo.taskBreakdown.manyUnits'), { count: decomposition.workUnits.length })
);

const TaskDecompositionDetails = ({ decomposition }: { decomposition: PromptTaskDecompositionPayload }) => {
  const t = useCultureT();

  return (
  <div className="space-y-1 text-[10px] leading-relaxed text-slate-600">
    <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">{t('appendoo.taskBreakdown.title')}</p>
    <p className="font-medium text-slate-700">{decomposition.summary}</p>
    <ol className="list-decimal space-y-0.5 ps-4">
      {decomposition.workUnits.map((unit) => (
        <li key={unit}>{unit}</li>
      ))}
    </ol>
    {decomposition.assumptions?.length ? (
      <div className="text-slate-500">
        <p className="font-medium">{t('appendoo.taskBreakdown.assumptions')}</p>
        <ul className="list-disc ps-4">
          {decomposition.assumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    ) : null}
    {decomposition.openQuestions?.length ? (
      <div className="text-amber-800">
        <p className="font-medium">{t('appendoo.taskBreakdown.openQuestions')}</p>
        <ul className="list-disc ps-4">
          {decomposition.openQuestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    ) : null}
  </div>
  );
};

const TaskDecompositionDisclosure = ({ decomposition }: { decomposition: PromptTaskDecompositionPayload }) => {
  const t = useCultureT();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mb-1.5 select-text">
      <button
        type="button"
        className="inline-flex max-w-full cursor-pointer items-center gap-1.5 text-left text-[9px] text-slate-500 transition-colors hover:text-slate-700"
        aria-expanded={expanded}
        aria-label={expanded ? t('appendoo.taskBreakdown.hideDetails') : t('appendoo.taskBreakdown.showDetails')}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="min-w-0 truncate">{summarizeTaskDecomposition(decomposition, t)}</span>
        <ChevronDown className={cn('h-3 w-3 shrink-0 text-slate-400 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded ? (
        <div className="mt-1 border-s border-slate-200 ps-2.5">
          <TaskDecompositionDetails decomposition={decomposition} />
        </div>
      ) : null}
    </div>
  );
};

const VibePlanDetails = ({ plan }: { plan: AgentPlanPayload }) => {
  const t = useCultureT();

  return (
  <div className="space-y-1">
    <p className="font-medium text-slate-700">{plan.intent}</p>
    <ol className="list-decimal space-y-0.5 ps-4 text-slate-600">
      {plan.steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
    {plan.targetFiles.length ? (
      <p className="text-slate-500">
        {t('appendoo.plan.surface')} {plan.targetFiles.join(', ')}
      </p>
    ) : null}
  </div>
  );
};

const VibePlanDisclosure = ({ plan }: { plan: AgentPlanPayload }) => {
  const t = useCultureT();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mb-1.5 select-text">
      <button
        type="button"
        className="inline-flex max-w-full cursor-pointer items-center gap-1.5 text-left text-[11px] text-slate-500 transition-colors hover:text-slate-700"
        aria-expanded={expanded}
        aria-label={expanded ? t('appendoo.plan.hideDetails') : t('appendoo.plan.showDetails')}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="min-w-0 truncate">{summarizeAgentPlan(plan, t)}</span>
        <ChevronDown className={cn('h-3 w-3 shrink-0 text-slate-400 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded ? (
        <div className="mt-1 border-s border-slate-200 ps-2.5">
          <VibePlanDetails plan={plan} />
        </div>
      ) : null}
    </div>
  );
};

const VibeVerificationPanel = ({
  verification,
}: {
  verification: PostApplyVerificationResult;
}) => {
  const t = useCultureT();

  return (
  <div className={cn(
    'mb-2 rounded-lg border px-3 py-2.5 text-[11px]',
    verification.ok ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900' : 'border-rose-200 bg-rose-50/70 text-rose-900',
  )}
  >
    <div className="flex items-center gap-1.5 font-semibold">
      {verification.ok ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
      )}
      {verification.ok ? t('appendoo.verification.passed') : t('appendoo.verification.failed')}
    </div>
    <ul className="mt-2 space-y-1.5">
      {verification.checks.map((check) => (
        <li key={check.id} className="flex items-start gap-1.5 text-[10px] leading-relaxed">
          {check.ok ? (
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
          ) : (
            <X className="mt-0.5 h-3 w-3 shrink-0 text-rose-600" />
          )}
          <span>{check.message}</span>
        </li>
      ))}
    </ul>
  </div>
  );
};

const summarizeAgentToolSteps = (steps: AgentToolStep[], t: TranslationFn): string => {
  const readFileCount = steps.filter((step) => step.name === 'read_file').length;
  if (readFileCount > 0 && readFileCount === steps.length) {
    return readFileCount === 1
      ? t('appendoo.tools.readOneFile')
      : withCultureVars(t('appendoo.tools.readManyFiles'), { count: readFileCount });
  }

  const searchCount = steps.filter((step) => step.name === 'search_codebase').length;
  if (searchCount > 0 && searchCount === steps.length) {
    return searchCount === 1
      ? t('appendoo.tools.searchedCodebase')
      : withCultureVars(t('appendoo.tools.searchedCodebaseCount'), { count: searchCount });
  }

  const globCount = steps.filter((step) => step.name === 'glob_files').length;
  if (globCount > 0 && globCount === steps.length) {
    return globCount === 1
      ? t('appendoo.tools.scannedOnePath')
      : withCultureVars(t('appendoo.tools.scannedManyPaths'), { count: globCount });
  }

  const writeCount = steps.filter((step) => step.name === 'write_file' || step.name === 'apply_patch').length;
  if (writeCount > 0 && writeCount === steps.length) {
    return writeCount === 1
      ? t('appendoo.tools.updatedOneFile')
      : withCultureVars(t('appendoo.tools.updatedManyFiles'), { count: writeCount });
  }

  const errorCount = steps.filter((step) => step.status === 'error' || step.result?.ok === false).length;
  if (errorCount > 0) {
    const successCount = steps.length - errorCount;
    if (successCount === 0) {
      return errorCount === 1
        ? t('appendoo.tools.oneStepFailed')
        : withCultureVars(t('appendoo.tools.manyStepsFailed'), { count: errorCount });
    }
    return successCount === 1
      ? withCultureVars(t('appendoo.tools.completedWithFailures'), { success: successCount, failed: errorCount })
      : withCultureVars(t('appendoo.tools.completedWithFailuresPlural'), { success: successCount, failed: errorCount });
  }

  return steps.length === 1
    ? t('appendoo.tools.completedOneStep')
    : withCultureVars(t('appendoo.tools.completedManySteps'), { count: steps.length });
};

const ThinkingAnimatedLabel = ({ className }: { className?: string }) => {
  const t = useCultureT();

  return (
  <span className={cn('inline-flex items-baseline', className)} aria-label={t('appendoo.thinking.ariaLabel')}>
    <span>{t('appendoo.thinking.label')}</span>
    <span aria-hidden className="inline-flex min-w-[0.95rem]">
      {THINKING_DOT_DELAYS_MS.map((delayMs) => (
        <span
          key={delayMs}
          className="animate-pulse"
          style={{ animationDelay: `${delayMs}ms`, animationDuration: '1.1s' }}
        >
          .
        </span>
      ))}
    </span>
  </span>
  );
};

const THINKING_DOT_DELAYS_MS = [0, 180, 360] as const;

const AgentThinkingIndicator = ({
  steps,
  thinking,
  taskDecomposition,
  plan,
  isActive = false,
}: {
  steps?: AgentToolStep[];
  thinking?: string;
  taskDecomposition?: PromptTaskDecompositionPayload;
  plan?: AgentPlanPayload;
  isActive?: boolean;
}) => {
  const t = useCultureT();
  const [expanded, setExpanded] = useState(false);
  const safeSteps = steps ?? [];
  const hasSteps = safeSteps.length > 0;
  const hasTaskBreakdown = Boolean(taskDecomposition);
  const hasPlan = Boolean(plan);
  const isRunning = isActive || Boolean(thinking) || safeSteps.some((step) => step.status === 'running');
  const hasExpandableDetails = Boolean(thinking) || hasSteps || hasTaskBreakdown || hasPlan;

  if (!thinking && !hasSteps && !hasTaskBreakdown && !hasPlan && !isActive) return null;

  const completedSummary = hasSteps
    ? summarizeAgentToolSteps(safeSteps, t)
    : hasPlan && plan
      ? summarizeAgentPlan(plan, t)
      : hasTaskBreakdown && taskDecomposition
        ? summarizeTaskDecomposition(taskDecomposition, t)
        : t('appendoo.thinking.done');

  return (
    <div className="mb-1.5 select-text">
      <button
        type="button"
        className={cn(
          'inline-flex max-w-full items-center gap-1.5 text-left text-[11px] text-slate-500',
          hasExpandableDetails && 'cursor-pointer transition-colors hover:text-slate-700',
        )}
        aria-expanded={expanded}
        aria-label={isRunning ? t('appendoo.thinking.showDetails') : t('appendoo.thinking.showCompleted')}
        disabled={!hasExpandableDetails}
        onClick={() => {
          if (hasExpandableDetails) {
            setExpanded((open) => !open);
          }
        }}
      >
        {isRunning ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-600" aria-hidden />
        ) : null}
        <span className="min-w-0 truncate">
          {isRunning ? <ThinkingAnimatedLabel className="text-slate-500" /> : completedSummary}
        </span>
        {hasExpandableDetails ? (
          <ChevronDown className={cn('h-3 w-3 shrink-0 text-slate-400 transition-transform', expanded && 'rotate-180')} />
        ) : null}
      </button>

      {expanded && hasExpandableDetails ? (
        <div className="mt-1 space-y-1.5 border-s border-slate-200 ps-2.5 text-[10px] leading-relaxed text-slate-600">
          {thinking ? (
            <p className="text-amber-700">{thinking}</p>
          ) : isRunning ? (
            <p className="text-amber-700">{t('appendoo.thinking.working')}</p>
          ) : null}
          {taskDecomposition ? <TaskDecompositionDetails decomposition={taskDecomposition} /> : null}
          {plan ? <VibePlanDetails plan={plan} /> : null}
          {safeSteps.map((step) => (
            <div key={step.id} className="flex items-start gap-1.5">
              {step.status === 'running' ? (
                <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-cyan-600" />
              ) : step.status === 'error' || step.result?.ok === false ? (
                <X className="mt-0.5 h-3 w-3 shrink-0 text-rose-600" />
              ) : (
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
              )}
              <div className="min-w-0">
                <span className="font-medium text-slate-700">{step.name}</span>
                {step.result?.summary ? (
                  <p className="mt-0.5 text-slate-500">{step.result.summary}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const ChatTurnTokenUsageLabel: React.FC<{
  inputTokens: number;
  outputTokens: number;
  telemetry?: ChatMessage['turnTelemetry'];
  align: 'start' | 'end';
}> = ({
  inputTokens,
  outputTokens,
  telemetry,
  align,
}) => {
  const ctxLabel = telemetry?.tokensEstimate !== undefined
    ? formatApproxTurnTokensK(telemetry.tokensEstimate)
    : null;
  const budgetLabel = telemetry?.tokensBudget !== undefined
    ? formatApproxTurnTokensK(telemetry.tokensBudget)
    : null;

  return (
  <p
    className={cn(
      'mt-1 px-1 text-[10px] leading-none text-slate-400/65',
      align === 'end' ? 'text-end' : 'text-start',
    )}
    aria-label={`Approximate token usage: ${inputTokens} input, ${outputTokens} output`}
  >
    In {formatApproxTurnTokensK(inputTokens)}
    {' · '}
    Out {formatApproxTurnTokensK(outputTokens)}
    {ctxLabel ? (
      <>
        {' · '}
        Ctx {ctxLabel}
        {budgetLabel ? ` / ${budgetLabel}` : ''}
      </>
    ) : null}
    {telemetry?.retrievalOperationCount !== undefined ? (
      <>
        {' · '}
        Ret {telemetry.retrievalOperationCount}
      </>
    ) : null}
    {telemetry?.draftToolCount !== undefined ? (
      <>
        {' · '}
        Draft {telemetry.draftToolCount}
      </>
    ) : null}
    {' · in k'}
  </p>
  );
};

const ChatMessageRow: React.FC<{
  message: ChatMessage;
  messageIndex: number;
  isLastMessage: boolean;
  isProcessing: boolean;
  galleryImages?: ChatImageGalleryItem[];
  turnTokenUsage?: { inputTokens: number; outputTokens: number } | null;
  turnTelemetry?: ChatMessage['turnTelemetry'];
  userAvatar: {
    src: string | null;
    initial: string;
    alt: string;
  };
  onEdit: (index: number) => void;
  onConfirmAction: (action: ChatEditConfirmAction) => void;
  onVibeConfirm?: () => void;
  onVibeReject?: () => void;
  onRevertProposalZone?: (changeSetId: string, zone: DiffZone) => void;
  onDesignerHandoff?: (item: DesignerHandoffPayload) => void;
  onApproveSemanticPlan?: (bindingId: string, messageIndex: number) => void;
  onRepairRevisionExecute?: (messageIndex: number) => void;
  vibeApplyBusy?: boolean;
  planApprovalBusy?: boolean;
  repairExecuteBusy?: boolean;
  onContinueAgentTurn?: () => void;
  onClarifyingReply?: (answer: string) => void;
}> = memo(({
  message,
  messageIndex,
  isLastMessage,
  isProcessing,
  galleryImages,
  turnTokenUsage,
  turnTelemetry,
  userAvatar,
  onEdit,
  onConfirmAction,
  onVibeConfirm,
  onVibeReject,
  onRevertProposalZone,
  onDesignerHandoff,
  onApproveSemanticPlan,
  onRepairRevisionExecute,
  vibeApplyBusy,
  planApprovalBusy,
  repairExecuteBusy,
  onContinueAgentTurn,
  onClarifyingReply,
}) => {
  const t = useCultureT();
  const isUser = message.role === 'user';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copyFeedbackVisible, setCopyFeedbackVisible] = useState(false);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const menuRef = useSplitButtonMenu(isMenuOpen, setIsMenuOpen);
  const uiMessage = useMemo(() => (
    isUser
      ? sanitizeUserMessageForUi({
        role: 'user',
        content: message.content,
        attachments: message.attachments,
      })
      : message
  ), [isUser, message]);
  const copyText = useMemo(() => buildMessageCopyText(message), [message]);
  const shouldRenderMessageContent = Boolean(uiMessage.content?.trim());

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current !== null) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }
  }, []);

  const handleCopyMessage = useCallback(async () => {
    if (!copyText) return;

    try {
      await navigator.clipboard.writeText(copyText);
      setIsMenuOpen(false);
      setCopyFeedbackVisible(true);
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopyFeedbackVisible(false);
        copyFeedbackTimerRef.current = null;
      }, 1500);
    } catch {
      // Clipboard access may be blocked; fail silently.
    }
  }, [copyText]);

  const menuItems: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    iconClassName: string;
    onClick: () => void;
    disabled?: boolean;
  }> = [];

  menuItems.push({
    key: 'copy',
    label: t('appendoo.message.copy'),
    icon: <Copy className="h-3.5 w-3.5" />,
    iconClassName: 'text-slate-600',
    onClick: () => { void handleCopyMessage(); },
    disabled: !copyText,
  });

  if (isUser) {
    menuItems.push({
      key: 'edit',
      label: t('appendoo.message.edit'),
      icon: <Pencil className="h-3.5 w-3.5" />,
      iconClassName: 'text-indigo-600',
      onClick: () => onEdit(messageIndex),
    });
  }

  if (!isLastMessage) {
    menuItems.push({
      key: 'rewind',
      label: t('appendoo.message.rewind'),
      icon: <Undo2 className="h-3.5 w-3.5" />,
      iconClassName: 'text-cyan-600',
      onClick: () => onConfirmAction({ type: 'truncateAfter', messageIndex }),
    });
  }

  menuItems.push(
    {
      key: 'delete-from',
      label: t('appendoo.message.deleteFromHere'),
      icon: <Trash2 className="h-3.5 w-3.5" />,
      iconClassName: 'text-rose-600',
      onClick: () => onConfirmAction({ type: 'truncateFrom', messageIndex }),
    },
    {
      key: 'delete-single',
      label: t('appendoo.message.deleteThis'),
      icon: <X className="h-3.5 w-3.5" />,
      iconClassName: 'text-rose-600',
      onClick: () => onConfirmAction({ type: 'deleteSingle', messageIndex }),
    },
  );

  const handleMenuItemClick = (onClick: () => void) => {
    setIsMenuOpen(false);
    onClick();
  };

  return (
    <div
      className={cn(
        'relative pt-2 text-xs',
        isUser ? 'ml-auto w-fit max-w-[85%] pe-[5px]' : 'w-full ps-[13px] pe-[5px]',
      )}
      data-chat-message
    >
      <div className={cn('flex min-w-0 flex-col', isUser ? 'items-end' : 'items-start')}>
        <div className="relative w-full min-w-0">
          <div
            ref={menuRef}
            className={cn(
              'absolute z-10',
              isUser ? '-top-3 -right-3' : '-top-3 -left-3',
            )}
            data-chat-message-menu
          >
            <button
              type="button"
              className={cn(
                'flex h-8 w-8 items-center justify-center overflow-hidden rounded-full transition-all',
                isProcessing ? 'cursor-default opacity-60' : 'cursor-pointer hover:ring-2 hover:ring-primary-500/20',
                isUser
                  ? 'border border-primary-500/20 bg-primary-subtle/70 text-primary-600 shadow-lg shadow-slate-400/35 ring-2 ring-white'
                  : AI_PANEL_ASSISTANT_AVATAR_CLASS,
              )}
              aria-label={
                copyFeedbackVisible
                  ? t('appendoo.message.copied')
                  : isUser
                    ? withCultureVars(t('appendoo.message.userActionsNamed'), { name: userAvatar.alt })
                    : t('appendoo.message.assistantActions')
              }
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              disabled={isProcessing}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                if (!isProcessing) {
                  setIsMenuOpen((open) => !open);
                }
              }}
            >
              {copyFeedbackVisible ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              ) : isUser ? (
                userAvatar.src ? (
                  <img
                    src={userAvatar.src}
                    alt={userAvatar.alt}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-primary-700">{userAvatar.initial}</span>
                )
              ) : (
                <Bot className="h-[22px] w-[22px]" />
              )}
            </button>

            {isMenuOpen && !isProcessing ? (
              <div
                className={cn(
                  SPLIT_BUTTON_MENU_PANEL_CLASS,
                  'absolute top-[calc(100%+4px)] z-20 min-w-[11.5rem] py-1',
                  isUser ? 'right-0 left-auto' : 'left-0 right-auto',
                )}
                role="menu"
                aria-label={isUser ? t('appendoo.message.userActions') : t('appendoo.message.assistantActions')}
              >
                {menuItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    className={cn(
                      SPLIT_BUTTON_MENU_ITEM_CLASS,
                      'gap-2 py-2',
                      item.disabled && 'cursor-not-allowed opacity-50',
                    )}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      if (item.disabled) return;
                      handleMenuItemClick(item.onClick);
                    }}
                  >
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center', item.iconClassName)}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className={cn(
            'relative w-full min-w-0 break-words px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap select-text',
            isUser
              ? 'rounded-tl-lg rounded-tr-none rounded-br-lg rounded-bl-lg border border-primary-500/20 bg-primary-subtle/60 pt-4 pe-5 text-slate-800 shadow-none transition-shadow hover:shadow-sm hover:shadow-primary-500/12'
              : 'rounded-tl-none rounded-tr-lg rounded-br-lg rounded-bl-lg border border-slate-100/90 bg-white pt-4 ps-5 text-slate-800 shadow-none transition-shadow hover:shadow-sm hover:shadow-slate-300/25',
          )}
          >
        {uiMessage.attachments?.length ? (
          <ChatMessageAttachments
            attachments={uiMessage.attachments}
            variant={isUser ? 'user' : 'assistant'}
            galleryImages={galleryImages}
          />
        ) : null}
        {message.turnProfileLabel ? (
          <p className="mb-1 text-[10px] font-medium text-slate-500">{message.turnProfileLabel}</p>
        ) : null}
        {message.agentTodos?.length ? (
          <AgentTodoListWidget todos={message.agentTodos} />
        ) : null}
        <AgentActivityFeed
          steps={message.toolSteps}
          thinking={message.agentThinking}
          isActive={!isUser && isLastMessage && isProcessing}
          copyStepsText={
            !isUser && (message.toolSteps?.length ?? 0) > 0
              ? formatToolStepsCopyText(message.toolSteps ?? [], message.agentThinking)
              : undefined
          }
        />
        {message.taskDecomposition ? (
          <TaskDecompositionDisclosure decomposition={message.taskDecomposition} />
        ) : null}
        {message.vibePlan ? (
          <VibePlanDisclosure plan={message.vibePlan} />
        ) : null}
        {message.clarifyingQuestion ? (
          <div className="mb-2 rounded border border-sky-200 bg-sky-50/80 px-2.5 py-2 text-[11px] text-sky-950">
            {message.clarifyingQuestion.reason ? (
              <p className="mb-1 text-[10px] text-sky-700">{message.clarifyingQuestion.reason}</p>
            ) : null}
            <p className="font-medium">{message.clarifyingQuestion.question}</p>
            {message.clarifyingQuestion.options?.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {message.clarifyingQuestion.options.map((option) => (
                  <AppButton
                    key={option}
                    type="button"
                    size="sm"
                    intent="secondary"
                    disabled={isProcessing}
                    onClick={() => onClarifyingReply?.(option)}
                  >
                    {option}
                  </AppButton>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {message.iterationLimitOffer ? (
          <div className="mt-2 rounded border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-[11px] text-amber-900">
            <p>{message.iterationLimitOffer.message}</p>
            <AppButton
              type="button"
              size="sm"
              intent="secondary"
              className="mt-1.5"
              disabled={isProcessing}
              onClick={() => onContinueAgentTurn?.()}
            >
              Continue
            </AppButton>
          </div>
        ) : null}
        {message.vibeProposal && !message.engineeringPipeline ? (
          <VibeProposalPanel
            proposal={message.vibeProposal}
            validation={message.vibeValidation}
            onConfirm={onVibeConfirm ?? (() => undefined)}
            onReject={onVibeReject ?? (() => undefined)}
            onRevertZone={onRevertProposalZone}
            busy={vibeApplyBusy}
            applied={message.vibeApplied}
            applyBlockedReason={resolvePanelApplyBlockedReason(message.engineeringRouting)}
          />
        ) : null}
        {message.vibeVerification ? (
          <VibeVerificationPanel verification={message.vibeVerification} />
        ) : null}
        {message.engineeringRouting
          && !message.engineeringRouting.useEngineeringPipeline
          && message.engineeringRouting.requestClass === 'ENGINEERING_CHANGE' ? (
          <p className="mb-1.5 rounded border border-slate-200 bg-slate-50/80 px-2 py-1 text-[10px] text-slate-600">
            Direct agent path — changes via proposals in this panel (no architecture pipeline)
          </p>
        ) : null}
        {message.engineeringRouting?.useEngineeringPipeline ? (
          <ContextUnderstandingPanel
            snapshot={toEngineeringPipelineSnapshot(message.engineeringRouting)}
          />
        ) : null}
        {message.engineeringRouting?.useEngineeringPipeline ? (
          <EngineeringPipelineStatus
            snapshot={toEngineeringPipelineSnapshot(message.engineeringRouting)}
            pipeline={message.engineeringPipeline
              ? buildEngineeringPipelineViewModel(message.engineeringPipeline, message.engineeringRouting)
              : undefined}
          />
        ) : null}
        {message.engineeringRouting?.useEngineeringPipeline && message.engineeringPipeline ? (
          <>
            <SemanticPlanApprovalBar
              pipeline={buildEngineeringPipelineViewModel(
                message.engineeringPipeline,
                message.engineeringRouting,
              )}
              onApprove={onApproveSemanticPlan
                ? (bindingId) => onApproveSemanticPlan(bindingId, messageIndex)
                : undefined}
              approving={planApprovalBusy}
            />
            <SemanticPlanPanel
              pipeline={buildEngineeringPipelineViewModel(
                message.engineeringPipeline,
                message.engineeringRouting,
              )}
            />
          </>
        ) : null}
        {message.engineeringPipeline ? (
          <ChangeGraphPanel
            pipeline={buildEngineeringPipelineViewModel(
              message.engineeringPipeline,
              message.engineeringRouting,
            )}
          />
        ) : null}
        {message.engineeringPipeline ? (
          <EngineeringWorkspacePanel
            pipeline={buildEngineeringPipelineViewModel(
              message.engineeringPipeline,
              message.engineeringRouting,
            )}
          />
        ) : null}
        {message.engineeringPipeline ? (
          <EngineeringVerificationPanel
            pipeline={buildEngineeringPipelineViewModel(
              message.engineeringPipeline,
              message.engineeringRouting,
            )}
            onRepairExecute={
              onRepairRevisionExecute
              && message.engineeringPipeline.repairRevisionId
              && message.engineeringPipeline.approvalBindingId
              && message.engineeringPipeline.deployable === false
                ? () => onRepairRevisionExecute(messageIndex)
                : undefined
            }
            repairExecuteBusy={repairExecuteBusy}
          />
        ) : null}
        {shouldRenderMessageContent ? (
          <ChatMessageContent
            content={uiMessage.content}
            attachments={uiMessage.attachments}
            tone={isUser ? 'user' : 'assistant'}
            galleryImages={galleryImages}
          />
        ) : null}
        {message.connectionError ? (
          <ConnectionErrorBanner error={message.connectionError} />
        ) : null}
        {message.designerHandoff?.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.designerHandoff.map((item) => (
              <AppButton
                key={item.layoutId}
                intent="confirm"
                size="sm"
                onClick={() => onDesignerHandoff?.(item)}
              >
                <Blocks className="h-3.5 w-3.5" />
                Open {item.name} in Designer
              </AppButton>
            ))}
          </div>
        ) : null}
          </div>
        </div>
      {!isUser && turnTokenUsage ? (
        <ChatTurnTokenUsageLabel
          inputTokens={turnTokenUsage.inputTokens}
          outputTokens={turnTokenUsage.outputTokens}
          telemetry={turnTelemetry}
          align="start"
        />
      ) : null}
      </div>
    </div>
  );
});
ChatMessageRow.displayName = 'ChatMessageRow';

const getContextResourceIcon = (id: AiChatContextResourceId) => {
  if (id === 'standards') return ScrollText;
  if (id === 'feature') return Network;
  if (id === 'notes') return NotebookPen;
  if (id === 'designer') return Blocks;
  if (id === 'function') return Code2;
  if (id === 'settings') return Settings;
  return LayoutDashboard;
};

const getMaximizedPanelBounds = () => ({
  x: PANEL_MAXIMIZE_INSET,
  y: PANEL_MAXIMIZE_INSET,
  width: Math.max(PANEL_MIN_WIDTH, window.innerWidth - PANEL_MAXIMIZE_INSET * 2),
  height: Math.max(PANEL_MIN_HEIGHT, window.innerHeight - PANEL_MAXIMIZE_INSET * 2),
});

const ChatContextResourceBadge: React.FC<{
  id: AiChatContextResourceId;
  pageContext?: AiPageContext;
  onRemove: () => void;
}> = ({
  id,
  pageContext,
  onRemove,
}) => {
  const t = useCultureT();
  const option = getChatContextResourceOption(id);
  const Icon = getContextResourceIcon(id);

  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50/90 py-0.5 ps-1.5 pe-0.5 text-[10px] font-medium text-cyan-800"
      title={option.badgeTitle(pageContext)}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{option.badgeLabel(pageContext)}</span>
      <AppButton
        type="button"
        closeIcon
        size="icon-sm"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onRemove}
        className="h-4 w-4 min-h-0 min-w-0 shrink-0"
        aria-label={withCultureVars(t('appendoo.context.removeAria'), { label: option.label })}
      >
        <X className="h-2.5 w-2.5" />
      </AppButton>
    </span>
  );
};

const ChatContextResourcePicker: React.FC<{
  pageContext?: AiPageContext;
  resourceEnv?: ChatContextResourceEnv;
  attachedIds: AiChatContextResourceId[];
  onAdd: (id: AiChatContextResourceId) => void;
}> = ({
  pageContext,
  resourceEnv,
  attachedIds,
  onAdd,
}) => {
  const t = useCultureT();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen);
  const menuStyle = useFixedDropUpMenuStyle(isOpen, menuRef, { minWidth: 224 });
  const attached = new Set(attachedIds);
  const addable = getAvailableChatContextResources(pageContext, resourceEnv)
    .filter((option) => !attached.has(option.id));

  return (
    <div ref={menuRef} className="relative shrink-0" data-chat-context>
      <AppButton
        type="button"
        size="icon-sm"
        aria-label={t('appendoo.context.addAria')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={addable.length === 0}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-5 w-5 min-h-0 min-w-0 shrink-0 rounded', ICON_ACTION_CANCEL_CLASS)}
        title={addable.length ? t('appendoo.context.addAria') : t('appendoo.context.allAttached')}
      >
        <Plus className="h-3 w-3" />
      </AppButton>

      {isOpen && addable.length > 0 ? (
        <div
          className={cn(SPLIT_BUTTON_DROP_UP_MENU_FIXED_CLASS, 'min-w-[14rem] py-1')}
          style={menuStyle}
          role="listbox"
          aria-label={t('appendoo.context.resourcesAria')}
        >
          {addable.map((option) => {
            const ItemIcon = getContextResourceIcon(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                className={cn(SPLIT_BUTTON_MENU_ITEM_CLASS, 'items-start gap-2 py-2')}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  onAdd(option.id);
                  setIsOpen(false);
                }}
              >
                <ItemIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600" />
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-[10px] leading-snug text-slate-400">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const ChatContextResourceRow: React.FC<{
  pageContext?: AiPageContext;
  resourceEnv?: ChatContextResourceEnv;
  attachedIds: AiChatContextResourceId[];
  onAdd: (id: AiChatContextResourceId) => void;
  onRemove: (id: AiChatContextResourceId) => void;
}> = ({
  pageContext,
  resourceEnv,
  attachedIds,
  onAdd,
  onRemove,
}) => {
  const activeIds = attachedIds.filter((id) => isChatContextResourceAvailable(id, pageContext, resourceEnv));

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-chat-context>
      {activeIds.map((id) => (
        <ChatContextResourceBadge
          key={id}
          id={id}
          pageContext={pageContext}
          onRemove={() => onRemove(id)}
        />
      ))}
      <ChatContextResourcePicker
        pageContext={pageContext}
        resourceEnv={resourceEnv}
        attachedIds={attachedIds}
        onAdd={onAdd}
      />
    </div>
  );
};

const formatLocalizedQueuedPlaceholder = (queuedCount: number, t: TranslationFn): string => {
  if (queuedCount <= 0) {
    return t('appendoo.prompt.askPlaceholder');
  }
  if (queuedCount === 1) {
    return t('appendoo.prompt.queuedOne');
  }
  return withCultureVars(t('appendoo.prompt.queuedMany'), { count: queuedCount });
};

const initialAppEndooUiState = resolveInitialAppEndooUiState();

export const AppEndooPanel = ({ isOpen, onClose, pageContext }: AppEndooPanelProps) => {
  const t = useCultureT();
  const isRtl = useOptionalCulture()?.direction === 'rtl';
  const defaultChatTitle = t(DEFAULT_CHAT_TITLE_KEY);
  const navigate = useNavigate();
  const viewportTier = useViewportTier();
  const isOverlayShell = isCompactChromeTier(viewportTier);
  const { send: sendAiChatStream } = useAiChatStream();
  const { avatarXs, avatarInitial, displayName, currentUser } = useCurrentUserDisplay();
  const currentUserId = currentUser?.id;
  const userAvatar = useMemo(() => ({
    src: avatarXs,
    initial: avatarInitial,
    alt: displayName,
  }), [avatarInitial, avatarXs, displayName]);
  const availableModelsQuery = useAvailableAiModelsQuery(isOpen);
  const aiSettingsQuery = useAiSettingsQuery();
  const chatSessionsQuery = useAiChatSessionsQuery(isOpen, currentUserId);
  const createChatSessionMutation = useCreateAiChatSessionMutation(currentUserId);
  const updateChatSessionMutation = useUpdateAiChatSessionMutation(currentUserId);
  const deleteChatSessionMutation = useDeleteAiChatSessionMutation(currentUserId);
  const [chatMode, setChatMode] = useState<PanelChatMode>(() => resolveDefaultChatMode(pageContext));
  const [agentPlanActMode, setAgentPlanActMode] = useState<AgentPlanActMode>('implement');
  const mcpAccessQuery = useAiMcpAccessMeQuery(isOpen && chatMode === 'agent');

  const allowedCapabilityPacks = mcpAccessQuery.data?.packs ?? [];
  const enabledMcpServers = useMemo(
    () => mcpAccessQuery.data?.mcpServers ?? [],
    [mcpAccessQuery.data],
  );
  const defaultAgentCapabilityScope = mcpAccessQuery.data?.defaultScope;
  const [agentCapabilityScope, setAgentCapabilityScope] = useState<AiAgentCapabilityScope>(
    () => ({ ...DEFAULT_AGENT_CAPABILITY_SCOPE, packIds: [...DEFAULT_AGENT_CAPABILITY_SCOPE.packIds] }),
  );
  const [agentMcpWarnings, setAgentMcpWarnings] = useState<string[]>([]);
  const [vibeApplyBusy, setVibeApplyBusy] = useState(false);
  const [backgroundTaskSubmitting, setBackgroundTaskSubmitting] = useState(false);
  const [planApprovalBusy, setPlanApprovalBusy] = useState(false);
  const [repairExecuteBusy, setRepairExecuteBusy] = useState(false);
  const [appliedChangeBatch, setAppliedChangeBatch] = useState<{
    applyId: number;
    items: AppliedChangeItem[];
  } | null>(null);
  const [rejectingChangeSetId, setRejectingChangeSetId] = useState<string | null>(null);
  const [rejectingZoneKey, setRejectingZoneKey] = useState<string | null>(null);
  const [activeVibeProposal, setActiveVibeProposal] = useState<{ proposalId: string; changeSets: ChangeSet[] } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queuedSubmitCount, setQueuedSubmitCount] = useState(0);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(
    () => initialAppEndooUiState.activeSessionId,
  );
  const [chatTitle, setChatTitle] = useState(defaultChatTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(defaultChatTitle);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [historyFilterQuery, setHistoryFilterQuery] = useState('');
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [chatEditConfirm, setChatEditConfirm] = useState<ChatEditConfirmAction | null>(null);
  const [isHandoffConfirmOpen, setIsHandoffConfirmOpen] = useState(false);
  const [chatHistoryDeleteTarget, setChatHistoryDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const [attachedContextResourceIds, setAttachedContextResourceIds] = useState<AiChatContextResourceId[]>(
    () => (
      isVibeStudioPageContext(pageContext)
        ? resolveDefaultAgentContextResourceIds(pageContext)
        : [...DEFAULT_CHAT_CONTEXT_RESOURCE_IDS]
    ),
  );
  const [isPanelMaximized, setIsPanelMaximized] = useState(initialAppEndooUiState.isMaximized);
  const [panelDockSide, setPanelDockSide] = useState<AppEndooDockSide>(initialAppEndooUiState.dockSide);
  const [dockWidth, setDockWidth] = useState(() => readStoredAppEndooDockWidth());
  const isSideDocked = panelDockSide !== 'none';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useSplitButtonMenu(isModelMenuOpen, setIsModelMenuOpen);
  const modelMenuStyle = useFixedDropDownMenuStyle(isModelMenuOpen, modelMenuRef, {
    align: 'end',
    minWidth: 256,
    maxHeight: 256,
  });
  const previousUserIdRef = useRef<number | undefined>(undefined);
  const activeSessionIdRef = useRef<number | null>(initialAppEndooUiState.activeSessionId);
  const chatTitleRef = useRef(defaultChatTitle);
  const messagesRef = useRef<ChatMessage[]>([]);
  const isProcessingRef = useRef(false);
  const submitQueueRef = useRef<QueuedChatTurn[]>([]);
  const agentCapabilityScopeRef = useRef<AiAgentCapabilityScope>(agentCapabilityScope);
  const agentPlanActModeRef = useRef(agentPlanActMode);
  const persistChatSessionChainRef = useRef<Promise<void>>(Promise.resolve());

  const [panelPos, setPanelPos] = useState(() => initialAppEndooUiState.panelPos);
  const [panelSize, setPanelSize] = useState(() => initialAppEndooUiState.panelSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDockResizing, setIsDockResizing] = useState(false);
  const preMaximizePanelStateRef = useRef<{
    pos: { x: number; y: number };
    size: { width: number; height: number };
  } | null>(null);
  const preDockPanelStateRef = useRef<{
    pos: { x: number; y: number };
    size: { width: number; height: number };
    wasMaximized: boolean;
  } | null>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, right: 24, top: 90 });
  const resizeStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    width: PANEL_DEFAULT_WIDTH,
    height: getDefaultPanelHeight(),
    right: 24,
    top: 90,
  });
  const dockResizeStartRef = useRef({
    mouseX: 0,
    width: APPENDOO_DOCK_WIDTH_PX,
  });
  const dockWidthRef = useRef(dockWidth);
  const hasRestoredSessionRef = useRef(false);
  const hasAppliedOpenLayoutRef = useRef(false);

  useEffect(() => {
    dockWidthRef.current = dockWidth;
  }, [dockWidth]);

  const effectiveDockWidth = useMemo(() => dockWidth, [dockWidth]);

  const effectiveDockSide = useMemo<AppEndooDockSide>(() => {
    if (!isOpen || isOverlayShell) return 'none';
    return panelDockSide;
  }, [isOpen, isOverlayShell, panelDockSide]);

  const isDockedLayout = effectiveDockSide !== 'none';

  const availableModels = availableModelsQuery.data?.models ?? [];
  const defaultModelId = availableModelsQuery.data?.defaultModelId ?? '';
  const preferredAgentModelId = useMemo(
    () => resolvePreferredAgentModelId(availableModels, defaultModelId),
    [availableModels, defaultModelId],
  );
  const activeModelId = useMemo(() => {
    const modePrefersStrong = chatMode === 'agent' || chatMode === 'plan';
    const requested = selectedModelId || defaultModelId;

    if (modePrefersStrong && shouldAutoUpgradeAgentModel(selectedModelId, defaultModelId)) {
      if (availableModels.some((model) => model.id === preferredAgentModelId)) {
        return preferredAgentModelId;
      }
    }

    if (availableModels.some((model) => model.id === requested)) {
      return requested;
    }

    return modePrefersStrong ? preferredAgentModelId : defaultModelId;
  }, [availableModels, chatMode, defaultModelId, preferredAgentModelId, selectedModelId]);
  const selectedModel = availableModels.find((model) => model.id === activeModelId) ?? null;
  const supportsAgentMode = Boolean(selectedModel?.capabilities.tools);

  useEffect(() => {
    if (!defaultAgentCapabilityScope || activeSessionId) return;
    setAgentCapabilityScope({
      packIds: [...defaultAgentCapabilityScope.packIds],
      mcpServerIds: [...defaultAgentCapabilityScope.mcpServerIds],
    });
  }, [defaultAgentCapabilityScope, activeSessionId]);

  useEffect(() => {
    agentCapabilityScopeRef.current = agentCapabilityScope;
  }, [agentCapabilityScope]);

  useEffect(() => {
    agentPlanActModeRef.current = agentPlanActMode;
  }, [agentPlanActMode]);

  useEffect(() => {
    if (!mcpAccessQuery.data) return;
    const allowedPackIds = new Set(mcpAccessQuery.data.packs.map((pack) => pack.id));
    const allowedMcpIds = new Set(mcpAccessQuery.data.mcpServers.map((server) => server.id));
    setAgentCapabilityScope((current) => {
      const nextPackIds = current.packIds.filter((packId) => allowedPackIds.has(packId));
      const nextMcpServerIds = current.mcpServerIds.filter((serverId) => allowedMcpIds.has(serverId));
      if (
        nextPackIds.length === current.packIds.length
        && nextMcpServerIds.length === current.mcpServerIds.length
      ) {
        return current;
      }
      return { packIds: nextPackIds, mcpServerIds: nextMcpServerIds };
    });
  }, [mcpAccessQuery.data]);

  useEffect(() => {
    const enabledIds = new Set(enabledMcpServers.map((server) => server.id));
    setAgentCapabilityScope((current) => {
      const nextMcpServerIds = current.mcpServerIds.filter((id) => enabledIds.has(id));
      if (nextMcpServerIds.length === current.mcpServerIds.length) {
        return current;
      }
      return { ...current, mcpServerIds: nextMcpServerIds };
    });
  }, [enabledMcpServers]);

  const groupedModels = useMemo(() => groupModelsByProvider(availableModels), [availableModels]);
  const supportsFileInput = Boolean(selectedModel?.capabilities.vision);
  const contextWindowTokens = resolveModelContextWindowTokens(
    activeModelId,
    selectedModel?.contextWindowTokens,
  );
  const currentTokenUsage = useMemo(
    () => estimateCurrentTokens(messages, input, pendingAttachments),
    [messages, input, pendingAttachments],
  );
  const chatImageGallery = useMemo(
    () => collectChatImageGallery(messages),
    [messages],
  );
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    chatTitleRef.current = chatTitle;
  }, [chatTitle]);

  useEffect(() => {
    // While a turn is in flight, messagesRef is the source of truth for stream updates.
    // Syncing React state back into the ref mid-turn can revive a stale polluted user bubble.
    if (isProcessingRef.current) return;
    messagesRef.current = messages;
  }, [messages]);

  // isProcessingRef is updated synchronously at turn start/end — do not mirror from
  // isProcessing state (that lag was able to reopen the messagesRef sync window mid-turn).

  const clearSubmitQueue = useCallback(() => {
    submitQueueRef.current = [];
    setQueuedSubmitCount(0);
  }, []);

  const handleChatModeChange = useCallback((nextMode: PanelChatMode) => {
    setChatMode(nextMode);
  }, []);

  const handleAgentCapabilityScopeChange = useCallback((nextScope: AiAgentCapabilityScope) => {
    setAgentCapabilityScope(nextScope);
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) return;
    void updateChatSessionMutation.mutateAsync({
      id: sessionId,
      payload: { agentCapabilityScope: nextScope },
    }).catch(() => undefined);
  }, [updateChatSessionMutation]);

  const clearActiveChatSession = useCallback(() => {
    setActiveSessionId(null);
    activeSessionIdRef.current = null;
  }, []);

  const persistChatSession = useCallback(async (
    nextMessages: ChatMessage[],
    options?: { title?: string; sessionId?: number | null },
  ) => {
    if (!currentUserId) return;

    const runPersist = async () => {
      let sessionId = options?.sessionId ?? activeSessionIdRef.current;
      if (!nextMessages.length && !sessionId) return;

      const resolvedTitle = options?.title ?? chatTitleRef.current;
      const payload = {
        title: resolvedTitle,
        modelId: activeModelId || undefined,
        messages: serializeMessagesForStorage(nextMessages),
        agentCapabilityScope: agentCapabilityScopeRef.current,
      };

      if (sessionId) {
        try {
          const session = await updateChatSessionMutation.mutateAsync({ id: sessionId, payload });
          setAgentCapabilityScope({
            packIds: [...session.agentCapabilityScope.packIds],
            mcpServerIds: [...session.agentCapabilityScope.mcpServerIds],
          });
          return;
        } catch (error) {
          if (!isChatSessionNotFoundError(error)) {
            throw error;
          }
          clearActiveChatSession();
          sessionId = null;
        }
      }

      if (!nextMessages.length) return;

      const firstUserMessage = nextMessages.find((message) => message.role === 'user')?.content ?? '';
      const session = await createChatSessionMutation.mutateAsync({
        ...payload,
        title: generateChatTitleFromMessage(firstUserMessage),
      });
      setActiveSessionId(session.id);
      activeSessionIdRef.current = session.id;
      setChatTitle(session.title);
      setTitleDraft(session.title);
      setAgentCapabilityScope({
        packIds: [...session.agentCapabilityScope.packIds],
        mcpServerIds: [...session.agentCapabilityScope.mcpServerIds],
      });
    };

    persistChatSessionChainRef.current = persistChatSessionChainRef.current
      .catch(() => undefined)
      .then(runPersist);
    await persistChatSessionChainRef.current;
  }, [
    activeModelId,
    clearActiveChatSession,
    createChatSessionMutation,
    currentUserId,
    updateChatSessionMutation,
  ]);

  const startNewChat = useCallback(() => {
    clearSubmitQueue();
    setMessages([]);
    messagesRef.current = [];
    setInput('');
    setPendingAttachments([]);
    clearActiveChatSession();
    setActiveVibeProposal(null);
    setAppliedChangeBatch(null);
    setRejectingChangeSetId(null);
    setChatTitle(defaultChatTitle);
    setTitleDraft(defaultChatTitle);
    setIsEditingTitle(false);
    setIsHistoryPanelOpen(false);
    setHistoryFilterQuery('');
    setChatEditConfirm(null);
    setIsHandoffConfirmOpen(false);
    setChatHistoryDeleteTarget(null);
    setAttachedContextResourceIds(
      isVibeStudioPageContext(pageContext)
        ? resolveDefaultAgentContextResourceIds(pageContext)
        : [...DEFAULT_CHAT_CONTEXT_RESOURCE_IDS],
    );
    setChatMode(resolveDefaultChatMode(pageContext));
    setAgentCapabilityScope({
      packIds: [...(defaultAgentCapabilityScope?.packIds ?? DEFAULT_AGENT_CAPABILITY_SCOPE.packIds)],
      mcpServerIds: [...(defaultAgentCapabilityScope?.mcpServerIds ?? [])],
    });
  }, [clearActiveChatSession, defaultAgentCapabilityScope, pageContext, clearSubmitQueue]);

  const restoreLatestApplyId = useCallback(async (sessionId: number) => {
    try {
      const res = await apiFetch(`/api/ai/agent/latest-apply?sessionId=${sessionId}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.applyId === 'number') {
        const items = Array.isArray(data.appliedChanges)
          ? data.appliedChanges.filter((item: AppliedChangeItem) => (
            typeof item?.changeSetId === 'string'
            && typeof item?.label === 'string'
            && typeof item?.kind === 'string'
            && !item.rolledBack
          ))
          : [];
        setAppliedChangeBatch(items.length > 0 ? { applyId: data.applyId, items } : null);
      } else {
        setAppliedChangeBatch(null);
      }
    } catch {
      setAppliedChangeBatch(null);
    }
  }, []);

  const loadChatSession = useCallback(async (sessionId: number) => {
    setIsLoadingSession(true);
    try {
      clearSubmitQueue();
      const session = await fetchAiChatSession(sessionId);
      setActiveSessionId(session.id);
      activeSessionIdRef.current = session.id;
      setChatTitle(session.title);
      setTitleDraft(session.title);
      const restoredMessages = cloneChatMessages(session.messages as ChatMessage[]);
      messagesRef.current = restoredMessages;
      setMessages(restoredMessages);
      if (session.modelId) {
        setSelectedModelId(session.modelId);
      }
      setAgentCapabilityScope({
        packIds: [...session.agentCapabilityScope.packIds],
        mcpServerIds: [...session.agentCapabilityScope.mcpServerIds],
      });
      setIsHistoryPanelOpen(false);
      setIsEditingTitle(false);
      setChatEditConfirm(null);
      setIsHandoffConfirmOpen(false);
      setActiveVibeProposal(null);
      await restoreLatestApplyId(session.id);
    } catch {
      clearActiveChatSession();
    } finally {
      setIsLoadingSession(false);
    }
  }, [clearActiveChatSession, restoreLatestApplyId, clearSubmitQueue]);

  useEffect(() => {
    if (!isOpen || hasRestoredSessionRef.current) return;

    const storedSessionId = initialAppEndooUiState.activeSessionId;
    if (!storedSessionId) return;

    hasRestoredSessionRef.current = true;
    void loadChatSession(storedSessionId);
  }, [isOpen, loadChatSession]);

  const startTitleEdit = useCallback(() => {
    setTitleDraft(chatTitle);
    setIsEditingTitle(true);
  }, [chatTitle]);

  const cancelTitleEdit = useCallback(() => {
    setTitleDraft(chatTitle);
    setIsEditingTitle(false);
  }, [chatTitle]);

  const confirmTitleEdit = useCallback(async () => {
    const nextTitle = titleDraft.trim() || defaultChatTitle;
    setChatTitle(nextTitle);
    setTitleDraft(nextTitle);
    setIsEditingTitle(false);

    if (activeSessionIdRef.current) {
      await updateChatSessionMutation.mutateAsync({
        id: activeSessionIdRef.current,
        payload: { title: nextTitle },
      });
    }
  }, [titleDraft, updateChatSessionMutation]);

  const chatHistoryItems = chatSessionsQuery.data ?? [];

  useEffect(() => {
    if (previousUserIdRef.current !== undefined && previousUserIdRef.current !== currentUserId) {
      startNewChat();
    }
    previousUserIdRef.current = currentUserId;
  }, [currentUserId, startNewChat]);

  const chatPageContext = useMemo(
    () => buildEffectivePageContext(pageContext, attachedContextResourceIds),
    [attachedContextResourceIds, pageContext],
  );

  const agentRunPageContext = useMemo(
    () => resolveAgentRunPageContext(pageContext, attachedContextResourceIds),
    [attachedContextResourceIds, pageContext],
  );

  const chatContextResourceEnv = useMemo<ChatContextResourceEnv>(() => ({
    hasProjectNotes: Boolean(aiSettingsQuery.data?.projectNotes?.trim()),
  }), [aiSettingsQuery.data?.projectNotes]);

  const requestContextResources = useMemo(
    () => resolveChatContextResources(
      chatMode,
      attachedContextResourceIds,
      pageContext,
      chatContextResourceEnv,
    ),
    [attachedContextResourceIds, chatContextResourceEnv, chatMode, pageContext],
  );

  useEffect(() => {
    if (!isOpen || messages.length > 0 || activeSessionId) return;
    setChatMode(resolveDefaultChatMode(pageContext));
    setAttachedContextResourceIds(
      isVibeStudioPageContext(pageContext)
        ? resolveDefaultAgentContextResourceIds(pageContext)
        : [...DEFAULT_CHAT_CONTEXT_RESOURCE_IDS],
    );
  }, [activeSessionId, isOpen, messages.length, pageContext]);

  const applyMaximizedPanelBounds = useCallback(() => {
    const bounds = getMaximizedPanelBounds();
    setPanelPos({ x: bounds.x, y: bounds.y });
    setPanelSize({ width: bounds.width, height: bounds.height });
  }, []);

  const applyDockedPanelBounds = useCallback(() => {
    setPanelSize({ width: dockWidthRef.current, height: window.innerHeight });
  }, []);

  const restorePreDockPanelState = useCallback(() => {
    const saved = preDockPanelStateRef.current;
    if (saved) {
      setPanelPos(saved.pos);
      setPanelSize(saved.size);
      if (saved.wasMaximized) {
        setIsPanelMaximized(true);
        applyMaximizedPanelBounds();
      }
    }
    preDockPanelStateRef.current = null;
    setPanelDockSide('none');
  }, [applyMaximizedPanelBounds]);

  const togglePanelDock = useCallback((side: 'left' | 'right') => {
    if (panelDockSide === side) {
      restorePreDockPanelState();
      return;
    }

    if (panelDockSide === 'none') {
      preDockPanelStateRef.current = {
        pos: { ...panelPos },
        size: { ...panelSize },
        wasMaximized: isPanelMaximized,
      };
      if (isPanelMaximized) {
        setIsPanelMaximized(false);
        preMaximizePanelStateRef.current = null;
      }
    }

    setPanelDockSide(side);
    applyDockedPanelBounds();
  }, [
    applyDockedPanelBounds,
    isPanelMaximized,
    panelDockSide,
    panelPos,
    panelSize,
    restorePreDockPanelState,
  ]);

  const togglePanelMaximize = useCallback(() => {
    if (isSideDocked) return;

    if (isPanelMaximized) {
      const saved = preMaximizePanelStateRef.current;
      if (saved) {
        setPanelPos(saved.pos);
        setPanelSize(saved.size);
      }
      preMaximizePanelStateRef.current = null;
      setIsPanelMaximized(false);
      return;
    }

    preMaximizePanelStateRef.current = {
      pos: { ...panelPos },
      size: { ...panelSize },
    };
    setIsPanelMaximized(true);
    applyMaximizedPanelBounds();
  }, [applyMaximizedPanelBounds, isPanelMaximized, isSideDocked, panelPos, panelSize]);

  const addContextResource = useCallback((id: AiChatContextResourceId) => {
    setAttachedContextResourceIds((current) => (
      current.includes(id) ? current : [...current, id]
    ));
  }, []);

  const removeContextResource = useCallback((id: AiChatContextResourceId) => {
    setAttachedContextResourceIds((current) => current.filter((item) => item !== id));
  }, []);

  useEffect(() => {
    if (!isPanelMaximized) return;

    const handleResize = () => {
      applyMaximizedPanelBounds();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [applyMaximizedPanelBounds, isPanelMaximized]);

  useEffect(() => {
    if (!isOpen || !isDockedLayout) return;

    const handleResize = () => {
      setPanelSize((size) => ({ ...size, width: dockWidthRef.current, height: window.innerHeight }));
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isDockedLayout, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      hasAppliedOpenLayoutRef.current = false;
      preDockPanelStateRef.current = null;
      return;
    }

    if (hasAppliedOpenLayoutRef.current) return;
    hasAppliedOpenLayoutRef.current = true;

    if (isOverlayShell) return;

    if (panelDockSide !== 'none') {
      applyDockedPanelBounds();
      return;
    }

    if (isPanelMaximized) {
      applyMaximizedPanelBounds();
    }
  }, [
    applyDockedPanelBounds,
    applyMaximizedPanelBounds,
    isOverlayShell,
    isOpen,
    isPanelMaximized,
    panelDockSide,
  ]);

  useEffect(() => {
    persistAppEndooUiState({
      dockSide: panelDockSide,
      panelPos,
      panelSize,
      isMaximized: isPanelMaximized,
      activeSessionId,
    });
  }, [activeSessionId, isPanelMaximized, panelDockSide, panelPos, panelSize]);

  useEffect(() => {
    syncAppEndooDockDocumentInsets(effectiveDockSide, effectiveDockWidth);
    return () => {
      clearAppEndooDockDocumentInsets();
    };
  }, [effectiveDockSide, effectiveDockWidth]);

  const canSend = Boolean(input.trim() || pendingAttachments.length)
    && availableModels.length > 0
    && (chatMode === 'ask' || supportsAgentMode);

  const handleDesignerHandoff = useCallback((item: DesignerHandoffPayload) => {
    onClose();
    const mountPrefix = resolveStudioMountPathPrefix(
      pageContext?.path?.trim() || (typeof window !== 'undefined' ? window.location.pathname : '/studio'),
    );
    navigate(buildDesignerHandoffUrl(mountPrefix, item));
  }, [navigate, onClose, pageContext?.path]);

  const handleVibeApply = useCallback(async (
    proposal: { proposalId: string; changeSets: ChangeSet[] },
    options?: { messageIndex?: number; engineeringRouting?: AgentStreamRequestRoutingEvent },
  ): Promise<boolean> => {
    if (shouldBlockPanelAutoApply(options?.engineeringRouting)) {
      setToast({ type: 'warning', text: resolvePanelApplyBlockedReason(options?.engineeringRouting) ?? V1_DIRECT_WRITE_BLOCKED_MESSAGE });
      return false;
    }
    setVibeApplyBusy(true);
    try {
      const res = await apiFetch('/api/ai/agent/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionIdRef.current ?? undefined,
          proposalId: proposal.proposalId,
          changeSets: proposal.changeSets,
          confirmOverrideWarnings: true,
          mode: chatMode === 'plan' ? 'plan' : 'agent',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : t('appendoo.agent.applyFailed'));
      }
      if (chatMode === 'agent' && typeof data.applyId === 'number') {
        const items = Array.isArray(data.appliedChanges)
          ? data.appliedChanges.filter((item: AppliedChangeItem) => (
            typeof item?.changeSetId === 'string'
            && typeof item?.label === 'string'
            && typeof item?.kind === 'string'
            && !item.rolledBack
          ))
          : [];
        setAppliedChangeBatch(items.length > 0 ? { applyId: data.applyId, items } : null);
      }
      setActiveVibeProposal(null);
      const designerHandoff = Array.isArray(data.designerHandoff)
        ? data.designerHandoff.filter((item: DesignerHandoffPayload) => (
          typeof item?.layoutId === 'string'
          && item.layoutId.trim()
          && typeof item?.name === 'string'
          && item.name.trim()
        ))
        : undefined;
      const verification = data.verification && typeof data.verification === 'object'
        && Array.isArray(data.verification.checks)
        && data.verification.checks.length > 0
        ? data.verification as PostApplyVerificationResult
        : undefined;
      const summary = typeof data.summary === 'string' ? data.summary : t('appendoo.agent.applySuccess');
      setMessages((current) => {
        const marked = typeof options?.messageIndex === 'number'
          ? current.map((message, index) => (
            index === options.messageIndex
              ? { ...message, vibeApplied: true, vibeVerification: verification }
              : message
          ))
          : current;
        const next = [...marked, {
          role: 'assistant' as const,
          content: summary,
          designerHandoff: designerHandoff?.length ? designerHandoff : undefined,
          vibeVerification: verification,
        }];
        messagesRef.current = next;
        return next;
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t('appendoo.agent.applyFailed');
      setMessages((current) => [...current, { role: 'assistant', content: `Apply failed: ${message}` }]);
      return false;
    } finally {
      setVibeApplyBusy(false);
    }
  }, [chatMode]);

  const reportPerceivedLatency = useCallback((submitStartedAtMs: number, activityKind: PerceivedActivityKind) => {
    const sample = completePerceivedLatencyTurn(submitStartedAtMs, activityKind);
    void apiFetch('/api/ai/agent/chat-latency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: activeSessionIdRef.current ?? undefined,
        latencyMs: sample.latencyMs,
        activityKind: sample.activityKind,
      }),
    }).catch(() => undefined);
  }, []);

  const handleVibeReject = useCallback((proposal: { proposalId: string; changeSets: ChangeSet[] }) => {
    setActiveVibeProposal(null);
    void apiFetch('/api/ai/agent/proposal-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: activeSessionIdRef.current ?? undefined,
        proposalId: proposal.proposalId,
        changeSetCount: proposal.changeSets.length,
      }),
    }).catch(() => undefined);
    setMessages((current) => [...current, {
      role: 'assistant',
      content: t('appendoo.agent.proposalRejected'),
    }]);
  }, []);

  const handleRevertProposalZone = useCallback((
    messageIndex: number,
    changeSetId: string,
    zone: DiffZone,
  ) => {
    setMessages((current) => current.map((message, index) => {
      if (index !== messageIndex || !message.vibeProposal) {
        return message;
      }

      const changeSets = message.vibeProposal.changeSets.map((changeSet) => {
        if (changeSet.id !== changeSetId || changeSet.kind !== 'file_patch' || !changeSet.beforeContent) {
          return changeSet;
        }

        const content = revertDiffZone(changeSet.beforeContent, changeSet.content, zone);
        const diffZones = computeLineDiffZones(changeSet.beforeContent, content);

        return {
          ...changeSet,
          content,
          diffZones: diffZones.length > 0 ? diffZones : undefined,
        };
      });

      return {
        ...message,
        vibeProposal: {
          ...message.vibeProposal,
          changeSets,
        },
      };
    }));
  }, []);

  const handleSemanticPlanApproval = useCallback(async (bindingId: string, messageIndex: number) => {
    setPlanApprovalBusy(true);
    try {
      const res = await apiFetch('/api/ai/agent/plan-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bindingId, execute: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : t('appendoo.agent.planApprovalFailed'));
      }

      setMessages((current) => current.map((message, index) => {
        if (index !== messageIndex || !message.engineeringPipeline) {
          return message;
        }

        const execution = data.execution && typeof data.execution === 'object'
          ? data.execution as {
            workspaceId?: string;
            revisionId?: string;
            executedNodeCount?: number;
            failedNodeCount?: number;
            reconciledNodeCount?: number;
            verificationRunId?: string;
            deployable?: boolean;
            verificationPassCount?: number;
            verificationFailCount?: number;
            promotionRunId?: string;
            promotionState?: EngineeringPipelineViewModel['promotionState'];
            promotionPreflightOk?: boolean;
            packageSnapshotId?: string;
            packageRoundtripValidated?: boolean;
            runtimeActivatedCount?: number;
            runtimeActivationFailedCount?: number;
            checkpointId?: string;
            changeSetId?: string;
            revisionFingerprint?: string;
            mutationPathCount?: number;
            mutationPathPreview?: string[];
            workspaceStorageKind?: EngineeringPipelineViewModel['workspaceStorageKind'];
            verifiedNodeCount?: number;
            revisionNumber?: number;
            parentRevisionId?: string;
            workspaceState?: EngineeringPipelineViewModel['workspaceState'];
            revisionState?: EngineeringPipelineViewModel['revisionState'];
            workspaceLineageLabel?: string;
            failedRevisionId?: string;
            repairRevisionId?: string;
            repairRevisionNumber?: number;
            changeGraphVerifiedCount?: number;
            changeGraphFailedCount?: number;
            verificationGraderSummary?: EngineeringPipelineViewModel['verificationGraderSummary'];
            designerHandoff?: DesignerHandoffPayload[];
          }
          : undefined;

        const designerHandoff = execution?.designerHandoff?.length
          ? execution.designerHandoff
          : message.designerHandoff;

        const approvalKind = typeof data.approvalKind === 'string' ? data.approvalKind : 'semantic_plan';
        const isPromotionApproval = approvalKind === 'promotion';

        return {
          ...message,
          designerHandoff,
          engineeringPipeline: {
            ...message.engineeringPipeline,
            approvalStatus: isPromotionApproval
              ? message.engineeringPipeline.approvalStatus
              : 'approved',
            promotionApprovalRequired: isPromotionApproval
              ? false
              : message.engineeringPipeline.promotionApprovalRequired,
            promotionApprovalBindingId: isPromotionApproval
              ? undefined
              : message.engineeringPipeline.promotionApprovalBindingId,
            requiresApproval: isPromotionApproval
              ? false
              : message.engineeringPipeline.requiresApproval,
            workspaceId: execution?.workspaceId ?? message.engineeringPipeline.workspaceId,
            revisionId: execution?.revisionId ?? message.engineeringPipeline.revisionId,
            executedNodeCount: execution?.executedNodeCount ?? message.engineeringPipeline.executedNodeCount,
            failedNodeCount: execution?.failedNodeCount ?? message.engineeringPipeline.failedNodeCount,
            reconciledNodeCount: execution?.reconciledNodeCount ?? message.engineeringPipeline.reconciledNodeCount,
            verificationRunId: execution?.verificationRunId ?? message.engineeringPipeline.verificationRunId,
            deployable: execution?.deployable ?? message.engineeringPipeline.deployable,
            verificationPassCount: execution?.verificationPassCount ?? message.engineeringPipeline.verificationPassCount,
            verificationFailCount: execution?.verificationFailCount ?? message.engineeringPipeline.verificationFailCount,
            promotionRunId: execution?.promotionRunId ?? message.engineeringPipeline.promotionRunId,
            promotionState: execution?.promotionState ?? message.engineeringPipeline.promotionState,
            promotionPreflightOk: execution?.promotionPreflightOk ?? message.engineeringPipeline.promotionPreflightOk,
            packageSnapshotId: execution?.packageSnapshotId ?? message.engineeringPipeline.packageSnapshotId,
            packageRoundtripValidated: execution?.packageRoundtripValidated ?? message.engineeringPipeline.packageRoundtripValidated,
            runtimeActivatedCount: execution?.runtimeActivatedCount ?? message.engineeringPipeline.runtimeActivatedCount,
            runtimeActivationFailedCount: execution?.runtimeActivationFailedCount ?? message.engineeringPipeline.runtimeActivationFailedCount,
            checkpointId: execution?.checkpointId ?? message.engineeringPipeline.checkpointId,
            changeSetId: execution?.changeSetId ?? message.engineeringPipeline.changeSetId,
            revisionFingerprint: execution?.revisionFingerprint ?? message.engineeringPipeline.revisionFingerprint,
            mutationPathCount: execution?.mutationPathCount ?? message.engineeringPipeline.mutationPathCount,
            mutationPathPreview: execution?.mutationPathPreview ?? message.engineeringPipeline.mutationPathPreview,
            workspaceStorageKind: execution?.workspaceStorageKind ?? message.engineeringPipeline.workspaceStorageKind,
            verifiedNodeCount: execution?.verifiedNodeCount ?? message.engineeringPipeline.verifiedNodeCount,
            revisionNumber: execution?.revisionNumber ?? message.engineeringPipeline.revisionNumber,
            parentRevisionId: execution?.parentRevisionId ?? message.engineeringPipeline.parentRevisionId,
            workspaceState: execution?.workspaceState ?? message.engineeringPipeline.workspaceState,
            revisionState: execution?.revisionState ?? message.engineeringPipeline.revisionState,
            workspaceLineageLabel: execution?.workspaceLineageLabel ?? message.engineeringPipeline.workspaceLineageLabel,
            failedRevisionId: execution?.failedRevisionId ?? message.engineeringPipeline.failedRevisionId,
            repairRevisionId: execution?.repairRevisionId ?? message.engineeringPipeline.repairRevisionId,
            repairRevisionNumber: execution?.repairRevisionNumber ?? message.engineeringPipeline.repairRevisionNumber,
            changeGraphVerifiedCount: execution?.changeGraphVerifiedCount ?? message.engineeringPipeline.changeGraphVerifiedCount,
            changeGraphFailedCount: execution?.changeGraphFailedCount ?? message.engineeringPipeline.changeGraphFailedCount,
            verificationGraderSummary: execution?.verificationGraderSummary ?? message.engineeringPipeline.verificationGraderSummary,
          },
        };
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('appendoo.agent.planApprovalFailed');
      setMessages((current) => [...current, { role: 'assistant', content: `Plan approval failed: ${message}` }]);
    } finally {
      setPlanApprovalBusy(false);
    }
  }, []);

  const handleRepairRevisionExecute = useCallback(async (messageIndex: number) => {
    const pipeline = messages[messageIndex]?.engineeringPipeline;
    const bindingId = pipeline?.approvalBindingId;
    const workspaceId = pipeline?.workspaceId;
    const repairRevisionId = pipeline?.repairRevisionId;

    if (!bindingId || !workspaceId || !repairRevisionId) {
      setMessages((current) => [...current, {
        role: 'assistant',
        content: t('appendoo.agent.repairRequiresPlan'),
      }]);
      return;
    }

    setRepairExecuteBusy(true);
    try {
      const res = await apiFetch('/api/ai/agent/plan-repair-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bindingId, workspaceId, repairRevisionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : t('appendoo.agent.repairFailed'));
      }

      setMessages((current) => current.map((message, index) => {
        if (index !== messageIndex || !message.engineeringPipeline) {
          return message;
        }

        const execution = data.execution && typeof data.execution === 'object'
          ? data.execution as {
            workspaceId?: string;
            revisionId?: string;
            executedNodeCount?: number;
            failedNodeCount?: number;
            reconciledNodeCount?: number;
            verificationRunId?: string;
            deployable?: boolean;
            verificationPassCount?: number;
            verificationFailCount?: number;
            promotionRunId?: string;
            promotionState?: EngineeringPipelineViewModel['promotionState'];
            promotionPreflightOk?: boolean;
            packageSnapshotId?: string;
            packageRoundtripValidated?: boolean;
            runtimeActivatedCount?: number;
            runtimeActivationFailedCount?: number;
            checkpointId?: string;
            changeSetId?: string;
            revisionFingerprint?: string;
            mutationPathCount?: number;
            mutationPathPreview?: string[];
            workspaceStorageKind?: EngineeringPipelineViewModel['workspaceStorageKind'];
            verifiedNodeCount?: number;
            revisionNumber?: number;
            parentRevisionId?: string;
            workspaceState?: EngineeringPipelineViewModel['workspaceState'];
            revisionState?: EngineeringPipelineViewModel['revisionState'];
            workspaceLineageLabel?: string;
            failedRevisionId?: string;
            repairRevisionId?: string;
            repairRevisionNumber?: number;
            repairReExecuted?: boolean;
            changeGraphVerifiedCount?: number;
            changeGraphFailedCount?: number;
            verificationGraderSummary?: EngineeringPipelineViewModel['verificationGraderSummary'];
          }
          : undefined;

        return {
          ...message,
          engineeringPipeline: {
            ...message.engineeringPipeline,
            workspaceId: execution?.workspaceId ?? message.engineeringPipeline.workspaceId,
            revisionId: execution?.revisionId ?? message.engineeringPipeline.revisionId,
            executedNodeCount: execution?.executedNodeCount ?? message.engineeringPipeline.executedNodeCount,
            failedNodeCount: execution?.failedNodeCount ?? message.engineeringPipeline.failedNodeCount,
            reconciledNodeCount: execution?.reconciledNodeCount ?? message.engineeringPipeline.reconciledNodeCount,
            verificationRunId: execution?.verificationRunId ?? message.engineeringPipeline.verificationRunId,
            deployable: execution?.deployable ?? message.engineeringPipeline.deployable,
            verificationPassCount: execution?.verificationPassCount ?? message.engineeringPipeline.verificationPassCount,
            verificationFailCount: execution?.verificationFailCount ?? message.engineeringPipeline.verificationFailCount,
            promotionRunId: execution?.promotionRunId ?? message.engineeringPipeline.promotionRunId,
            promotionState: execution?.promotionState ?? message.engineeringPipeline.promotionState,
            promotionPreflightOk: execution?.promotionPreflightOk ?? message.engineeringPipeline.promotionPreflightOk,
            packageSnapshotId: execution?.packageSnapshotId ?? message.engineeringPipeline.packageSnapshotId,
            packageRoundtripValidated: execution?.packageRoundtripValidated ?? message.engineeringPipeline.packageRoundtripValidated,
            runtimeActivatedCount: execution?.runtimeActivatedCount ?? message.engineeringPipeline.runtimeActivatedCount,
            runtimeActivationFailedCount: execution?.runtimeActivationFailedCount ?? message.engineeringPipeline.runtimeActivationFailedCount,
            checkpointId: execution?.checkpointId ?? message.engineeringPipeline.checkpointId,
            changeSetId: execution?.changeSetId ?? message.engineeringPipeline.changeSetId,
            revisionFingerprint: execution?.revisionFingerprint ?? message.engineeringPipeline.revisionFingerprint,
            mutationPathCount: execution?.mutationPathCount ?? message.engineeringPipeline.mutationPathCount,
            mutationPathPreview: execution?.mutationPathPreview ?? message.engineeringPipeline.mutationPathPreview,
            workspaceStorageKind: execution?.workspaceStorageKind ?? message.engineeringPipeline.workspaceStorageKind,
            verifiedNodeCount: execution?.verifiedNodeCount ?? message.engineeringPipeline.verifiedNodeCount,
            revisionNumber: execution?.revisionNumber ?? message.engineeringPipeline.revisionNumber,
            parentRevisionId: execution?.parentRevisionId ?? message.engineeringPipeline.parentRevisionId,
            workspaceState: execution?.workspaceState ?? message.engineeringPipeline.workspaceState,
            revisionState: execution?.revisionState ?? message.engineeringPipeline.revisionState,
            workspaceLineageLabel: execution?.workspaceLineageLabel ?? message.engineeringPipeline.workspaceLineageLabel,
            failedRevisionId: execution?.failedRevisionId ?? message.engineeringPipeline.failedRevisionId,
            repairRevisionId: execution?.repairRevisionId ?? message.engineeringPipeline.repairRevisionId,
            repairRevisionNumber: execution?.repairRevisionNumber ?? message.engineeringPipeline.repairRevisionNumber,
            repairReExecuted: execution?.repairReExecuted ?? message.engineeringPipeline.repairReExecuted,
            changeGraphVerifiedCount: execution?.changeGraphVerifiedCount ?? message.engineeringPipeline.changeGraphVerifiedCount,
            changeGraphFailedCount: execution?.changeGraphFailedCount ?? message.engineeringPipeline.changeGraphFailedCount,
            verificationGraderSummary: execution?.verificationGraderSummary ?? message.engineeringPipeline.verificationGraderSummary,
          },
        };
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('appendoo.agent.repairFailed');
      setMessages((current) => [...current, { role: 'assistant', content: `Repair re-execute failed: ${message}` }]);
    } finally {
      setRepairExecuteBusy(false);
    }
  }, [messages]);

  const handleRejectChange = useCallback(async (changeSetId: string) => {
    if (!appliedChangeBatch) return;
    setVibeApplyBusy(true);
    setRejectingChangeSetId(changeSetId);
    try {
      const res = await apiFetch('/api/ai/agent/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionIdRef.current ?? undefined,
          applyId: appliedChangeBatch.applyId,
          changeSetIds: [changeSetId],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : t('appendoo.agent.rejectFailed'));
      }
      const remaining = Array.isArray(data.appliedChanges)
        ? data.appliedChanges.filter((item: AppliedChangeItem) => (
          typeof item?.changeSetId === 'string'
          && typeof item?.label === 'string'
          && !item.rolledBack
        ))
        : appliedChangeBatch.items.filter((item) => item.changeSetId !== changeSetId);
      if (remaining.length === 0 || data.allRolledBack === true) {
        setAppliedChangeBatch(null);
      } else {
        setAppliedChangeBatch({
          applyId: appliedChangeBatch.applyId,
          items: remaining,
        });
      }
      setMessages((current) => [...current, {
        role: 'assistant',
        content: typeof data.summary === 'string' ? data.summary : t('appendoo.agent.rejectSummary'),
      }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('appendoo.agent.rejectFailed');
      setMessages((current) => [...current, { role: 'assistant', content: `Reject changes failed: ${message}` }]);
    } finally {
      setVibeApplyBusy(false);
      setRejectingChangeSetId(null);
    }
  }, [appliedChangeBatch]);

  const handleRevertAppliedZone = useCallback(async (changeSetId: string, zone: FileDiffZone) => {
    if (!appliedChangeBatch) return;
    const zoneId = `${changeSetId}:${zone.startLine}-${zone.endLine}`;
    setVibeApplyBusy(true);
    setRejectingZoneKey(zoneId);
    try {
      const res = await apiFetch('/api/ai/agent/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionIdRef.current ?? undefined,
          applyId: appliedChangeBatch.applyId,
          diffZoneRollbacks: [{ changeSetId, zones: [zone] }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : t('appendoo.agent.zoneRevertFailed'));
      }
      const remaining = Array.isArray(data.appliedChanges)
        ? data.appliedChanges.filter((item: AppliedChangeItem) => (
          typeof item?.changeSetId === 'string'
          && typeof item?.label === 'string'
          && !item.rolledBack
        ))
        : appliedChangeBatch.items;
      if (remaining.length === 0 || data.allRolledBack === true) {
        setAppliedChangeBatch(null);
      } else {
        setAppliedChangeBatch({
          applyId: appliedChangeBatch.applyId,
          items: remaining,
        });
      }
      setMessages((current) => [...current, {
        role: 'assistant',
        content: typeof data.summary === 'string' ? data.summary : t('appendoo.agent.zoneReverted'),
      }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('appendoo.agent.zoneRevertFailed');
      setMessages((current) => [...current, { role: 'assistant', content: `Zone revert failed: ${message}` }]);
    } finally {
      setVibeApplyBusy(false);
      setRejectingZoneKey(null);
    }
  }, [appliedChangeBatch]);

  useEffect(() => {
    if (!selectedModelId && defaultModelId) {
      setSelectedModelId(defaultModelId);
      return;
    }
    if (
      selectedModelId
      && availableModels.length > 0
      && !availableModels.some((model) => model.id === selectedModelId)
    ) {
      setSelectedModelId(defaultModelId);
    }
  }, [availableModels, defaultModelId, selectedModelId]);

  const scrollToBottom = () => {
    if (messagesEndRef.current && messagesEndRef.current.parentElement) {
      messagesEndRef.current.parentElement.scrollTop = messagesEndRef.current.parentElement.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing, isOpen]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isOverlayShell || isSideDocked) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('input, select, button, textarea, option, svg, label, p, h3, [data-panel-resize], [data-panel-dock-resize], [data-chat-title], [data-chat-message], [data-chat-message-menu], [data-chat-handoff], [data-chat-context], [data-panel-maximize], [data-panel-dock]')) {
      return;
    }
    if (isPanelMaximized || isSideDocked) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      right: panelPos.x,
      top: panelPos.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = dragStartRef.current.mouseX - e.clientX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      const newRight = Math.max(10, Math.min(window.innerWidth - panelSize.width - 10, dragStartRef.current.right + deltaX));
      const newTop = Math.max(10, Math.min(window.innerHeight - 120, dragStartRef.current.top + deltaY));

      setPanelPos({ x: newRight, y: newTop });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, panelSize.width]);

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isOverlayShell || isSideDocked) {
      return;
    }
    if (isPanelMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: panelSize.width,
      height: panelSize.height,
      right: panelPos.x,
      top: panelPos.y,
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartRef.current.mouseX;
      const deltaY = e.clientY - resizeStartRef.current.mouseY;

      const maxHeight = window.innerHeight - resizeStartRef.current.top - 10;
      const newWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, resizeStartRef.current.width + deltaX));
      const widthDelta = newWidth - resizeStartRef.current.width;
      const newRight = Math.max(
        10,
        Math.min(window.innerWidth - newWidth - 10, resizeStartRef.current.right - widthDelta),
      );
      const newHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(maxHeight, resizeStartRef.current.height + deltaY));

      setPanelSize({ width: newWidth, height: newHeight });
      setPanelPos((pos) => ({ ...pos, x: newRight }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleDockResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDockedLayout) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDockResizing(true);
    dockResizeStartRef.current = {
      mouseX: e.clientX,
      width: dockWidthRef.current,
    };
  };

  useEffect(() => {
    if (!isDockResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = effectiveDockSide === 'right'
        ? dockResizeStartRef.current.mouseX - e.clientX
        : e.clientX - dockResizeStartRef.current.mouseX;
      const nextWidth = clampAppEndooDockWidth(dockResizeStartRef.current.width + delta);
      dockWidthRef.current = nextWidth;
      setDockWidth(nextWidth);
      setPanelSize((size) => ({ ...size, width: nextWidth }));
    };

    const handleMouseUp = () => {
      setIsDockResizing(false);
      persistAppEndooDockWidth(dockWidthRef.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [effectiveDockSide, isDockResizing]);

  const executeChatTurn = useCallback(async ({
    userMessageIndex,
    baseMessages,
    trimmedInput,
    effectiveChatMode,
    submitContextResources,
    agentPlanActMode: turnPlanActMode,
  }: ChatTurnRequest) => {
    const userTurnSnapshot: ChatMessage = sanitizeUserMessageForUi({
      role: 'user',
      content: trimmedInput,
      attachments: cloneAgentMessageAttachments(baseMessages[userMessageIndex]?.attachments),
    });
    const pinnedBaseMessages = pinUserTurnSnapshot(
      cloneChatMessages(baseMessages),
      userMessageIndex,
      userTurnSnapshot,
    );
    const newMessages = pinnedBaseMessages;
    if (!newMessages.some((message) => message.role === 'user')) {
      return;
    }

    const messagesForApi = newMessages.map((message, index) => (
      index === userMessageIndex && message.role === 'user' ? userTurnSnapshot : message
    ));
    const serializedMessages = messagesForApi
      .filter((message): message is ChatMessage & { role: 'user' | 'assistant' | 'system' } => (
        message.role === 'user' || message.role === 'assistant' || message.role === 'system'
      ))
      .filter((message) => message.content.trim().length > 0 || (message.attachments?.length ?? 0) > 0)
      .map((message) => ({
        role: message.role,
        content: message.content,
        attachments: cloneAgentMessageAttachments(message.attachments),
      }));

    messagesRef.current = pinnedBaseMessages;
    setMessages(pinnedBaseMessages);
    const useStreaming = Boolean(selectedModel?.capabilities.streaming);

    const useAgentStream = effectiveChatMode === 'agent'
      || effectiveChatMode === 'plan'
      || (effectiveChatMode === 'ask' && supportsAgentMode);

    if (useStreaming && effectiveChatMode === 'ask' && !supportsAgentMode) {
      applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => [
        ...prefix,
        { role: 'assistant', content: '', agentThinking: t('appendoo.agent.thinking') },
      ]);
    }

    let finalMessages = newMessages;
    let responseText = '';

    const finalizeTurnMessages = (turnMessages: ChatMessage[]) => (
      enrichAskModeAssistantWithAgentSuggestion(turnMessages, {
        effectiveChatMode,
        userPrompt: trimmedInput,
        supportsAgentMode,
      })
    );

    try {
      if (useAgentStream) {
        let vibePlan: AgentPlanPayload | undefined;
        let vibeProposal: { proposalId: string; changeSets: ChangeSet[] } | undefined;
        let engineeringRouting: AgentStreamRequestRoutingEvent | undefined;
        let engineeringPipeline: AgentStreamEngineeringPipelineEvent | undefined;
        let vibeValidation: { ok: boolean; violations: ProposalViolation[] } | undefined;
        let latestToolSteps: AgentToolStep[] | undefined;
        let turnTelemetry: ChatMessage['turnTelemetry'];

        const agentAssistantMessage: ChatMessage = {
          role: 'assistant',
          content: '',
          toolSteps: [],
          agentThinking: effectiveChatMode === 'plan'
            ? t('appendoo.agent.startingPlan')
            : effectiveChatMode === 'ask'
              ? t('appendoo.agent.investigating')
              : t('appendoo.agent.starting'),
        };

        applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => [
          ...prefix,
          agentAssistantMessage,
        ]);
        setAgentMcpWarnings([]);

        let pipelineDesignerHandoff: DesignerHandoffPayload[] | undefined;

        const result = await streamAiAgentRun(
          {
            mode: effectiveChatMode,
            sessionId: activeSessionIdRef.current ?? undefined,
            messages: newMessages.map((message) => ({
              role: message.role,
              content: message.content,
              attachments: message.attachments?.map((attachment) => ({ ...attachment })),
            })),
            modelId: activeModelId || undefined,
            pageContext: agentRunPageContext,
            contextResources: submitContextResources,
            enabledMcpServerIds: effectiveChatMode === 'agent' ? agentCapabilityScope.mcpServerIds : undefined,
            enabledCapabilityPackIds: effectiveChatMode === 'agent' ? agentCapabilityScope.packIds : undefined,
            agentPlanActMode: effectiveChatMode === 'agent' ? turnPlanActMode : undefined,
          },
          {
            onEvent: (event) => {
              if (event.type === 'turn_profile') {
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => ({
                    ...last,
                    turnProfileLabel: event.label,
                  }))
                ));
              } else if (event.type === 'request_routing') {
                engineeringRouting = event;
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => ({
                    ...last,
                    engineeringRouting: event,
                    toolSteps: archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking),
                    agentThinking: undefined,
                  }))
                ));
              } else if (event.type === 'engineering_pipeline') {
                engineeringPipeline = event;
                if (event.designerHandoff?.length) {
                  pipelineDesignerHandoff = event.designerHandoff;
                }
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => ({
                    ...last,
                    engineeringPipeline: event,
                    toolSteps: archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking),
                    agentThinking: undefined,
                  }))
                ));
              } else if (event.type === 'task_decomposition') {
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => ({
                    ...last,
                    taskDecomposition: event.decomposition,
                    toolSteps: archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking),
                    agentThinking: undefined,
                  }))
                ));
              } else if (event.type === 'change_plan') {
                vibePlan = event.plan;
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => ({
                    ...last,
                    vibePlan: event.plan,
                    toolSteps: archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking),
                    agentThinking: undefined,
                  }))
                ));
              } else if (event.type === 'thinking') {
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => {
                    // Keep prior internal status lines in the timeline (not just the latest).
                    const steps = archiveAgentThinkingIntoSteps(
                      last.toolSteps,
                      last.agentThinking && last.agentThinking !== event.status
                        ? last.agentThinking
                        : undefined,
                    );
                    return {
                      ...last,
                      agentThinking: event.status,
                      toolSteps: steps,
                    };
                  })
                ));
              } else if (event.type === 'tool_start') {
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => {
                    const steps = archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking);
                    const existingIndex = steps.findIndex((step) => step.id === event.toolCallId);
                    const nextStep: AgentToolStep = {
                      id: event.toolCallId,
                      name: event.name,
                      args: event.args,
                      status: 'running',
                      activityTitle: event.activityTitle,
                      intention: event.intention,
                      argsOneLiner: formatAgentActivityArgsOneLiner(event.name, event.args),
                    };
                    if (existingIndex >= 0) {
                      steps[existingIndex] = nextStep;
                    } else {
                      steps.push(nextStep);
                    }
                    latestToolSteps = steps;
                    return { ...last, agentThinking: undefined, toolSteps: steps };
                  })
                ));
              } else if (event.type === 'activity_note') {
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => {
                    const steps = archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking);
                    steps.push({
                      id: `note-${event.noteKind}-${steps.length}`,
                      name: event.noteKind,
                      args: {},
                      status: 'done',
                      activityTitle: event.title,
                      intention: event.detail,
                      argsOneLiner: event.detail,
                    });
                    latestToolSteps = steps;
                    return { ...last, agentThinking: undefined, toolSteps: steps };
                  })
                ));
              } else if (event.type === 'agent_repair') {
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => {
                    const steps = archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking);
                    steps.push({
                      id: `repair-${steps.length}`,
                      name: 'agent_repair',
                      args: {},
                      status: 'running',
                      activityTitle: event.activityTitle,
                      intention: event.intention,
                      argsOneLiner: event.detail,
                    });
                    latestToolSteps = steps;
                    return { ...last, agentThinking: undefined, toolSteps: steps };
                  })
                ));
              } else if (event.type === 'todo_update') {
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => ({
                    ...last,
                    agentTodos: event.todos,
                    toolSteps: archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking),
                    agentThinking: undefined,
                  }))
                ));
              } else if (event.type === 'clarifying_question') {
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => ({
                    ...last,
                    clarifyingQuestion: {
                      question: event.question,
                      options: event.options,
                      reason: event.reason,
                    },
                    content: last.content?.trim()
                      ? `${last.content}\n\n${event.question}`
                      : event.question,
                    toolSteps: archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking),
                    agentThinking: undefined,
                  }))
                ));
              } else if (event.type === 'iteration_limit') {
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => ({
                    ...last,
                    iterationLimitOffer: {
                      message: event.message,
                      iterationCount: event.iterationCount,
                    },
                    content: last.content?.trim() || event.message,
                    toolSteps: archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking),
                    agentThinking: undefined,
                  }))
                ));
              } else if (event.type === 'proposal') {
                vibeProposal = { proposalId: event.proposalId, changeSets: event.changeSets };
                setActiveVibeProposal(vibeProposal);
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => {
                    const steps = archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking).map((step) => (
                      step.name === 'agent_repair' && step.status === 'running'
                        ? { ...step, status: 'done' as const }
                        : step
                    ));
                    latestToolSteps = steps;
                    return {
                      ...last,
                      vibeProposal,
                      agentThinking: undefined,
                      toolSteps: steps,
                    };
                  })
                ));
              } else if (event.type === 'validation_result') {
                vibeValidation = { ok: event.ok, violations: event.violations };
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => ({
                    ...last,
                    vibeValidation,
                    toolSteps: archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking),
                    agentThinking: undefined,
                  }))
                ));
              } else if (event.type === 'tool_result') {
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => {
                    const steps = (last.toolSteps ?? []).map((step) => (
                      step.id === event.toolCallId
                        ? {
                          ...step,
                          status: event.result.ok ? 'done' as const : 'error' as const,
                          result: event.result,
                        }
                        : step
                    ));
                    latestToolSteps = steps;
                    return { ...last, toolSteps: steps };
                  })
                ));
              } else if (event.type === 'mcp_warning') {
                const warningText = `${event.serverLabel}: ${event.message}`;
                setAgentMcpWarnings((current) => (
                  current.includes(warningText) ? current : [...current, warningText]
                ));
              } else if (event.type === 'text_delta') {
                responseText += event.text;
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => ({
                    ...last,
                    toolSteps: archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking),
                    agentThinking: undefined,
                    content: (last.content || '') + event.text,
                  }))
                ));
              } else if (event.type === 'done') {
                turnTelemetry = {
                  tokensEstimate: event.tokensEstimate,
                  tokensBudget: event.tokensBudget,
                  retrievalOperationCount: event.retrievalOperationCount,
                  draftToolCount: event.draftToolCount,
                  iterationCount: event.iterationCount,
                };
                applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                  updateTurnAssistantMessage(prefix, (last) => {
                    const steps = archiveAgentThinkingIntoSteps(last.toolSteps, last.agentThinking);
                    latestToolSteps = steps;
                    return {
                      ...last,
                      turnTelemetry,
                      toolSteps: steps,
                      agentThinking: undefined,
                    };
                  })
                ));
              }
            },
          },
        );

        responseText = result.text || responseText;
        const liveAssistant = messagesRef.current[userMessageIndex + 1];
        const liveToolSteps = liveAssistant?.role === 'assistant'
          ? (liveAssistant.toolSteps ?? latestToolSteps ?? agentAssistantMessage.toolSteps)
          : (latestToolSteps ?? agentAssistantMessage.toolSteps);
        finalMessages = finalizeTurnMessages([...newMessages, {
          role: 'assistant' as const,
          content: responseText,
          toolSteps: liveToolSteps,
          turnProfileLabel: liveAssistant?.role === 'assistant' ? liveAssistant.turnProfileLabel : undefined,
          taskDecomposition: liveAssistant?.role === 'assistant'
            ? liveAssistant.taskDecomposition
            : undefined,
          agentTodos: liveAssistant?.role === 'assistant' ? liveAssistant.agentTodos : undefined,
          vibePlan,
          vibeProposal,
          vibeValidation,
          engineeringRouting,
          engineeringPipeline,
          designerHandoff: pipelineDesignerHandoff,
          turnTelemetry,
        }]);
        const persistedMessages = commitPinnedTurnToRef(
          messagesRef,
          setMessages,
          userMessageIndex,
          userTurnSnapshot,
          finalMessages,
        );

        if (
          effectiveChatMode === 'agent'
          && vibeProposal
          && vibeValidation
          && !proposalHasValidationErrors(vibeValidation)
          && !detectInformationalQuery(trimmedInput)
          && !shouldBlockPanelAutoApply(engineeringRouting)
        ) {
          const autoApplied = await handleVibeApply(vibeProposal, { messageIndex: userMessageIndex + 1, engineeringRouting });
          if (autoApplied) {
            // p-63 — the post-branch commit below rebuilds the turn from `finalMessages`;
            // without carrying the flag there, it wipes handleVibeApply's `vibeApplied`
            // marking and the proposal card re-renders its Reject/Create buttons for an
            // already-applied proposal.
            finalMessages = finalMessages.map((message, index) => (
              index === finalMessages.length - 1 && message.role === 'assistant'
                ? { ...message, vibeApplied: true }
                : message
            ));
          }
        }
      } else if (useStreaming) {
        const result = await sendAiChatStream(
          {
            messages: serializedMessages,
            modelId: activeModelId || undefined,
            sessionId: activeSessionIdRef.current ?? undefined,
            pageContext: chatPageContext,
            contextResources: submitContextResources,
          },
          {
            onDelta: (delta) => {
              responseText += delta;
              applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
                updateTurnAssistantMessage(prefix, (last) => ({
                  ...last,
                  content: responseText,
                  agentThinking: undefined,
                }))
              ));
            },
          },
        );
        responseText = result.text || responseText;
        finalMessages = finalizeTurnMessages([...newMessages, { role: 'assistant', content: responseText }]);
        const persistedMessages = commitPinnedTurnToRef(
          messagesRef,
          setMessages,
          userMessageIndex,
          userTurnSnapshot,
          finalMessages,
        );
      } else {
        const res = await apiFetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: serializedMessages,
            modelId: activeModelId || undefined,
            pageContext: chatPageContext,
            contextResources: submitContextResources,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          responseText = data.text;
          finalMessages = finalizeTurnMessages([...newMessages, { role: 'assistant', content: data.text }]);
        } else if (res.status === 403) {
          finalMessages = [...newMessages, { role: 'assistant', content: 'Error: Admin access is required to use AI chat.' }];
        } else {
          const connectionError = classifyConnectionError(`${res.status} ${data.error || res.statusText || ''}`);
          finalMessages = [...newMessages, { role: 'assistant', content: '', connectionError }];
        }
        const persistedMessages = commitPinnedTurnToRef(
          messagesRef,
          setMessages,
          userMessageIndex,
          userTurnSnapshot,
          finalMessages,
        );
      }

      const persistedMessages = (() => {
        const committed = commitTurnMessages(messagesRef.current, userMessageIndex, finalMessages);
        const next = committed.map((message, index) => (
          index === userMessageIndex ? userTurnSnapshot : message
        ));
        messagesRef.current = next;
        setMessages(next);
        return next;
      })();
      if (persistedMessages.some((message) => message.role === 'user')) {
        const autoTitle = chatTitleRef.current === defaultChatTitle
          ? generateChatTitleFromMessage(trimmedInput)
          : chatTitleRef.current;
        if (autoTitle !== chatTitleRef.current) {
          setChatTitle(autoTitle);
          setTitleDraft(autoTitle);
        }
        await persistChatSession(persistedMessages, { title: autoTitle });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Request failed.';
      const connectionError = classifyConnectionError(message);
      // Keep internal AppEndoo activity on the same bubble — only attach the API error.
      applyPinnedTurnUpdate(messagesRef, setMessages, userMessageIndex, userTurnSnapshot, (prefix) => (
        updateTurnAssistantMessage(prefix, (last) => ({
          ...last,
          connectionError,
          agentThinking: undefined,
          toolSteps: preserveActivityStepsOnConnectionFailure(
            last.toolSteps,
            last.agentThinking,
          ),
        }))
      ));
      const preservedAssistant = messagesRef.current[userMessageIndex + 1];
      finalMessages = [
        ...newMessages,
        preservedAssistant?.role === 'assistant'
          ? preservedAssistant
          : {
            role: 'assistant' as const,
            content: '',
            connectionError,
          },
      ];
      const persistedMessages = (() => {
        const committed = commitTurnMessages(messagesRef.current, userMessageIndex, finalMessages);
        const next = committed.map((entry, index) => (
          index === userMessageIndex ? userTurnSnapshot : entry
        ));
        messagesRef.current = next;
        setMessages(next);
        return next;
      })();
      if (persistedMessages.some((entry) => entry.role === 'user')) {
        await persistChatSession(persistedMessages);
      }
    }
  }, [
    activeModelId,
    agentCapabilityScope.packIds,
    agentCapabilityScope.mcpServerIds,
    agentRunPageContext,
    chatPageContext,
    handleVibeApply,
    persistChatSession,
    selectedModel?.capabilities.streaming,
    sendAiChatStream,
    supportsAgentMode,
  ]);

  const processSubmitQueue = useCallback(async () => {
    if (submitQueueRef.current.length === 0) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    try {
      while (submitQueueRef.current.length > 0) {
        const drained = dequeueSubmitTurn(submitQueueRef.current);
        submitQueueRef.current = drained.queue;
        const next = drained.turn;
        if (!next) break;
        setQueuedSubmitCount(submitQueueRef.current.length);
        const baseMessages = messagesRef.current.slice(0, next.userMessageIndex + 1);
        if (!baseMessages.some((message) => message.role === 'user')) {
          continue;
        }
        await executeChatTurn({ ...next, baseMessages });
      }
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, [executeChatTurn]);

  const submitAgentContinuation = useCallback(async (continuationText: string) => {
    if (availableModels.length === 0 || isProcessingRef.current) return;

    const effectiveChatMode = chatMode;
    const submitContextResources = resolveChatContextResources(
      effectiveChatMode,
      attachedContextResourceIds,
      pageContext,
      chatContextResourceEnv,
    );
    const userTurnSnapshot: ChatMessage = sanitizeUserMessageForUi({
      role: 'user',
      content: continuationText,
    });
    const userMessageIndex = messagesRef.current.length;
    const baseMessages = pinUserTurnSnapshot(
      cloneChatMessages([...messagesRef.current, userTurnSnapshot]),
      userMessageIndex,
      userTurnSnapshot,
    );
    messagesRef.current = baseMessages;
    setMessages(baseMessages);

    const draftTitle = chatTitleRef.current === defaultChatTitle
      ? generateChatTitleFromMessage(continuationText)
      : chatTitleRef.current;
    if (draftTitle !== chatTitleRef.current) {
      setChatTitle(draftTitle);
      setTitleDraft(draftTitle);
    }
    void persistChatSession(baseMessages, { title: draftTitle });

    isProcessingRef.current = true;
    setIsProcessing(true);
    try {
      await executeChatTurn({
        userMessageIndex,
        baseMessages,
        trimmedInput: continuationText,
        effectiveChatMode,
        submitContextResources,
        agentPlanActMode: effectiveChatMode === 'agent' ? agentPlanActModeRef.current : undefined,
      });
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      void processSubmitQueue();
    }
  }, [
    attachedContextResourceIds,
    availableModels.length,
    chatContextResourceEnv,
    chatMode,
    executeChatTurn,
    pageContext,
    persistChatSession,
  ]);

  const handleContinueAgentTurn = useCallback(() => {
    void submitAgentContinuation('continue');
  }, [submitAgentContinuation]);

  const handleClarifyingReply = useCallback((answer: string) => {
    void submitAgentContinuation(answer.trim());
  }, [submitAgentContinuation]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;

    const trimmedInput = input.trim();
    const effectiveChatMode = chatMode;

    const pendingProposal = effectiveChatMode === 'agent'
      ? findPendingVibeProposal(messages)
      : null;
    if (pendingProposal && detectProposalConfirmIntent(trimmedInput)) {
      if (isProcessingRef.current) return;
      const userMessage: ChatMessage = { role: 'user', content: trimmedInput };
      setMessages((current) => [...current, userMessage]);
      setInput('');
      setPendingAttachments([]);
      isProcessingRef.current = true;
      setIsProcessing(true);
      try {
        await handleVibeApply(pendingProposal.proposal, { messageIndex: pendingProposal.messageIndex });
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
        void processSubmitQueue();
      }
      return;
    }

    const submitContextResources = resolveChatContextResources(
      effectiveChatMode,
      attachedContextResourceIds,
      pageContext,
      chatContextResourceEnv,
    );

    const outgoingAttachments = pendingAttachments.map((attachment) => ({ ...attachment }));
    const userTurnSnapshot: ChatMessage = sanitizeUserMessageForUi({
      role: 'user',
      content: trimmedInput,
      attachments: cloneAgentMessageAttachments(
        outgoingAttachments.length ? outgoingAttachments : undefined,
      ),
    });

    if (resolveChatSubmitDispatch(isProcessingRef.current) === 'queue') {
      const submitStartedAt = beginPerceivedLatencyTurn();
      const draftTitle = chatTitleRef.current === defaultChatTitle
        ? generateChatTitleFromMessage(trimmedInput)
        : chatTitleRef.current;
      setMessages((current) => {
        const echoed = appendImmediateUserEcho(current, userTurnSnapshot);
        const next = pinUserTurnSnapshot(
          echoed.nextMessages,
          echoed.userMessageIndex,
          userTurnSnapshot,
        );
        messagesRef.current = next;
        submitQueueRef.current = enqueueSubmitTurn(submitQueueRef.current, {
          userMessageIndex: echoed.userMessageIndex,
          trimmedInput,
          effectiveChatMode,
          submitContextResources,
          agentPlanActMode: effectiveChatMode === 'agent' ? agentPlanActModeRef.current : undefined,
        });
        setQueuedSubmitCount(submitQueueRef.current.length);
        void persistChatSession(next, { title: draftTitle });
        reportPerceivedLatency(submitStartedAt, 'user_echo');
        return next;
      });
      setInput('');
      setPendingAttachments([]);
      return;
    }

    const userMessageIndex = messages.length;
    const submitStartedAt = beginPerceivedLatencyTurn();
    const baseMessages = pinUserTurnSnapshot(
      cloneChatMessages([...messages, userTurnSnapshot]),
      userMessageIndex,
      userTurnSnapshot,
    );
    messagesRef.current = baseMessages;
    setMessages(baseMessages);
    reportPerceivedLatency(submitStartedAt, 'user_echo');
    setInput('');
    setPendingAttachments([]);

    const draftTitle = chatTitleRef.current === defaultChatTitle
      ? generateChatTitleFromMessage(trimmedInput)
      : chatTitleRef.current;
    if (draftTitle !== chatTitleRef.current) {
      setChatTitle(draftTitle);
      setTitleDraft(draftTitle);
    }
    void persistChatSession(baseMessages, { title: draftTitle });

    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      await executeChatTurn({
        userMessageIndex,
        baseMessages,
        trimmedInput,
        effectiveChatMode,
        submitContextResources,
        agentPlanActMode: effectiveChatMode === 'agent' ? agentPlanActModeRef.current : undefined,
      });
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      void processSubmitQueue();
    }
  };

  /**
   * p-102 — Agent-mode-only alternative to `handleSubmit`: hands the turn off to a background job
   * (`/api/agent-tasks`, `agentTaskJobExecutor.ts`) instead of streaming it live. Deliberately a
   * separate, simpler path rather than a branch inside `handleSubmit`/`executeChatTurn` — those
   * carry a lot of machinery (submit queueing, SSE event handling, perceived-latency telemetry)
   * that a fire-and-forget background turn doesn't need. The result comes back later as a
   * notification + a message appended to this same chat session server-side, not through this
   * function — `isProcessing`/the submit queue are untouched so the user can keep chatting
   * normally while the background run is in flight.
   */
  const handleRunInBackground = useCallback(async () => {
    if (!canSend || chatMode !== 'agent' || backgroundTaskSubmitting) return;

    const trimmedInput = input.trim();
    const outgoingAttachments = pendingAttachments.map((attachment) => ({ ...attachment }));
    const userTurnSnapshot: ChatMessage = sanitizeUserMessageForUi({
      role: 'user',
      content: trimmedInput,
      attachments: cloneAgentMessageAttachments(
        outgoingAttachments.length ? outgoingAttachments : undefined,
      ),
    });

    const userMessageIndex = messages.length;
    const baseMessages = pinUserTurnSnapshot(
      cloneChatMessages([...messages, userTurnSnapshot]),
      userMessageIndex,
      userTurnSnapshot,
    );
    messagesRef.current = baseMessages;
    setMessages(baseMessages);
    setInput('');
    setPendingAttachments([]);

    const draftTitle = chatTitleRef.current === defaultChatTitle
      ? generateChatTitleFromMessage(trimmedInput)
      : chatTitleRef.current;
    if (draftTitle !== chatTitleRef.current) {
      setChatTitle(draftTitle);
      setTitleDraft(draftTitle);
    }

    setBackgroundTaskSubmitting(true);
    try {
      // Awaited (unlike the fire-and-forget `persistChatSession` in handleSubmit) because the
      // background job needs a real sessionId up front to write its result back into later.
      await persistChatSession(baseMessages, { title: draftTitle });
      const sessionId = activeSessionIdRef.current ?? undefined;

      const messagesForApi = baseMessages
        .filter((message): message is ChatMessage & { role: 'user' | 'assistant' | 'system' } => (
          message.role === 'user' || message.role === 'assistant' || message.role === 'system'
        ))
        .filter((message) => message.content.trim().length > 0 || (message.attachments?.length ?? 0) > 0)
        .map((message) => ({ role: message.role, content: message.content }));

      const res = await apiFetch('/api/agent-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'agent',
          sessionId,
          messages: messagesForApi,
          modelId: activeModelId || undefined,
          pageContext: agentRunPageContext,
          enabledMcpServerIds: agentCapabilityScope.mcpServerIds,
          enabledCapabilityPackIds: agentCapabilityScope.packIds,
          title: draftTitle,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : t('appendoo.backgroundTask.failed'));
      }

      setMessages((current) => [...current, { role: 'assistant', content: t('appendoo.backgroundTask.queued') }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('appendoo.backgroundTask.failed');
      setMessages((current) => [...current, { role: 'assistant', content: `${t('appendoo.backgroundTask.failed')} ${message}` }]);
    } finally {
      setBackgroundTaskSubmitting(false);
    }
  }, [
    activeModelId,
    agentCapabilityScope.mcpServerIds,
    agentCapabilityScope.packIds,
    agentRunPageContext,
    backgroundTaskSubmitting,
    canSend,
    chatMode,
    input,
    messages,
    pendingAttachments,
    persistChatSession,
  ]);

  const addPendingAttachmentsFromFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const nextAttachments = await filesToAttachments(files);
    if (nextAttachments.length) {
      setPendingAttachments((current) => [...current, ...nextAttachments]);
    }
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles?.length) return;
    await addPendingAttachmentsFromFiles(Array.from(selectedFiles));
    event.target.value = '';
  }, [addPendingAttachmentsFromFiles]);

  const handlePromptPaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!supportsFileInput) return;
    const pastedFiles = collectClipboardFiles(event.clipboardData);
    if (!pastedFiles.length) return;
    event.preventDefault();
    void addPendingAttachmentsFromFiles(pastedFiles);
  }, [addPendingAttachmentsFromFiles, supportsFileInput]);

  const removePendingAttachment = useCallback((attachmentId: string) => {
    setPendingAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  }, []);

  const applyChatMessages = useCallback((nextMessages: ChatMessage[]) => {
    setMessages(nextMessages);
    void persistChatSession(nextMessages);
  }, [persistChatSession]);

  const handleEditMessage = useCallback((messageIndex: number) => {
    if (isProcessing) return;

    const message = messages[messageIndex];
    if (!message || message.role !== 'user') return;

    setInput(message.content);
    setPendingAttachments(message.attachments?.map((attachment) => ({ ...attachment })) ?? []);
    applyChatMessages(messages.slice(0, messageIndex));
  }, [applyChatMessages, isProcessing, messages]);

  const handleConfirmChatEdit = useCallback(() => {
    if (!chatEditConfirm) return;

    let nextMessages: ChatMessage[];
    switch (chatEditConfirm.type) {
      case 'deleteSingle':
        nextMessages = messages.filter((_, index) => index !== chatEditConfirm.messageIndex);
        break;
      case 'truncateAfter':
        nextMessages = messages.slice(0, chatEditConfirm.messageIndex + 1);
        break;
      case 'truncateFrom':
        nextMessages = messages.slice(0, chatEditConfirm.messageIndex);
        break;
      default:
        return;
    }

    setChatEditConfirm(null);
    applyChatMessages(nextMessages);
  }, [applyChatMessages, chatEditConfirm, messages]);

  const handleRequestDeleteChatHistory = useCallback((session: { id: number; title: string }) => {
    setChatHistoryDeleteTarget(session);
  }, []);

  const handleConfirmDeleteChatHistory = useCallback(async () => {
    if (!chatHistoryDeleteTarget) return;

    const { id } = chatHistoryDeleteTarget;
    setChatHistoryDeleteTarget(null);

    try {
      const { response } = await deleteChatSessionMutation.mutateAsync(id);
      if (!response.ok) {
        throw new Error(`Failed to delete chat (HTTP ${response.status}).`);
      }

      if (activeSessionIdRef.current === id) {
        startNewChat();
      }
    } catch {
      setIsHistoryPanelOpen(true);
    }
  }, [chatHistoryDeleteTarget, deleteChatSessionMutation, startNewChat]);

  const handleRequestHandoff = useCallback(() => {
    if (isProcessing || isLoadingSession || messages.length === 0) return;
    setIsHandoffConfirmOpen(true);
  }, [isLoadingSession, isProcessing, messages.length]);

  const handleConfirmHandoff = useCallback(async (mode: ChatHandoffMode) => {
    if (!messages.length) {
      setIsHandoffConfirmOpen(false);
      return;
    }

    const handoffOption = getChatHandoffModeOption(mode, t);

    setIsHandoffConfirmOpen(false);
    setInput('');
    setPendingAttachments([]);
    isProcessingRef.current = true;
    setIsProcessing(true);

    const transcript = buildConversationTranscript(messages);

    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: handoffOption.systemPrompt },
            { role: 'user', content: `Summarize this conversation:\n\n${transcript}` },
          ],
          modelId: activeModelId || undefined,
          pageContext: chatPageContext,
          contextResources: requestContextResources,
        }),
      });

      const data = await res.json().catch(() => ({}));
      let handoffContent = '';
      let connectionError: ClassifiedConnectionError | undefined;

      if (res.ok) {
        handoffContent = typeof data.text === 'string' ? data.text : '';
      } else if (res.status === 403) {
        handoffContent = 'Error: Admin access is required to use AI chat.';
      } else {
        connectionError = classifyConnectionError(`${res.status} ${data.error || res.statusText || ''}`);
      }

      const handoffMessages: ChatMessage[] = [{
        role: 'assistant',
        content: handoffContent
          ? `**${handoffOption.resultTitle}**\n\n${handoffContent}`
          : connectionError
            ? `**${handoffOption.resultTitle}**`
            : `**${handoffOption.resultTitle}**\n\nNo summary content was returned.`,
        connectionError,
      }];

      setMessages(handoffMessages);
      void persistChatSession(handoffMessages);
    } catch (error: any) {
      const connectionError = classifyConnectionError(error?.message ?? 'Request failed.');
      const handoffMessages: ChatMessage[] = [{
        role: 'assistant',
        content: `**${handoffOption.resultTitle}**`,
        connectionError,
      }];
      setMessages(handoffMessages);
      void persistChatSession(handoffMessages);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, [activeModelId, messages, persistChatSession]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
        <motion.aside
          initial={
            isOverlayShell
              ? { opacity: 0, x: isRtl ? -32 : 32, y: -14, scale: 0.98 }
              : isDockedLayout && effectiveDockSide === 'left'
                ? { opacity: 0, x: isRtl ? 48 : -48 }
                : isDockedLayout && effectiveDockSide === 'right'
                  ? { opacity: 0, x: isRtl ? -48 : 48 }
                  : { opacity: 0, scale: 0.95 }
          }
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={
            isOverlayShell
              ? { opacity: 0, x: isRtl ? -24 : 24, y: -10, scale: 0.98 }
              : isDockedLayout && effectiveDockSide === 'left'
                ? { opacity: 0, x: isRtl ? 40 : -40 }
                : isDockedLayout && effectiveDockSide === 'right'
                  ? { opacity: 0, x: isRtl ? -40 : 40 }
                  : { opacity: 0, scale: 0.95 }
          }
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'fixed z-[100] flex flex-col shrink-0 overflow-hidden shadow-2xl',
            AI_PANEL_SURFACE_CLASS,
            isOverlayShell && 'inset-0 rounded-none border-0',
            isDockedLayout && effectiveDockSide === 'left' && 'start-0 top-0 bottom-0 rounded-none border-e border-primary-500/30',
            isDockedLayout && effectiveDockSide === 'right' && 'end-0 top-0 bottom-0 rounded-none border-s border-primary-500/30',
            !isOverlayShell && !isDockedLayout && !isSideDocked && 'rounded-2xl border-[3px] border-primary-500/45',
          )}
          style={
            isOverlayShell
              ? { width: '100%', height: '100dvh' }
              : isDockedLayout && effectiveDockSide === 'left'
                ? {
                    insetInlineStart: 0,
                    top: 0,
                    width: `${effectiveDockWidth}px`,
                    height: '100dvh',
                    cursor: isDockResizing ? 'col-resize' : 'default',
                  }
                : isDockedLayout && effectiveDockSide === 'right'
                  ? {
                      insetInlineEnd: 0,
                      top: 0,
                      width: `${effectiveDockWidth}px`,
                      height: '100dvh',
                      cursor: isDockResizing ? 'col-resize' : 'default',
                    }
                  : {
                      right: `${panelPos.x}px`,
                      top: `${panelPos.y}px`,
                      width: `${panelSize.width}px`,
                      height: `${panelSize.height}px`,
                      cursor: isPanelMaximized
                        ? 'default'
                        : isDragging
                          ? 'grabbing'
                          : isResizing
                            ? 'se-resize'
                            : 'grab',
                    }
          }
          onMouseDown={handleMouseDown}
        >
          {isDockedLayout ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t('appendoo.panel.resizeAria')}
              data-panel-dock-resize
              className={cn(
                AI_PANEL_DOCK_SPLITTER_CLASS,
                effectiveDockSide === 'left' ? 'end-0' : 'start-0',
                isDockResizing && 'bg-primary-500/40',
              )}
              onMouseDown={handleDockResizeMouseDown}
            />
          ) : null}
          <div
            className={cn(
              'flex shrink-0 select-none items-center border-b border-border-subtle px-2',
              AI_PANEL_HEADER_ROW1_SURFACE_CLASS,
              isDockedLayout ? AI_PANEL_MAIN_HEADER_HEIGHT_DOCKED_CLASS : AI_PANEL_MAIN_HEADER_HEIGHT_CLASS,
              !isOverlayShell && !isPanelMaximized && !isSideDocked && 'cursor-grab active:cursor-grabbing',
            )}
          >
            {!isOverlayShell && !isSideDocked ? (
              <GripHorizontal className="pointer-events-none mr-1 h-3 w-3 text-slate-300" />
            ) : null}
            <Bot className="pointer-events-none mr-1.5 h-3 w-3 text-primary-500" />
            <span className="pointer-events-none truncate text-[11px] font-semibold tracking-tight text-slate-800">AppEndoo</span>

            {isProcessing && !messages[messages.length - 1]?.agentThinking ? (
              <div className="ml-auto flex items-center gap-1 text-[10px] font-medium text-amber-600 pointer-events-none">
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                <ThinkingAnimatedLabel />
              </div>
            ) : null}

            <div className={cn('flex items-center gap-0.5', !(isProcessing && !messages[messages.length - 1]?.agentThinking) && 'ml-auto')} data-panel-maximize>
              {!isOverlayShell ? (
                <>
                  <div className="flex items-center gap-1" data-panel-dock>
                    <AppButton
                      type="button"
                      className={getAiPanelDockButtonClassName(panelDockSide === 'left')}
                      aria-label={panelDockSide === 'left' ? t('appendoo.panel.undockLeft') : t('appendoo.panel.dockLeft')}
                      aria-pressed={panelDockSide === 'left'}
                      title={panelDockSide === 'left' ? t('appendoo.panel.undock') : t('appendoo.panel.dockLeft')}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => togglePanelDock('left')}
                    >
                      <PanelLeft className="h-3 w-3" />
                    </AppButton>
                    <AppButton
                      type="button"
                      className={getAiPanelDockButtonClassName(panelDockSide === 'right')}
                      aria-label={panelDockSide === 'right' ? t('appendoo.panel.undockRight') : t('appendoo.panel.dockRight')}
                      aria-pressed={panelDockSide === 'right'}
                      title={panelDockSide === 'right' ? t('appendoo.panel.undock') : t('appendoo.panel.dockRight')}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => togglePanelDock('right')}
                    >
                      <PanelRight className="h-3 w-3" />
                    </AppButton>
                  </div>
                  <span className={AI_PANEL_HEADER_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
                  {!isSideDocked ? (
                    <AppButton
                      type="button"
                      size="icon-sm"
                      className={cn(ICON_ACTION_BUTTON_BASE_CLASS, AI_PANEL_HEADER_ICON_BUTTON_CLASS, ICON_ACTION_CANCEL_CLASS)}
                      aria-label={isPanelMaximized ? t('appendoo.panel.restoreWindow') : t('appendoo.panel.maximizeWindow')}
                      title={isPanelMaximized ? t('appendoo.panel.restore') : t('appendoo.panel.maximize')}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={togglePanelMaximize}
                    >
                      {isPanelMaximized ? (
                        <Minimize2 className="h-3 w-3" />
                      ) : (
                        <Maximize2 className="h-3 w-3" />
                      )}
                    </AppButton>
                  ) : null}
                </>
              ) : null}

              <AppButton
                closeIcon
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onClose}
                aria-label={t('appendoo.panel.closeChat')}
              >
                <X className="h-3 w-3" />
              </AppButton>
            </div>
          </div>

          <div className={cn('min-w-0 overflow-x-hidden border-b pointer-events-auto select-text', AI_PANEL_BORDER_CLASS)}>
            <div
              ref={modelMenuRef}
              className={cn(
                'relative flex min-h-5 items-center gap-1 py-0.5',
                AI_PANEL_HEADER_ROW2_SURFACE_CLASS,
                AI_PANEL_SUBBAR_INSET_CLASS,
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1">
                  <p className="truncate text-[11px] font-semibold leading-3 text-slate-800">
                    {availableModelsQuery.isLoading
                      ? t('appendoo.panel.loadingModels')
                      : selectedModel?.name ?? t('appendoo.panel.noModels')}
                  </p>
                  {selectedModel ? renderCapabilities(selectedModel.capabilities, t, 'xs') : null}
                </div>
              </div>

              <AppButton
                closeIcon
                aria-label={t('appendoo.panel.changeModel')}
                aria-haspopup="listbox"
                aria-expanded={isModelMenuOpen}
                disabled={availableModelsQuery.isLoading || availableModels.length === 0}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setIsModelMenuOpen((open) => !open)}
                className={cn(AI_PANEL_HEADER_ICON_BUTTON_CLASS, 'shrink-0')}
              >
                <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', isModelMenuOpen && 'rotate-180')} />
              </AppButton>

              {isModelMenuOpen && groupedModels.length > 0 ? (
                <div
                  className={cn(SPLIT_BUTTON_DROP_UP_MENU_FIXED_CLASS, 'min-w-[16rem] py-1')}
                  style={modelMenuStyle}
                  role="listbox"
                  aria-label={t('appendoo.panel.availableModels')}
                >
                  {groupedModels.map((group) => (
                    <div key={group.providerLabel}>
                      <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {group.providerLabel}
                      </div>
                      {group.models.map((model) => {
                        const isSelected = model.id === activeModelId;
                        return (
                          <button
                            key={model.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={cn(
                              SPLIT_BUTTON_MENU_ITEM_CLASS,
                              'items-center gap-2 py-2 pl-5 pr-3',
                              isSelected && 'bg-indigo-50 text-indigo-700',
                            )}
                            onClick={() => {
                              setSelectedModelId(model.id);
                              setIsModelMenuOpen(false);
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate font-medium">{model.name}</span>
                            {renderCapabilities(model.capabilities, t, 'xs')}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div
              data-chat-title
              className={cn(
                'relative flex flex-col gap-0.5 border-t border-slate-200',
                AI_PANEL_HEADER_ROW3_SURFACE_CLASS,
              )}
            >
              <div className={cn('flex items-center gap-0.5 pt-0.5', AI_PANEL_SUBBAR_INSET_CLASS)}>
              <div className="min-w-0 flex-1">
                {isEditingTitle ? (
                  <div
                    className="flex min-w-0 items-center gap-1"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <UiInput
                      size="sm"
                      aiAssist={false}
                      autoFocus
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onFocus={(event) => event.currentTarget.select()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void confirmTitleEdit();
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelTitleEdit();
                        }
                      }}
                      className="h-5 min-w-0 flex-1 !h-5 !min-h-5 rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                      ariaLabel={t('appendoo.panel.chatTitle')}
                    />
                    <AppButton
                      type="button"
                      size="icon-sm"
                      className={cn(AI_PANEL_HEADER_ICON_BUTTON_CLASS, ICON_ACTION_CONFIRM_CLASS)}
                      aria-label={t('appendoo.panel.confirmTitle')}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => { void confirmTitleEdit(); }}
                    >
                      <Check className="h-3 w-3" />
                    </AppButton>
                    <AppButton
                      type="button"
                      size="icon-sm"
                      className={cn(AI_PANEL_HEADER_ICON_BUTTON_CLASS, ICON_ACTION_CANCEL_CLASS)}
                      aria-label={t('appendoo.panel.cancelTitleEdit')}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={cancelTitleEdit}
                    >
                      <X className="h-3 w-3" />
                    </AppButton>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="block h-5 w-full truncate rounded px-0.5 text-left text-[11px] font-medium leading-tight text-slate-700 hover:bg-slate-50"
                    title={withCultureVars(t('appendoo.panel.chatTitleRenameHint'), { title: chatTitle })}
                    onDoubleClick={startTitleEdit}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    {chatTitle}
                  </button>
                )}
              </div>

              <AppButton
                closeIcon
                aria-label={t('appendoo.panel.newChat')}
                title={t('appendoo.panel.newChat')}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={startNewChat}
                className={cn(AI_PANEL_HEADER_ICON_BUTTON_CLASS, 'shrink-0')}
              >
                <MessageSquarePlus className="h-3 w-3" />
              </AppButton>

              <AppButton
                closeIcon
                aria-label={t('appendoo.panel.chatHistory')}
                aria-pressed={isHistoryPanelOpen}
                title={t('appendoo.panel.chatHistory')}
                disabled={chatSessionsQuery.isLoading || isLoadingSession}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setIsHistoryPanelOpen((open) => !open)}
                className={cn(
                  AI_PANEL_HEADER_ICON_BUTTON_CLASS,
                  'shrink-0',
                  isHistoryPanelOpen && 'bg-sky-50 text-sky-500 hover:bg-sky-50 hover:text-sky-600',
                )}
              >
                {isLoadingSession ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <History className="h-3 w-3" />
                )}
              </AppButton>
              </div>
            </div>
          </div>

          {isHistoryPanelOpen ? (
              <ChatHistoryPanel
                items={chatHistoryItems}
                activeSessionId={activeSessionId}
                filterQuery={historyFilterQuery}
                onFilterQueryChange={setHistoryFilterQuery}
                isLoading={chatSessionsQuery.isLoading}
                isLoadingSession={isLoadingSession}
                deletePendingId={
                  deleteChatSessionMutation.isPending && typeof deleteChatSessionMutation.variables === 'number'
                    ? deleteChatSessionMutation.variables
                    : null
                }
                onSelectSession={(sessionId) => { void loadChatSession(sessionId); }}
                onRequestDelete={handleRequestDeleteChatHistory}
                onClose={() => setIsHistoryPanelOpen(false)}
              />
            ) : (
          <UiContextChatPanel
            placement="fill"
            placeholder={formatLocalizedQueuedPlaceholder(queuedSubmitCount, t)}
            promptAriaLabel={t('appendoo.prompt.ariaLabel')}
            sendTitle={queuedSubmitCount > 0 && isProcessing ? t('appendoo.prompt.queueMessage') : t('appendoo.prompt.sendMessage')}
            sendAriaLabel={queuedSubmitCount > 0 && isProcessing ? t('appendoo.prompt.queueMessage') : t('appendoo.prompt.sendMessage')}
            models={availableModels.map((model) => ({ id: model.id, name: model.name }))}
            modelId={activeModelId}
            onModelChange={setSelectedModelId}
            modelsLoading={availableModelsQuery.isLoading}
            aiEnabled={availableModelsQuery.data?.enabled ?? availableModels.length > 0}
            disabledBanner=""
            emptyModelsBanner=""
            sending={isProcessing}
            showModelPicker={false}
            showSendingIndicator={false}
            promptValue={input}
            onPromptChange={setInput}
            promptAutoGrow
            promptDisabled={availableModels.length === 0}
            sendDisabled={!canSend}
            promptClassName={cn(AI_PANEL_PROMPT_BOX_CLASS, AI_PANEL_PROMPT_SURFACE_CLASS)}
            promptSurfaceClassName={AI_PANEL_PROMPT_INPUT_SURFACE_CLASS}
            promptFieldClassName="-mx-[7px]"
            footerClassName={cn('min-w-0 overflow-x-hidden pointer-events-auto', AI_PANEL_BORDER_CLASS, AI_PANEL_FOOTER_SURFACE_CLASS)}
            onPromptPaste={handlePromptPaste}
            onPromptPointerDown={(event) => event.stopPropagation()}
            onSubmitPrompt={() => { void handleSubmit(); }}
            bodySlot={messages.length === 0 ? (
              <div className={cn('relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-4 pointer-events-auto select-text', AI_PANEL_BODY_SURFACE_CLASS)}>
                <div className={cn('absolute inset-0 flex flex-col items-center justify-center text-center p-6', AI_PANEL_BODY_SURFACE_CLASS)}>
                  <div className={cn('w-12 h-12 rounded-2xl border shadow-sm flex items-center justify-center mb-4', AI_PANEL_BORDER_CLASS, AI_PANEL_CARD_SURFACE_CLASS)}>
                    <Bot className="w-6 h-6 text-primary-500" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-800 tracking-tight">AppEndoo</h3>
                  <p className="text-xs text-slate-500 mt-2">
                    {t('appendoo.panel.emptyTagline')}
                  </p>
                </div>
              </div>
            ) : (
              <AiPanelMessageList
                messageCount={messages.length}
                className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-4 relative pointer-events-auto select-text', AI_PANEL_BODY_SURFACE_CLASS)}
                renderMessage={(idx) => {
                  const msg = messages[idx];
                  return (
                    <ChatMessageRow
                      key={`msg-${idx}-${msg.role}-${msg.attachments?.map((attachment) => attachment.id).join(',') ?? ''}`}
                      message={msg}
                      messageIndex={idx}
                      isLastMessage={idx === messages.length - 1}
                      isProcessing={isProcessing}
                      galleryImages={chatImageGallery}
                      turnTokenUsage={
                        msg.role === 'assistant' && !(idx === messages.length - 1 && isProcessing)
                          ? (msg.tokenUsage ?? estimateAssistantTurnTokenUsage(messages, idx))
                          : null
                      }
                      turnTelemetry={msg.role === 'assistant' ? msg.turnTelemetry : undefined}
                      userAvatar={userAvatar}
                      onEdit={handleEditMessage}
                      onConfirmAction={setChatEditConfirm}
                      onVibeConfirm={msg.vibeProposal && !msg.vibeApplied
                        ? () => { void handleVibeApply(msg.vibeProposal!, { messageIndex: idx, engineeringRouting: msg.engineeringRouting }); }
                        : undefined}
                      onVibeReject={msg.vibeProposal
                        ? () => { handleVibeReject(msg.vibeProposal!); }
                        : undefined}
                      onRevertProposalZone={msg.vibeProposal
                        ? (changeSetId, zone) => { handleRevertProposalZone(idx, changeSetId, zone); }
                        : undefined}
                      onDesignerHandoff={handleDesignerHandoff}
                      onApproveSemanticPlan={(bindingId, messageIndex) => {
                        void handleSemanticPlanApproval(bindingId, messageIndex);
                      }}
                      onRepairRevisionExecute={(messageIndex) => {
                        void handleRepairRevisionExecute(messageIndex);
                      }}
                      vibeApplyBusy={vibeApplyBusy}
                      planApprovalBusy={planApprovalBusy}
                      repairExecuteBusy={repairExecuteBusy}
                      onContinueAgentTurn={handleContinueAgentTurn}
                      onClarifyingReply={handleClarifyingReply}
                    />
                  );
                }}
              >
                {isProcessing && !(
                  messages[messages.length - 1]?.role === 'assistant'
                  && (
                    messages[messages.length - 1]?.agentThinking
                    || (messages[messages.length - 1]?.toolSteps?.length ?? 0) > 0
                    || messages[messages.length - 1]?.vibePlan
                  )
                ) ? (
                  <div className="flex items-start gap-3 text-xs">
                    <div className={cn('flex h-8 w-8 items-center justify-center shrink-0 rounded-full shadow-sm shadow-slate-300/30', AI_PANEL_ASSISTANT_AVATAR_CLASS)}>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    </div>
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </AiPanelMessageList>
            )}
            footerAbove={chatMode === 'agent' && appliedChangeBatch && appliedChangeBatch.items.length > 0 ? (
              <VibeAppliedChangesFooter
                items={appliedChangeBatch.items}
                onReject={(changeSetId) => { void handleRejectChange(changeSetId); }}
                onRevertZone={(changeSetId, zone) => { void handleRevertAppliedZone(changeSetId, zone); }}
                busy={vibeApplyBusy}
                rejectingChangeSetId={rejectingChangeSetId}
                rejectingZoneKey={rejectingZoneKey}
              />
            ) : null}
            promptAbove={(
              <>
                {supportsFileInput ? (
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.md,.json,.csv"
                    className="hidden"
                    onChange={(event) => {
                      void handleFileChange(event);
                    }}
                  />
                ) : null}
                <div className={cn(
                  'flex flex-col gap-1 px-4',
                  (agentMcpWarnings.length > 0 || pendingAttachments.length > 0) && 'pt-3',
                )}>
                  {agentMcpWarnings.length > 0 ? (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{t('appendoo.mcp.warningsTitle')}</div>
                        <ul className="mt-1 list-disc ps-4">
                          {agentMcpWarnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                  {pendingAttachments.some((attachment) => attachment.kind === 'image' && attachment.previewUrl) ? (
                    <div className="flex flex-wrap gap-3 px-1 pt-1">
                      {pendingAttachments
                        .filter((attachment) => attachment.kind === 'image' && attachment.previewUrl)
                        .map((attachment) => (
                          <PendingImageAttachmentChip
                            key={attachment.id}
                            attachment={attachment}
                            compact={true}
                            onRemove={() => removePendingAttachment(attachment.id)}
                          />
                        ))}
                    </div>
                  ) : null}
                  {pendingAttachments.some((attachment) => attachment.kind !== 'image' || !attachment.previewUrl) ? (
                    <div className="flex flex-wrap gap-2 px-1">
                      {pendingAttachments
                        .filter((attachment) => attachment.kind !== 'image' || !attachment.previewUrl)
                        .map((attachment) => (
                          <PendingFileAttachmentChip
                            key={attachment.id}
                            attachment={attachment}
                            onRemove={() => removePendingAttachment(attachment.id)}
                          />
                        ))}
                    </div>
                  ) : null}
                </div>
              </>
            )}
            promptComposerStart={(
              <ChatContextResourceRow
                pageContext={pageContext}
                resourceEnv={chatContextResourceEnv}
                attachedIds={attachedContextResourceIds}
                onAdd={addContextResource}
                onRemove={removeContextResource}
              />
            )}
            promptToolbarStart={(
              <>
                <ChatModeDropdown mode={chatMode} onChange={handleChatModeChange} compact />
                {chatMode === 'agent' && supportsAgentMode ? (
                  <>
                    <AiPanelPromptToolbarSeparator />
                    <AgentCapabilityDropdown
                      scope={agentCapabilityScope}
                      onChange={handleAgentCapabilityScopeChange}
                      allowedPacks={allowedCapabilityPacks}
                      enabledMcpServers={enabledMcpServers}
                      disabled={availableModels.length === 0}
                      compact
                    />
                    <AiPanelPromptToolbarSeparator />
                    <AgentPlanActToggle
                      mode={agentPlanActMode}
                      onChange={setAgentPlanActMode}
                      disabled={availableModels.length === 0}
                    />
                  </>
                ) : null}
              </>
            )}
            promptToolbarEnd={(
              <>
                {chatMode !== 'plan' ? (
                  <>
                    <ChatTokenIndicator
                      usedTokens={currentTokenUsage}
                      limitTokens={contextWindowTokens}
                      onHandoffClick={handleRequestHandoff}
                      disabled={isLoadingSession || messages.length === 0}
                    />
                    <AiPanelPromptToolbarSeparator />
                  </>
                ) : null}
                {supportsFileInput ? (
                  <>
                    <AppButton
                      type="button"
                      size="icon-sm"
                      className={cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-5 w-5 min-h-0 min-w-0 rounded', ICON_ACTION_CANCEL_CLASS)}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={availableModels.length === 0}
                      aria-label={t('appendoo.prompt.addFile')}
                    >
                      <Plus className="h-3 w-3" />
                    </AppButton>
                    <AiPanelPromptToolbarSeparator />
                  </>
                ) : null}
                {chatMode === 'agent' && supportsAgentMode ? (
                  <>
                    <AppButton
                      type="button"
                      size="icon-sm"
                      className={cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-5 w-5 min-h-0 min-w-0 rounded', ICON_ACTION_CANCEL_CLASS)}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => { void handleRunInBackground(); }}
                      disabled={!canSend || backgroundTaskSubmitting}
                      aria-label={t('appendoo.backgroundTask.trigger')}
                      title={t('appendoo.backgroundTask.trigger')}
                    >
                      {backgroundTaskSubmitting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                    </AppButton>
                    <AiPanelPromptToolbarSeparator />
                  </>
                ) : null}
              </>
            )}
            promptBelow={(chatMode === 'agent' || chatMode === 'plan') && !supportsAgentMode ? (
              <p className="ps-[4px] text-[11px] text-amber-700">
                {withCultureVars(t('appendoo.mode.selectToolsModel'), {
                  mode: chatMode === 'plan' ? t('appendoo.mode.plan') : t('appendoo.mode.agent'),
                })}
              </p>
            ) : null}
            sendButtonClassName={cn(
              ICON_ACTION_BUTTON_BASE_CLASS,
              'h-5 w-5 min-h-0 min-w-0 shrink-0 rounded bg-indigo-600 text-white hover:bg-indigo-700',
              'disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400',
            )}
          />
            )}

          {!isPanelMaximized && !isOverlayShell && !isSideDocked ? (
          <div
            data-panel-resize
            className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize"
            onMouseDown={handleResizeMouseDown}
            aria-hidden
          >
            <svg viewBox="0 0 16 16" className="h-full w-full text-slate-300" fill="currentColor">
              <path d="M14 14h-2v-2h2v2zm-4 0h-2v-2h2v2zm-4 0H4v-2h2v2zm8-4h-2V8h2v2zm-4 0h-2V8h2v2zm-4 0H4V8h2v2z" />
            </svg>
          </div>
          ) : null}
        </motion.aside>

          <ChatEditConfirmModal
            action={chatEditConfirm}
            messageCount={messages.length}
            onCancel={() => setChatEditConfirm(null)}
            onConfirm={handleConfirmChatEdit}
          />
          <ChatHandoffConfirmModal
            isOpen={isHandoffConfirmOpen}
            messageCount={messages.length}
            onCancel={() => setIsHandoffConfirmOpen(false)}
            onConfirm={(mode) => { void handleConfirmHandoff(mode); }}
          />
          <ChatHistoryDeleteConfirmModal
            session={chatHistoryDeleteTarget}
            onCancel={() => setChatHistoryDeleteTarget(null)}
            onConfirm={() => { void handleConfirmDeleteChatHistory(); }}
          />
        </>
      )}
    </AnimatePresence>
  );
};

/** @deprecated Use AppEndooPanel */
export { AppEndooPanel as AiPanel };
