import { shouldSuggestAgentModeHandoff } from './detectCodingIntent';

const AGENT_MODE_ALREADY_MENTIONED = /agent\s*mode|switch\s+to\s+agent/i;

const AGENT_MODE_SUGGESTION = 'If you would like me to implement this in the platform, switch to **Agent** mode using the menu below.';

export const buildAgentModeSwitchSuggestion = (_userText: string): string => AGENT_MODE_SUGGESTION;

export const appendAgentModeSuggestionIfNeeded = (
  assistantContent: string,
  userText: string,
): string => {
  const trimmedAssistant = assistantContent.trim();
  if (!trimmedAssistant) return assistantContent;
  if (AGENT_MODE_ALREADY_MENTIONED.test(trimmedAssistant)) {
    return assistantContent;
  }

  const suggestion = buildAgentModeSwitchSuggestion(userText);
  return `${trimmedAssistant}\n\n---\n\n${suggestion}`;
};

export const enrichAskModeAssistantWithAgentSuggestion = <T extends { role: string; content: string }>(
  messages: readonly T[],
  options: {
    effectiveChatMode: 'ask' | 'agent' | 'plan';
    userPrompt: string;
    supportsAgentMode: boolean;
  },
): T[] => {
  if (options.effectiveChatMode !== 'ask' || !options.supportsAgentMode) {
    return [...messages];
  }
  if (!shouldSuggestAgentModeHandoff(options.userPrompt)) {
    return [...messages];
  }

  const lastIndex = messages.length - 1;
  const last = messages[lastIndex];
  if (!last || last.role !== 'assistant') {
    return [...messages];
  }
  if (/^(Error:|Connection Failed:)/.test(last.content.trim())) {
    return [...messages];
  }

  const content = appendAgentModeSuggestionIfNeeded(last.content, options.userPrompt);
  if (content === last.content) {
    return [...messages];
  }

  return [
    ...messages.slice(0, lastIndex),
    { ...last, content },
  ];
};
