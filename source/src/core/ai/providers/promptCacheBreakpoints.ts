import type { ChatWithToolsMessage } from '../IAiProvider';

/**
 * Rolling prompt-cache breakpoint selection for agent loops.
 *
 * Strategy (mirrors the production scheme in vscode-copilot-chat `cacheBreakpoints.ts`):
 * the provider spends one breakpoint on the system prompt (tools render before it, so a
 * system breakpoint caches the tool definitions too); the remaining budget goes, walking
 * backwards from the newest message, to:
 *  - the last tool result of each tool-call round (cache hits *during* the agentic loop,
 *    where the same prefix is re-sent on every iteration), and
 *  - user messages / terminal assistant messages (cache hits across turns).
 *
 * A cache miss at the start of a brand-new turn is expected and accepted; the wins are the
 * per-iteration hits inside a turn, which dominate request volume in agent mode.
 */
export const computeCacheBreakpointIndexes = (
  messages: ChatWithToolsMessage[],
  maxBreakpoints: number,
): Set<number> => {
  const flagged = new Set<number>();
  if (maxBreakpoints <= 0) return flagged;

  let remaining = maxBreakpoints;
  let sawUserMessage = false;

  for (let index = messages.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'system' || !message.content?.trim()) continue;

    const nextMessage = messages[index + 1];
    const isLastToolResultInRound = message.role === 'tool' && nextMessage?.role !== 'tool';
    const isTerminalAssistantMessage = message.role === 'assistant'
      && !('toolCalls' in message && message.toolCalls?.length);
    const isCurrentTurnAnchor = !sawUserMessage && (isLastToolResultInRound || message.role === 'user');

    if (isCurrentTurnAnchor || (sawUserMessage && (isTerminalAssistantMessage || isLastToolResultInRound))) {
      flagged.add(index);
      remaining -= 1;
    }

    if (message.role === 'user') {
      sawUserMessage = true;
    }
  }

  return flagged;
};
