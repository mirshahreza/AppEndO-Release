import type { AgentMode } from '../../../shared/api/contracts/ai/agentTypes';
import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import type { AssistantRequestRouting, EffectiveModelCapabilities, LlmAssistantIntentClass } from '../../../shared/api/contracts/ai/appendooGateway.types';
import type { ApplicationScopeRef } from '../../../shared/api/contracts/appendoo/applicationScope.types';
import type { TurnExecutionProfile } from '../../../core/ai/agent/turnExecutionProfile';
import { routeAssistantRequest } from '../../domain/ai/assistantRequestRouter';
import { resolveApplicationScope } from '../../domain/appendoo/applicationScopeResolver';
import { aiModelGateway } from '../../../core/ai/gateway/AiModelGatewayAdapter';

export type AppendooRunRoutingInput = {
  mode: AgentMode;
  userPrompt: string;
  executionProfile: TurnExecutionProfile;
  pageContext?: AiPageContext;
  modelId?: string;
  correlationId?: string;
  ownerPackageId?: string | null;
  packageId?: string | null;
  llmIntentClass?: LlmAssistantIntentClass | null;
};

export type AppendooRunRoutingResult = {
  routing: AssistantRequestRouting;
  applicationScope: ApplicationScopeRef | null;
  modelCapabilities: EffectiveModelCapabilities | null;
  taskProfilePolicyOk: boolean;
  taskProfilePolicyErrors: string[];
};

export class AppendooGatewayService {
  resolveRunRouting(input: AppendooRunRoutingInput): AppendooRunRoutingResult {
    const routing = routeAssistantRequest({
      mode: input.mode,
      userPrompt: input.userPrompt,
      executionProfile: input.executionProfile,
      pageContext: input.pageContext,
      correlationId: input.correlationId,
      llmIntentClass: input.llmIntentClass,
    });

    const applicationScope = resolveApplicationScope({
      path: input.pageContext?.path,
      pageKey: input.pageContext?.pageKey,
      packageId: input.packageId,
      ownerPackageId: input.ownerPackageId,
    });

    let modelCapabilities: EffectiveModelCapabilities | null = null;
    let taskProfilePolicyOk = true;
    let taskProfilePolicyErrors: string[] = [];
    try {
      modelCapabilities = aiModelGateway.getEffectiveCapabilities(input.modelId);
      const validation = aiModelGateway.validateForTaskProfile(routing.taskProfile, input.modelId);
      taskProfilePolicyOk = validation.ok;
      taskProfilePolicyErrors = validation.ok ? [] : validation.errors;
    } catch {
      // Model may be resolved later by orchestrator; routing does not require capabilities.
    }

    return {
      routing,
      applicationScope,
      modelCapabilities,
      taskProfilePolicyOk,
      taskProfilePolicyErrors,
    };
  }
}

export const appendooGatewayService = new AppendooGatewayService();
