import type { IAiProvider } from '../IAiProvider';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../shared/api/contracts/ai/constants';
import { HISTORY_SUMMARY_MAX_CHARS, summarizeHistorySegment } from './contextAssembly';
import type { AgentMessage, AgentRunConfig } from './types';

const SEGMENT_H_SYSTEM = [
  'Compress prior chat turns into a concise briefing for the assistant.',
  'Preserve user goals, decisions, file paths, tool outcomes, and open tasks.',
  'Output plain text only — no markdown headings.',
].join(' ');

/** C.4 — also summarize when estimated context nears the per-run token budget. */
const CONTEXT_SUMMARY_TOKEN_PRESSURE_RATIO = 0.72;

/** p-61 Phase C — per-message char cap when building the LLM condenser source. */
const LLM_SUMMARY_SOURCE_MESSAGE_MAX_CHARS = 4_000;
/** Total source cap sent to the condenser model (chars). */
const LLM_SUMMARY_SOURCE_TOTAL_MAX_CHARS = 80_000;
/** LLM summaries get room for real detail — heuristic fallback keeps the tighter legacy cap. */
export const LLM_HISTORY_SUMMARY_MAX_CHARS = 8_000;

/**
 * p-61 Phase C (C1) — the condenser now reads real message content (bounded per message),
 * not the 240-char metadata slices the heuristic uses. Summarizing pre-truncated snippets
 * produced summaries that lost exactly the file contents and tool outcomes the model
 * needed to keep working.
 */
const buildLlmSummarySource = (messages: AgentMessage[]): string => {
  const parts: string[] = [];
  let total = 0;
  for (const message of messages) {
    const label = message.role === 'tool'
      ? `[tool:${message.name ?? 'result'}]`
      : `[${message.role}]`;
    const body = message.content.length > LLM_SUMMARY_SOURCE_MESSAGE_MAX_CHARS
      ? `${message.content.slice(0, LLM_SUMMARY_SOURCE_MESSAGE_MAX_CHARS)}…[truncated]`
      : message.content;
    const entry = `${label} ${body}`;
    if (total + entry.length > LLM_SUMMARY_SOURCE_TOTAL_MAX_CHARS) break;
    parts.push(entry);
    total += entry.length;
  }
  return parts.join('\n');
};

export const summarizeHistoryWithLlm = async (
  messages: AgentMessage[],
  provider: IAiProvider,
  maxChars = LLM_HISTORY_SUMMARY_MAX_CHARS,
): Promise<string> => {
  const source = buildLlmSummarySource(messages);
  const prompt = [
    `Compress the following conversation excerpt to at most ${maxChars} characters.`,
    'Keep concrete names, paths, code decisions, tool outcomes, and unresolved questions.',
    '',
    source,
  ].join('\n');

  const text = (await provider.chat([{ role: 'user', content: prompt }], SEGMENT_H_SYSTEM)).trim();
  if (!text) {
    throw new Error('LLM segment H summary was empty.');
  }
  if (text.length > maxChars) {
    return `${text.slice(0, maxChars)}…`;
  }
  return text;
};

/**
 * p-61 Phase C — compaction is token-pressure-driven only. The old message-count trigger
 * (24 messages) fired a few tool calls into any real task and threw away working memory the
 * budget still had room for; flat history until ~72% of budget is the Claude Code contract.
 */
export const shouldBuildSegmentHistorySummary = (
  messages: AgentMessage[],
  _config: AgentRunConfig,
  options?: { tokensEstimate?: number; tokensBudget?: number },
): boolean => {
  const nonSystem = messages.filter((message) => message.role !== 'system');
  const tokensEstimate = options?.tokensEstimate ?? 0;
  const tokensBudget = options?.tokensBudget ?? 0;
  if (tokensBudget > 0 && tokensEstimate / tokensBudget >= CONTEXT_SUMMARY_TOKEN_PRESSURE_RATIO) {
    return nonSystem.length >= 4;
  }

  return false;
};

/** Floor on the verbatim tail kept alongside a summary — see contextAssembly's matching floor. */
export const SEGMENT_TAIL_MIN_MESSAGES = 24;

export const sliceMessagesForSegmentHistory = (
  messages: AgentMessage[],
  config: AgentRunConfig,
): { historyMessages: AgentMessage[]; tailMessages: AgentMessage[] } => {
  const agentSettings = config.agentSettings ?? DEFAULT_AI_AGENT_SETTINGS;
  const workingTurns = config.contextWorkingTurns ?? agentSettings.contextWorkingTurns ?? 8;
  const turnCount = Math.max(SEGMENT_TAIL_MIN_MESSAGES, workingTurns * 2);
  const nonSystem = messages.filter((message) => message.role !== 'system');
  const splitAt = Math.max(0, nonSystem.length - turnCount);
  return {
    historyMessages: nonSystem.slice(0, splitAt),
    tailMessages: nonSystem.slice(splitAt),
  };
};

/** Resolve segment H — persisted summary, LLM (TOK-15), or heuristic fallback. */
export const resolveSegmentHistorySummary = async (
  messages: AgentMessage[],
  config: AgentRunConfig,
  options?: { provider?: IAiProvider; force?: boolean },
): Promise<string | undefined> => {
  // `force` — the orchestrator already measured token pressure when it scheduled this build;
  // re-deriving pressure here (without token figures) would wrongly skip the summary.
  if (!options?.force && !shouldBuildSegmentHistorySummary(messages, config)) {
    return config.persistedHistorySummary?.trim() || undefined;
  }

  const { historyMessages } = sliceMessagesForSegmentHistory(messages, config);
  if (historyMessages.length === 0) {
    return config.persistedHistorySummary?.trim() || undefined;
  }

  const agentSettings = config.agentSettings ?? DEFAULT_AI_AGENT_SETTINGS;
  if (agentSettings.contextSummarizeWithLlm && options?.provider) {
    try {
      return await summarizeHistoryWithLlm(historyMessages, options.provider);
    } catch {
      // fall through to heuristic
    }
  }

  return summarizeHistorySegment(historyMessages);
};
