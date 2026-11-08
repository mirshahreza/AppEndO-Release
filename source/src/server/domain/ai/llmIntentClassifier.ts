import { aiManager } from '../../../core/ai/AiManager';
import { aiModelGateway } from '../../../core/ai/gateway/AiModelGatewayAdapter';
import type { AgentMode } from '../../../shared/api/contracts/ai/agentTypes';
import type {
  AssistantTurnProfile,
  LlmAssistantIntentClass,
} from '../../../shared/api/contracts/ai/appendooGateway.types';
import {
  GOVERNED_INTENT_COMPILE_SYSTEM,
  GovernedIntentCompileSchema,
  type GovernedIntentCompileResult,
} from '../../../shared/api/contracts/ai/intentCompile.types';
import { detectGovernedEngineeringIntent } from '../../../shared/lib/detectCodingIntent';
import { resolveFastClassifierModelId } from '../../../shared/lib/resolvePreferredAgentModel';

export type { LlmAssistantIntentClass };

const VALID_CLASSES = new Set<LlmAssistantIntentClass>([
  'engineering_change',
  'engineering_query',
  'operational_action',
  'governed_engineering',
  'continuation',
  'general_chat',
]);

const LLM_INTENT_SYSTEM = [
  'Classify the user message into exactly one AppEndO assistant intent label.',
  'Reply with ONE token only — no punctuation or explanation.',
  'Labels:',
  '- engineering_change — implement/fix/build code, UI, server functions, drafts',
  '- engineering_query — explain architecture, how/where questions, no mutation',
  '- operational_action — jobs, webhooks, index rebuild, platform tasks',
  '- governed_engineering — explicit architect approval, package export, promotion',
  '- continuation — continue/retry after prior implementation offer',
  '- general_chat — greetings, capabilities, unrelated chat',
  '',
  'Examples:',
  'User: Add validation to users form → engineering_change',
  'User: Explain how server functions register → engineering_query',
  'User: Export to package with architect approval → governed_engineering',
  'User: try again → continuation',
].join('\n');

const CLASSIFIER_TIMEOUT_MS = 2_500;

export const parseLlmIntentClass = (raw: string): LlmAssistantIntentClass | null => {
  const token = raw.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z_]/g, '') ?? '';
  return VALID_CLASSES.has(token as LlmAssistantIntentClass)
    ? token as LlmAssistantIntentClass
    : null;
};

/** V4 E.1 — cheap LLM intent pass; returns null on failure (caller falls back to regex). */
export const classifyAssistantIntentWithLlm = async (
  userPrompt: string,
  preferredModelId?: string,
): Promise<LlmAssistantIntentClass | null> => {
  const trimmed = userPrompt.trim();
  if (trimmed.length < 4) return null;

  try {
    const settings = aiManager.getSettings();
    if (!settings?.enabled) return null;

    const modelId = resolveFastClassifierModelId(
      settings.models,
      preferredModelId?.trim() || settings.defaultModelId,
    );
    const { provider } = aiManager.resolveModel(modelId);
    const raw = await Promise.race([
      provider.chat([{ role: 'user', content: trimmed }], LLM_INTENT_SYSTEM),
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('intent_classifier_timeout')), CLASSIFIER_TIMEOUT_MS);
      }),
    ]);
    return parseLlmIntentClass(raw);
  } catch {
    return null;
  }
};

export const applyLlmIntentToExecutionProfile = (
  profile: AssistantTurnProfile,
  llmClass: LlmAssistantIntentClass | null,
  mode: AgentMode,
): AssistantTurnProfile => {
  if (mode !== 'agent' || !llmClass || profile === 'agent_plan_review') return profile;

  switch (llmClass) {
    case 'engineering_change':
    case 'continuation':
      return 'agent_implement';
    case 'governed_engineering':
      return 'agent_implement_governed';
    case 'engineering_query':
    case 'general_chat':
      return 'agent_lookup';
    default:
      return profile;
  }
};

export const shouldRunGovernedStructuredIntent = (
  userPrompt: string,
  executionProfile?: AssistantTurnProfile,
  llmLightClass?: LlmAssistantIntentClass | null,
): boolean => (
  executionProfile === 'agent_implement_governed'
  || llmLightClass === 'governed_engineering'
  || detectGovernedEngineeringIntent(userPrompt)
);

/** V4-PATCH-5 P5.3 — structured intent compile for governed path only. */
export const classifyGovernedIntentStructured = async (
  userPrompt: string,
  preferredModelId?: string,
): Promise<GovernedIntentCompileResult | null> => {
  const trimmed = userPrompt.trim();
  if (!detectGovernedEngineeringIntent(trimmed)) {
    return null;
  }

  try {
    const settings = aiManager.getSettings();
    if (!settings?.enabled) return null;

    const modelId = resolveFastClassifierModelId(
      settings.models,
      preferredModelId?.trim() || settings.defaultModelId,
    );

    const result = await aiModelGateway.invokeStructured({
      messages: [{ role: 'user', content: trimmed }],
      modelId,
      taskProfile: 'INTENT_COMPILE',
      systemContext: GOVERNED_INTENT_COMPILE_SYSTEM,
      schema: GovernedIntentCompileSchema,
      maxAttempts: 2,
    });

    return result.data;
  } catch {
    return null;
  }
};

export const mergeGovernedStructuredIntent = (
  llmClass: LlmAssistantIntentClass | null,
  structured: GovernedIntentCompileResult | null,
): LlmAssistantIntentClass | null => {
  if (!structured?.governed) {
    return llmClass;
  }
  return 'governed_engineering';
};
