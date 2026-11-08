/** Activity step shape shared by panel stream updates and failure preservation. */
export type AgentStatusActivityStep = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  result?: { ok: boolean; summary: string; data?: unknown; error?: string };
  activityTitle?: string;
  intention?: string;
  argsOneLiner?: string;
};

const statusAlreadyCaptured = (
  steps: AgentStatusActivityStep[],
  title: string,
): boolean => steps.some((step) => (
  step.name === 'status'
  && (step.activityTitle === title || step.intention === title || step.argsOneLiner === title)
));

/**
 * Archive the previous live status line into the activity timeline so internal
 * AppEndoo work (routing / scaffold / planning) is not lost when thinking updates
 * or when an API error replaces the bubble content.
 */
export const archiveAgentThinkingIntoSteps = (
  steps: AgentStatusActivityStep[] | undefined,
  previousThinking: string | undefined,
  options?: { status?: 'done' | 'error' },
): AgentStatusActivityStep[] => {
  const next = [...(steps ?? [])];
  const thinking = previousThinking?.trim();
  if (!thinking || statusAlreadyCaptured(next, thinking)) {
    return next;
  }
  next.push({
    id: `status-${next.length}`,
    name: 'status',
    args: {},
    status: options?.status ?? 'done',
    activityTitle: thinking,
  });
  return next;
};

/**
 * Keep mid-turn activity after Connection Failed so the panel can show a subtle
 * reopen control instead of wiping the timeline the user just saw.
 */
export const preserveActivityStepsOnConnectionFailure = (
  steps: AgentStatusActivityStep[] | undefined,
  agentThinking: string | undefined,
): AgentStatusActivityStep[] | undefined => {
  const archived = archiveAgentThinkingIntoSteps(steps, agentThinking, { status: 'error' });
  const next = archived.map((step) => (
    step.status === 'running'
      ? { ...step, status: 'error' as const }
      : step
  ));
  return next.length > 0 ? next : undefined;
};
