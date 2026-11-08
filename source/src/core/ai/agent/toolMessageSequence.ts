import type { AgentMessage } from './types';

const isToolTurnAssistant = (message: AgentMessage | undefined): boolean => (
  message?.role === 'assistant' && Boolean(message.toolCalls?.length)
);

/**
 * Ensures OpenAI-compatible ordering: every `tool` message follows an `assistant`
 * message whose `tool_calls` includes its `toolCallId`.
 */
export const repairToolMessageSequence = (messages: AgentMessage[]): AgentMessage[] => {
  const repaired: AgentMessage[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;

    if (message.role === 'assistant' && message.toolCalls?.length) {
      const toolMessages: AgentMessage[] = [];
      let nextIndex = index + 1;
      while (nextIndex < messages.length && messages[nextIndex]?.role === 'tool') {
        toolMessages.push(messages[nextIndex]!);
        nextIndex += 1;
      }

      const toolById = new Map(
        toolMessages
          .filter((toolMessage) => toolMessage.toolCallId)
          .map((toolMessage) => [toolMessage.toolCallId as string, toolMessage]),
      );
      const pairedCalls = message.toolCalls.filter((call) => toolById.has(call.id));
      const pairedTools = pairedCalls.map((call) => toolById.get(call.id)!);

      if (pairedCalls.length > 0) {
        repaired.push({
          ...message,
          toolCalls: pairedCalls,
          content: message.content ?? '',
        });
        repaired.push(...pairedTools);
      } else if (message.content?.trim()) {
        repaired.push({ role: 'assistant', content: message.content });
      }

      index = nextIndex - 1;
      continue;
    }

    if (message.role === 'tool') {
      continue;
    }

    repaired.push(message);
  }

  return repaired;
};

/** Tail-slice without starting on orphan `tool` messages or splitting tool turns. */
export const sliceAgentMessagesForContext = (
  messages: AgentMessage[],
  maxMessages: number,
): AgentMessage[] => {
  const repaired = repairToolMessageSequence(messages);
  if (repaired.length <= maxMessages) {
    return repaired;
  }

  let start = repaired.length - maxMessages;
  while (start < repaired.length && repaired[start]?.role === 'tool') {
    start += 1;
  }

  if (start > 0 && isToolTurnAssistant(repaired[start])) {
    let toolEnd = start + 1;
    while (toolEnd < repaired.length && repaired[toolEnd]?.role === 'tool') {
      toolEnd += 1;
    }
    const turnLength = toolEnd - start;
    if (turnLength > maxMessages) {
      return repaired.slice(start, start + turnLength);
    }
  }

  return repairToolMessageSequence(repaired.slice(start));
};
