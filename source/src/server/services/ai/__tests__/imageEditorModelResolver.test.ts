import { describe, expect, it } from 'vitest';
import { resolveImageEditorOutputModel } from '../imageEditorModelResolver';
import type { AiModelEntry, AiSettings } from '../../../../shared/api/contracts/ai/types';
import { DEFAULT_AI_CAPABILITIES } from '../../../../shared/api/contracts/ai/constants';
import { HttpError } from '../../../errors/HttpError';

const baseModel = (overrides: Partial<AiModelEntry>): AiModelEntry => ({
  id: 'test-model',
  name: 'Test Model',
  provider: 'openai',
  modelId: 'gpt-4o',
  enabled: true,
  capabilities: { ...DEFAULT_AI_CAPABILITIES, chat: true, vision: true },
  ...overrides,
});

const baseSettings = (models: AiModelEntry[]): AiSettings => ({
  enabled: true,
  defaultModelId: models[0]?.id ?? '',
  chatRateLimitPerMinute: 60,
  models,
  providers: [{ provider: 'openai', apiKey: 'test-key' }],
  agent: { enabled: false, defaultMode: 'agent', capabilityScope: 'full', allowedPacks: [] },
  mcp: { enabled: false, servers: [] },
  mcpServers: [],
  http: { enabled: false, allowedHosts: [] },
  webSearch: { enabled: false, provider: 'brave' },
});

describe('resolveImageEditorOutputModel', () => {
  it('uses gpt-5.5 directly when it is the requested model', () => {
    const gpt55 = baseModel({
      id: 'gpt-5.5',
      name: 'GPT-5.5',
      modelId: 'gpt-5.5',
      capabilities: { ...DEFAULT_AI_CAPABILITIES, chat: true, vision: true, imageGeneration: true },
    });

    const resolved = resolveImageEditorOutputModel(baseSettings([gpt55]), 'gpt-5.5');

    expect(resolved.entry.id).toBe('gpt-5.5');
    expect(resolved.usedFallback).toBe(false);
  });

  it('uses gpt-4o directly because it supports Responses image editing', () => {
    const gpt4o = baseModel({ id: 'gpt-4o', name: 'GPT-4o', modelId: 'gpt-4o' });

    const resolved = resolveImageEditorOutputModel(baseSettings([gpt4o]), 'gpt-4o');

    expect(resolved.entry.id).toBe('gpt-4o');
    expect(resolved.usedFallback).toBe(false);
  });

  it('falls back from text-only model to gpt-5.5', () => {
    const textOnlyModel = baseModel({
      id: 'gpt-3.5',
      name: 'GPT-3.5',
      modelId: 'gpt-3.5-turbo',
      capabilities: { ...DEFAULT_AI_CAPABILITIES, chat: true },
    });
    const imageModel = baseModel({
      id: 'gpt-5.5',
      name: 'GPT-5.5',
      modelId: 'gpt-5.5',
      capabilities: { ...DEFAULT_AI_CAPABILITIES, chat: true, vision: true, imageGeneration: true },
    });

    const resolved = resolveImageEditorOutputModel(
      baseSettings([textOnlyModel, imageModel]),
      'gpt-3.5',
    );

    expect(resolved.entry.id).toBe('gpt-5.5');
    expect(resolved.usedFallback).toBe(true);
    expect(resolved.requestedName).toBe('GPT-3.5');
  });

  it('throws when no image-editing model exists', () => {
    const textOnlyModel = baseModel({
      id: 'gpt-3.5',
      name: 'GPT-3.5',
      modelId: 'gpt-3.5-turbo',
      capabilities: { ...DEFAULT_AI_CAPABILITIES, chat: true },
    });

    expect(() => resolveImageEditorOutputModel(baseSettings([textOnlyModel]), 'gpt-3.5')).toThrow(HttpError);
  });
});
