import { describe, expect, it } from 'vitest';
import type { AiModelEntry } from '../../api/contracts/ai/types';
import {
  AGENT_MODEL_PRIORITY_IDS,
  resolvePreferredAgentModelId,
  shouldAutoUpgradeAgentModel,
} from '../resolvePreferredAgentModel';

const model = (id: string, enabled = true): AiModelEntry => ({
  id,
  name: id,
  provider: 'openai',
  modelId: id,
  enabled,
  capabilities: {
    chat: true,
    streaming: true,
    vision: false,
    tools: true,
    embeddings: false,
    imageGeneration: false,
    speechToText: false,
    textToSpeech: false,
  },
});

describe('resolvePreferredAgentModelId', () => {
  it('picks first enabled model from priority list', () => {
    const models = [
      model('gemini-2-5-flash'),
      model('anthropic-claude-sonnet-4-6'),
      model('openai-gpt-4-1'),
    ];
    expect(resolvePreferredAgentModelId(models, 'gemini-2-5-flash')).toBe('anthropic-claude-sonnet-4-6');
    expect(AGENT_MODEL_PRIORITY_IDS.length).toBeGreaterThan(3);
  });

  it('falls back when no tools-capable model is enabled', () => {
    expect(resolvePreferredAgentModelId([], 'gemini-2-5-flash')).toBe('gemini-2-5-flash');
  });

  it('auto-upgrade heuristic flags default flash selection', () => {
    expect(shouldAutoUpgradeAgentModel(undefined, 'gemini-2-5-flash')).toBe(true);
    expect(shouldAutoUpgradeAgentModel('anthropic-claude-sonnet-5', 'gemini-2-5-flash')).toBe(false);
  });
});
