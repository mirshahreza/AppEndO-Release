import type { OrchestrationAction, RecentToolInvocation } from './types';

export type OrchestrationDecision = {
  action: OrchestrationAction;
  reason?: string;
};

export interface OrchestrationPolicy {
  decide(input: {
    iteration: number;
    maxIterations: number;
    hasToolCalls: boolean;
    recentInvocations: RecentToolInvocation[];
  }): OrchestrationDecision;
}

const REDUNDANCY_WINDOW = 3;

export class ReactOrchestrationPolicy implements OrchestrationPolicy {
  decide(input: {
    iteration: number;
    maxIterations: number;
    hasToolCalls: boolean;
    recentInvocations: RecentToolInvocation[];
  }): OrchestrationDecision {
    if (input.iteration >= input.maxIterations) {
      return { action: 'stop', reason: 'max_iterations_reached' };
    }

    const recent = input.recentInvocations.slice(-REDUNDANCY_WINDOW);
    if (recent.length >= REDUNDANCY_WINDOW) {
      const first = recent[0];
      const allSame = recent.every(
        (entry) => entry.tool === first.tool && entry.argsHash === first.argsHash,
      );
      if (allSame) {
        return { action: 'stop', reason: 'redundant_tool_invocation' };
      }
    }

    if (input.hasToolCalls) {
      return { action: 'tool_call' };
    }

    return { action: 'respond' };
  }
}

export const defaultOrchestrationPolicy = new ReactOrchestrationPolicy();

export class UtilityGuidedOrchestrationPolicy implements OrchestrationPolicy {
  private readonly reactPolicy = new ReactOrchestrationPolicy();

  decide(input: {
    iteration: number;
    maxIterations: number;
    hasToolCalls: boolean;
    recentInvocations: RecentToolInvocation[];
  }): OrchestrationDecision {
    const reactDecision = this.reactPolicy.decide(input);
    if (reactDecision.action === 'stop') {
      return reactDecision;
    }

    if (!input.hasToolCalls) {
      return { action: 'respond' };
    }

    let utility = 1;
    utility -= (input.iteration / Math.max(input.maxIterations, 1)) * 0.6;

    const recent = input.recentInvocations.slice(-4);
    const invocationCounts = new Map<string, number>();
    recent.forEach((entry) => {
      const key = `${entry.tool}:${entry.argsHash}`;
      invocationCounts.set(key, (invocationCounts.get(key) ?? 0) + 1);
    });
    const maxRepeat = Math.max(0, ...invocationCounts.values());
    if (maxRepeat >= 2) {
      utility -= 0.35 * (maxRepeat - 1);
    }

    if (utility < 0.15) {
      return { action: 'stop', reason: 'utility_threshold_reached' };
    }

    return { action: 'tool_call' };
  }
}

export const createOrchestrationPolicy = (
  policy: 'react' | 'utility-guided' = 'react',
): OrchestrationPolicy => (
  policy === 'utility-guided'
    ? new UtilityGuidedOrchestrationPolicy()
    : new ReactOrchestrationPolicy()
);
