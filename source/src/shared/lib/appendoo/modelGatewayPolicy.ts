import type {
  AiTaskProfile,
  EffectiveModelCapabilities,
  ModelGatewayCapabilityRequirement,
  ModelGatewayTaskProfilePolicy,
} from '../../api/contracts/ai/appendooGateway.types';

const DEFAULT_POLICY: Omit<ModelGatewayTaskProfilePolicy, 'taskProfile'> = {
  requiredCapabilities: ['chat'],
  maxAttempts: 2,
  timeoutMs: 60_000,
};

/** AE-2.2 — task profile routing policy (Phase 03). */
export const MODEL_GATEWAY_TASK_PROFILE_POLICIES: Record<AiTaskProfile, ModelGatewayTaskProfilePolicy> = {
  GENERAL_CHAT: { taskProfile: 'GENERAL_CHAT', ...DEFAULT_POLICY },
  PAGE_CONTEXT_QUERY: { taskProfile: 'PAGE_CONTEXT_QUERY', ...DEFAULT_POLICY },
  TOOL_SESSION: {
    taskProfile: 'TOOL_SESSION',
    requiredCapabilities: ['chat', 'tools'],
    maxAttempts: 2,
    timeoutMs: 90_000,
  },
  INTENT_COMPILE: { taskProfile: 'INTENT_COMPILE', ...DEFAULT_POLICY, maxAttempts: 3 },
  CODE_SUMMARY: { taskProfile: 'CODE_SUMMARY', ...DEFAULT_POLICY },
  PLAN: { taskProfile: 'PLAN', ...DEFAULT_POLICY, maxAttempts: 3 },
  WORKER_DATABASE: { taskProfile: 'WORKER_DATABASE', ...DEFAULT_POLICY },
  WORKER_SERVER: { taskProfile: 'WORKER_SERVER', ...DEFAULT_POLICY },
  WORKER_UI: { taskProfile: 'WORKER_UI', ...DEFAULT_POLICY },
  WORKER_SECURITY: { taskProfile: 'WORKER_SECURITY', ...DEFAULT_POLICY },
  SEMANTIC_GRADE: { taskProfile: 'SEMANTIC_GRADE', ...DEFAULT_POLICY, maxAttempts: 2 },
};

export const getTaskProfilePolicy = (taskProfile: AiTaskProfile): ModelGatewayTaskProfilePolicy => (
  MODEL_GATEWAY_TASK_PROFILE_POLICIES[taskProfile]
);

const hasCapability = (
  capabilities: EffectiveModelCapabilities,
  requirement: ModelGatewayCapabilityRequirement,
): boolean => {
  switch (requirement) {
    case 'chat':
      return capabilities.declaredChat;
    case 'tools':
      return capabilities.effectiveTools;
    case 'streaming':
      return capabilities.effectiveStreaming;
  }
};

export const validateTaskProfileCapabilities = (
  taskProfile: AiTaskProfile,
  capabilities: EffectiveModelCapabilities,
): { ok: true } | { ok: false; errors: string[] } => {
  const policy = getTaskProfilePolicy(taskProfile);
  const errors = policy.requiredCapabilities
    .filter((requirement) => !hasCapability(capabilities, requirement))
    .map((requirement) => `Model ${capabilities.modelId} missing required capability: ${requirement}.`);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
};

export const estimateTokenCount = (text: string): number => Math.max(1, Math.ceil(text.length / 4));
