import fs from 'fs';
import path from 'path';

import { DEFAULT_AI_SETTINGS } from '../src/shared/api/contracts/ai/constants';

const SETTINGS_EXAMPLE_PATH = path.join(process.cwd(), 'settings.example.json');

const example = JSON.parse(fs.readFileSync(SETTINGS_EXAMPLE_PATH, 'utf8')) as Record<string, unknown>;
const ai = DEFAULT_AI_SETTINGS;

example.ai = {
  enabled: ai.enabled,
  defaultModelId: ai.defaultModelId,
  chatRateLimitPerMinute: ai.chatRateLimitPerMinute,
  models: ai.models.map((model) => {
    const entry: Record<string, unknown> = {
      id: model.id,
      name: model.name,
      provider: model.provider,
      providerLabel: model.providerLabel,
      modelId: model.modelId,
      enabled: model.enabled,
      capabilities: { ...model.capabilities },
    };
    if (model.isDefault) entry.isDefault = true;
    if (model.baseUrl) entry.baseUrl = model.baseUrl;
    if (model.apiVersion) entry.apiVersion = model.apiVersion;
    if (model.deploymentName) entry.deploymentName = model.deploymentName;
    if (model.contextWindowTokens !== undefined) entry.contextWindowTokens = model.contextWindowTokens;
    if (model.maxOutputTokens !== undefined) entry.maxOutputTokens = model.maxOutputTokens;
    if (model.temperatureDefault !== undefined) entry.temperatureDefault = model.temperatureDefault;
    if (model.timeoutMs !== undefined) entry.timeoutMs = model.timeoutMs;
    if (model.note) entry.note = model.note;
    return entry;
  }),
  providers: ai.providers.map((provider) => {
    const entry: Record<string, unknown> = {
      provider: provider.provider,
      providerLabel: provider.providerLabel,
    };
    if (provider.baseUrl) entry.baseUrl = provider.baseUrl;
    return entry;
  }),
  agent: ai.agent,
  mcp: ai.mcp,
  mcpServers: ai.mcpServers,
  webSearch: ai.webSearch,
  http: ai.http,
};

fs.writeFileSync(SETTINGS_EXAMPLE_PATH, `${JSON.stringify(example, null, 2)}\n`);
console.log(`Synced ${ai.models.length} models to settings.example.json`);
