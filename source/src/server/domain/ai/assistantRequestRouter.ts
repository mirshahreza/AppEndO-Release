import type {
  AiTaskProfile,
  AssistantRequestClass,
  AssistantRequestRouting,
  AssistantRequestRoutingInput,
} from '../../../shared/api/contracts/ai/appendooGateway.types';
import { APPENDOO_ROUTER_VERSION } from '../../../shared/api/contracts/ai/appendooGateway.types';
import {
  detectGovernedEngineeringIntent,
  detectOperationalActionIntent,
} from '../../../shared/lib/detectCodingIntent';
import type { LlmAssistantIntentClass } from '../../../shared/api/contracts/ai/appendooGateway.types';

const hasPageContext = (pageContext: AssistantRequestRoutingInput['pageContext']): boolean => (
  Boolean(
    pageContext?.path?.trim()
    || pageContext?.pageLabel?.trim()
    || pageContext?.pageKey?.trim()
    || pageContext?.functionId?.trim()
    || pageContext?.layoutId?.trim()
    || pageContext?.entityType?.trim(),
  )
);

const mapProfileToTask = (
  requestClass: AssistantRequestClass,
  executionProfile: AssistantRequestRoutingInput['executionProfile'],
): AiTaskProfile => {
  if (requestClass === 'ENGINEERING_CHANGE') return 'INTENT_COMPILE';
  if (executionProfile === 'plan_authoring') return 'PLAN';
  if (requestClass === 'CONTEXT_QUERY') return 'PAGE_CONTEXT_QUERY';
  if (requestClass === 'TOOL_QUERY') return 'TOOL_SESSION';
  return 'GENERAL_CHAT';
};

/**
 * Deterministic assistant request router (AE-2 skeleton).
 * Model classification MUST NOT grant tools — mode + profile + policy only.
 */
export const routeAssistantRequest = (
  input: AssistantRequestRoutingInput,
): AssistantRequestRouting => {
  const { mode, executionProfile, pageContext, userPrompt } = input;
  const trimmed = userPrompt.trim();
  const contextual = hasPageContext(pageContext);

  if (mode === 'ask') {
    const requestClass: AssistantRequestClass = contextual ? 'CONTEXT_QUERY' : 'TOOL_QUERY';
    return {
      requestClass,
      taskProfile: mapProfileToTask(requestClass, executionProfile),
      routerVersion: APPENDOO_ROUTER_VERSION,
      routingReason: contextual
        ? 'Ask mode with page context — bounded read-only retrieval'
        : 'Ask mode — governed read-only tool session',
      confidence: 0.95,
      requiresClarification: false,
      useEngineeringPipeline: false,
    };
  }

  if (mode === 'plan') {
    return {
      requestClass: 'ENGINEERING_QUERY',
      taskProfile: 'PLAN',
      routerVersion: APPENDOO_ROUTER_VERSION,
      routingReason: 'Plan mode — plan document authoring without live mutation',
      confidence: 0.95,
      requiresClarification: false,
      useEngineeringPipeline: false,
    };
  }

  // Agent mode
  const llmClass = input.llmIntentClass ?? null;

  if (llmClass === 'operational_action' || (!llmClass && detectOperationalActionIntent(trimmed))) {
    return {
      requestClass: 'OPERATIONAL_ACTION',
      taskProfile: 'TOOL_SESSION',
      routerVersion: APPENDOO_ROUTER_VERSION,
      routingReason: 'Agent mode operational action — jobs/tasks/webhooks without engineering pipeline',
      confidence: 0.9,
      requiresClarification: !trimmed,
      useEngineeringPipeline: false,
    };
  }

  if (executionProfile === 'agent_plan_review') {
    return {
      requestClass: 'ENGINEERING_QUERY',
      taskProfile: 'TOOL_SESSION',
      routerVersion: APPENDOO_ROUTER_VERSION,
      routingReason: 'Agent plan-review — retrieve and narrate without draft tools',
      confidence: 0.9,
      requiresClarification: false,
      useEngineeringPipeline: false,
    };
  }

  if (executionProfile === 'agent_implement_governed') {
    return {
      requestClass: 'ENGINEERING_CHANGE',
      taskProfile: 'INTENT_COMPILE',
      routerVersion: APPENDOO_ROUTER_VERSION,
      routingReason: 'Agent mode — governed engineering profile (V3 pipeline, approval required)',
      confidence: 0.95,
      requiresClarification: !trimmed,
      useEngineeringPipeline: true,
    };
  }

  if (executionProfile === 'agent_implement') {
    const governed = llmClass === 'governed_engineering'
      || (!llmClass && detectGovernedEngineeringIntent(trimmed));
    return {
      requestClass: 'ENGINEERING_CHANGE',
      taskProfile: governed ? 'INTENT_COMPILE' : 'TOOL_SESSION',
      routerVersion: APPENDOO_ROUTER_VERSION,
      routingReason: governed
        ? 'Agent mode with governed engineering intent — V3 pipeline (approval required)'
        : 'Agent mode with implementation intent — direct agent-loop (draft tools)',
      confidence: 0.9,
      requiresClarification: !trimmed,
      useEngineeringPipeline: governed,
    };
  }

  if (contextual && (llmClass === 'engineering_query' || !llmClass)) {
    return {
      requestClass: 'ENGINEERING_QUERY',
      taskProfile: 'PAGE_CONTEXT_QUERY',
      routerVersion: APPENDOO_ROUTER_VERSION,
      routingReason: 'Agent lookup with page context — read-only engineering intelligence',
      confidence: 0.85,
      requiresClarification: false,
      useEngineeringPipeline: false,
    };
  }

  return {
    requestClass: 'ENGINEERING_QUERY',
    taskProfile: 'GENERAL_CHAT',
    routerVersion: APPENDOO_ROUTER_VERSION,
    routingReason: 'Agent lookup — no implementation signals detected',
    confidence: 0.8,
    requiresClarification: false,
    useEngineeringPipeline: false,
  };
};
