import { describe, expect, it } from 'vitest';
import {
  appendAgentModeSuggestionIfNeeded,
  buildAgentModeSwitchSuggestion,
  enrichAskModeAssistantWithAgentSuggestion,
} from '../agentModeSwitchSuggestion';

describe('buildAgentModeSwitchSuggestion', () => {
  it('returns English copy for implementation prompts', () => {
    expect(buildAgentModeSwitchSuggestion('Build a CRUD with a grid')).toContain('**Agent** mode');
  });

  it('returns English copy for English prompts', () => {
    expect(buildAgentModeSwitchSuggestion('Create a server function for sum')).toContain('**Agent** mode');
  });
});

describe('appendAgentModeSuggestionIfNeeded', () => {
  it('appends a footer when not already mentioned', () => {
    const next = appendAgentModeSuggestionIfNeeded('Here is the plan.', 'Build a form');
    expect(next).toContain('---');
    expect(next).toContain('**Agent** mode');
  });

  it('skips duplicate agent-mode mentions', () => {
    const content = 'Please switch to Agent mode to continue.';
    expect(appendAgentModeSuggestionIfNeeded(content, 'build a form')).toBe(content);
  });
});

describe('enrichAskModeAssistantWithAgentSuggestion', () => {
  it('enriches ask-mode assistant replies for implementation prompts', () => {
    const enriched = enrichAskModeAssistantWithAgentSuggestion(
      [
        { role: 'user', content: 'Create a server function' },
        { role: 'assistant', content: 'I can guide you.' },
      ],
      {
        effectiveChatMode: 'ask',
        userPrompt: 'Create a server function',
        supportsAgentMode: true,
      },
    );

    expect(enriched[1]?.content).toContain('**Agent** mode');
  });

  it('does not enrich agent-mode replies', () => {
    const messages = [
      { role: 'user', content: 'Create a server function' },
      { role: 'assistant', content: 'Starting draft.' },
    ];
    const enriched = enrichAskModeAssistantWithAgentSuggestion(messages, {
      effectiveChatMode: 'agent',
      userPrompt: 'Create a server function',
      supportsAgentMode: true,
    });
    expect(enriched).toEqual(messages);
  });
});
