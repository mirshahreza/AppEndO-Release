import type { BuildContextPackInput } from '../../../shared/api/contracts/appendoo/contextPack.types';
import type { AppEndooSemanticPlan } from '../../../shared/api/contracts/appendoo/semanticPlan.types';
import { compileChangeGraphFromPlan } from '../../../shared/lib/appendoo/changeGraphCompiler';
import {
  buildSemanticPlan,
  buildSemanticPlanScaffold,
  summarizeSemanticPlan,
} from '../../../shared/lib/appendoo/semanticPlanBuilder';
import { contextIntelligenceService } from './contextIntelligence.service';
import { enrichContextPackForServerFunctionUiPlanning } from '../../../shared/lib/appendoo/serverFunctionUiPlanner';
import { ChangeGraphCompileForbiddenError } from '../../../shared/lib/appendoo/changeGraphCompiler';

export class SemanticPlanningService {
  buildPlanFromContextInput(input: BuildContextPackInput): {
    contextPack: ReturnType<typeof contextIntelligenceService.buildRunContextPack>;
    plan: AppEndooSemanticPlan;
    planSummary: ReturnType<typeof summarizeSemanticPlan>;
    changeGraph: ReturnType<typeof compileChangeGraphFromPlan>;
  } {
    const contextPack = enrichContextPackForServerFunctionUiPlanning(
      contextIntelligenceService.buildRunContextPack({
        applicationScope: input.applicationScope,
        pageContext: input.pageContext,
        userPrompt: input.userPrompt,
        correlationId: input.correlationId,
        intentId: input.intentId,
      }),
    );
    const plan = buildSemanticPlan({
      applicationScope: input.applicationScope,
      contextPack,
      userPrompt: input.userPrompt,
      intentId: input.intentId,
    });
    let changeGraph;
    try {
      changeGraph = compileChangeGraphFromPlan(plan);
    } catch (error) {
      if (!(error instanceof ChangeGraphCompileForbiddenError)) {
        throw error;
      }
      changeGraph = undefined;
    }

    return {
      contextPack,
      plan,
      planSummary: summarizeSemanticPlan(plan),
      changeGraph,
    };
  }
}

export const semanticPlanningService = new SemanticPlanningService();
