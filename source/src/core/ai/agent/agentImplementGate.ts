import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import type { TurnExecutionProfile } from './turnExecutionProfile';
import { harnessShouldActivate, isPlanReviewProfile } from './turnExecutionProfile';
import {
  applyRetrieveToolCall,
  buildRetrieveBundleGateMessage,
  EMPTY_RETRIEVE_FLAGS,
  isRetrieveBundleSatisfied,
  resolveRetrieveBundleRequirement,
  type RetrieveBundleFlags,
  type RetrieveBundleRequirement,
} from './retrieveBundle';
import type { ToolResult } from './types';

const isDraftToolName = (toolName: string): boolean => toolName.startsWith('draft_');

export type AgentImplementPhase = 'draft' | 'finalize';

export type AgentImplementGateDecision = {
  allowed: boolean;
  reason?: string;
  phase: AgentImplementPhase;
};

/** AE-22.7 — agent implement gate; retrieve satisfaction requires real agent tool calls (GAP-9). */
export class AgentImplementGate {
  private planEmitted = false;
  private repairAttempts = 0;
  private draftToolUsed = false;
  private readonly agentRetrieved: RetrieveBundleFlags = { ...EMPTY_RETRIEVE_FLAGS };
  private readonly requirement: RetrieveBundleRequirement;

  constructor(
    private readonly executionProfile: TurnExecutionProfile,
    pageContext?: AiPageContext | null,
    userIntent = '',
  ) {
    this.requirement = resolveRetrieveBundleRequirement(pageContext, userIntent);
  }

  isActive(): boolean {
    return harnessShouldActivate(this.executionProfile);
  }

  /**
   * p-61 Phase B — the only hard block left is the Plan/Act review toggle, which is an
   * explicit user decision. The retrieve-bundle checklist no longer denies draft_* calls:
   * erroring the model's own edit tool burned iterations and taught it to give up. Retrieve
   * guidance lives in the system prompt; `getRetrieveAdvisory()` exposes the missing-bundle
   * message for observability only.
   */
  checkPreToolUse(toolName: string): AgentImplementGateDecision {
    if (isPlanReviewProfile(this.executionProfile) && isDraftToolName(toolName)) {
      return {
        allowed: false,
        phase: 'draft',
        reason: 'Plan/Act review — retrieve and narrate only. The user must confirm execution or switch to Implement before drafting.',
      };
    }

    return { allowed: true, phase: 'draft' };
  }

  /** Advisory-only view of the old retrieve gate — never blocks, used for telemetry. */
  getRetrieveAdvisory(): string | null {
    if (!this.isActive() || this.isAgentRetrieveSatisfied()) return null;
    return buildRetrieveBundleGateMessage(this.requirement, this.agentRetrieved);
  }

  recordToolResult(
    toolName: string,
    _result: ToolResult,
    args?: Record<string, unknown>,
  ): void {
    if (isDraftToolName(toolName)) {
      this.draftToolUsed = true;
      return;
    }

    const next = applyRetrieveToolCall(this.agentRetrieved, toolName, args, this.requirement.standardsShard);
    Object.assign(this.agentRetrieved, next);
  }

  shouldEmitPlan(): boolean {
    return this.isActive() && !this.planEmitted;
  }

  markPlanEmitted(): void {
    this.planEmitted = true;
  }

  /** True only after agent retrieve tools (or after a draft already started — stops retrieve nudges). */
  isRetrieveSatisfied(): boolean {
    return this.isAgentRetrieveSatisfied() || this.draftToolUsed;
  }

  getAgentRetrievedFlags(): Readonly<RetrieveBundleFlags> {
    return this.agentRetrieved;
  }

  private isAgentRetrieveSatisfied(): boolean {
    return isRetrieveBundleSatisfied(this.agentRetrieved, this.requirement);
  }

  enterFinalize(): void {
    // no-op — finalize handled by AgentOrchestrator proposal builder
  }

  canAttemptRepair(): boolean {
    // p-61 Phase B — was 2; a hard-capped repair loop abandoned nearly-valid proposals.
    // The iteration budget in the orchestrator remains the real bound.
    return this.repairAttempts < 5;
  }

  recordRepairAttempt(): void {
    this.repairAttempts += 1;
  }

  shouldPromptDraft(): boolean {
    return this.isActive() && !this.draftToolUsed;
  }
}
