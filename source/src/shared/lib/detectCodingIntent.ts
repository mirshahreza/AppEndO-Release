const CODING_INTENT_PATTERNS: RegExp[] = [
  /\b(implement|create|add|build|fix|update|modify|change|refactor|draft|patch|write|code|develop)\b/i,
  /\b(server\s*function|edge\s*function|crud|endpoint)\b/i,
  /\b(draft_|get_server_function|draft_component|draft_file)\b/i,
];

/** Q&A / lookup — must not trigger Ask→Agent auto-switch or draft nudges. */
const INFORMATIONAL_QUERY_PATTERNS: RegExp[] = [
  /^(ask)\s*[:：]/i,
  /\b(what|where|how|why|when|which|explain|describe|define|tell\s+me)\b/i,
  /\b(what\s+is|where\s+is|where\s+are|how\s+does|how\s+do)\b/i,
  /\bwhat\s+can\s+you\b/i,
];

const IMPLEMENTATION_INTENT_PATTERNS: RegExp[] = [
  /\b(implement|create|add|build|fix|update|modify|change|refactor|draft|patch|write|develop|scaffold|generate)\b/i,
];

/** Short affirmations to continue a prior implementation offer — not informational lookup. */
const CONTINUATION_INTENT_PATTERNS: RegExp[] = [
  /^(continue|go\s+ahead|proceed|do\s+it|just\s+do\s+it|start|try\s+again|retry)\.?$/i,
];

/** Plan/Act review — retrieve and narrate without draft_* (C.3). */
const PLAN_REVIEW_INTENT_PATTERNS: RegExp[] = [
  /\b(plan|review)\s+only\b/i,
  /\bwithout\s+(making\s+)?(any\s+)?(file\s+)?changes\b/i,
  /\bdo\s+not\s+(change|modify|edit)\s+(any\s+)?files\b/i,
  /\bjust\s+(review|analyze|investigate)\b/i,
];

/** User confirms plan review → switch to implement (C.3). */
const EXECUTE_PLAN_INTENT_PATTERNS: RegExp[] = [
  /^(now\s+implement|go\s+ahead\s+and\s+implement)\.?$/i,
];

const SERVER_FUNCTION_INTENT_PATTERNS: RegExp[] = [
  /\b(server\s*function|edge\s*function|managed\s+function|api\s+endpoint)\b/i,
];

const UI_INTENT_PATTERNS: RegExp[] = [
  /\b(user\s*interface|ui\b|frontend|front[\s-]end|client[\s-]component|component\s*layout|crud\s*(page|ui|screen)|designer)\b/i,
  /\b(draft_component_layout|app\s*table\s*grid|create\s*edit\s*modal)\b/i,
];

const EXPLICIT_SERVER_ONLY_PATTERNS: RegExp[] = [
  /\b(server\s*function|edge\s*function|managed\s*function|api\s+endpoint)\b/i,
];

const IMPLEMENTATION_DUMP_MARKERS: RegExp[] = [
  /\basync\s+function\s+handler\b/,
  /\bconst\s+edgeReq\b/,
  /\bedgeRes\.json\b/,
  /\btype\s+EdgeReq\b/,
  /\bworkspace\/server-functions\b/,
];

const OPERATIONAL_ACTION_PATTERNS: RegExp[] = [
  /\b(platform\s+job|background\s+job|scheduled\s+task|rebuild\s+.+\s+index|search\s+index)\b/i,
  /\b(trigger\s+.+\s+webhook|run\s+job|create\s+a\s+platform\s+job)\b/i,
];

/** V4-PATCH-1 — explicit governed engineering path (pipeline + approval), not normal agent-loop. */
const GOVERNED_ENGINEERING_PATTERNS: RegExp[] = [
  /\b(governed|with\s+architect\s+approval|architect\s+approval|requires?\s+approval)\b/i,
  /\b(package\s+export|export\s+to\s+package|promotion|promote\s+to\s+production)\b/i,
];

/** User explicitly requests governed engineering pipeline (approval, package export, promotion). */
export const detectGovernedEngineeringIntent = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  return GOVERNED_ENGINEERING_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/** Platform operational actions (jobs, webhooks, index rebuild) — not engineering mutations. */
export const detectOperationalActionIntent = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  return OPERATIONAL_ACTION_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/** Heuristic: user message likely requests platform development work (not Q&A only). */
export const detectCodingIntent = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  if (detectInformationalQuery(trimmed)) return false;
  return CODING_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/** Question / standards lookup — stay in Ask; never auto-switch to Agent. */
export const detectInformationalQuery = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  if (detectImplementationIntent(trimmed)) return false;
  if (detectUIIntent(trimmed)) return false;
  return INFORMATIONAL_QUERY_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/** Ask mode handoff — user clearly wants implementation; suggest Agent mode (no auto-switch). */
export const shouldSuggestAgentModeHandoff = (text: string): boolean => (
  detectImplementationIntent(text) && !detectInformationalQuery(text)
);

/** @deprecated Use shouldSuggestAgentModeHandoff — kept for existing imports. */
export const shouldAutoSwitchAskToAgent = shouldSuggestAgentModeHandoff;

/** User affirms a prior implementation offer ("continue", "do it"). */
export const detectContinuationIntent = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  return CONTINUATION_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/** Plan-only review — no draft_* until user explicitly executes (C.3). */
export const detectPlanReviewIntent = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  return PLAN_REVIEW_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/** User asks to execute after a plan-review turn (C.3). */
export const detectExecutePlanIntent = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  return EXECUTE_PLAN_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

type IntentMessage = { role: string; content: string };

export type ContinuationPageContextHint = {
  pageKey?: string;
  path?: string;
  functionId?: string;
  functionName?: string;
  layoutId?: string;
};

/** True when the user is on managed Server Functions (studio route or open function editor). */
export const isServerFunctionsPageContext = (
  pageContext?: ContinuationPageContextHint | null,
): boolean => (
  pageContext?.pageKey === 'server-functions'
  || Boolean(pageContext?.functionId?.trim())
  || /\/server-functions(?:\/|$)/i.test(pageContext?.path ?? '')
);

/** Default build intent when user says "continue" on a studio page without a prior request. */
export const buildPageContextContinuationIntent = (
  pageContext?: ContinuationPageContextHint | null,
): string | null => {
  if (!pageContext) return null;

  const functionId = pageContext.functionId?.trim();
  if (isServerFunctionsPageContext(pageContext) && functionId) {
    const label = functionId;
    return `Build a user interface for server function ${label}: two number inputs, run button, show result and errors`;
  }

  const layoutId = pageContext.layoutId?.trim();
  if (layoutId && (pageContext.pageKey === 'client-components' || pageContext.pageKey === 'component-designer')) {
    return `Complete and wire the designer layout ${layoutId} to its API`;
  }

  return null;
};

/**
 * When the latest user turn is a short continuation ("continue", "try again"),
 * walk back to the last substantive build/UI/server-function request for workflow context.
 */
export const resolveEffectiveUserIntent = (
  messages: readonly IntentMessage[],
  pageContext?: ContinuationPageContextHint | null,
): string => {
  const userMessages = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content.trim())
    .filter(Boolean);

  if (userMessages.length === 0) return '';

  const latest = userMessages[userMessages.length - 1];
  if (!detectContinuationIntent(latest)) {
    return latest;
  }

  for (let index = userMessages.length - 2; index >= 0; index -= 1) {
    const candidate = userMessages[index];
    if (detectContinuationIntent(candidate)) continue;
    if (
      detectImplementationIntent(candidate)
      || detectUIIntent(candidate)
      || detectServerFunctionIntent(candidate)
    ) {
      return candidate;
    }
  }

  for (let index = userMessages.length - 2; index >= 0; index -= 1) {
    const candidate = userMessages[index];
    if (!detectContinuationIntent(candidate) && !detectInformationalQuery(candidate)) {
      return candidate;
    }
  }

  const pageFallback = buildPageContextContinuationIntent(pageContext);
  if (pageFallback) return pageFallback;

  return latest;
};

/** Stricter than detectCodingIntent — user asked to implement/create something. */
export const detectImplementationIntent = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  if (detectOperationalActionIntent(trimmed)) return false;
  return IMPLEMENTATION_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/** User wants a managed Server Function even when page context is not server-functions. */
export const detectServerFunctionIntent = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  return SERVER_FUNCTION_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/** User wants a Client Component / CRUD UI (WF-2), not backend-only work. */
export const detectUIIntent = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  return UI_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/** Backend-only request — not "build UI for this API". */
export const detectExplicitServerFunctionOnlyIntent = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  if (detectUIIntent(trimmed)) return false;
  return EXPLICIT_SERVER_ONLY_PATTERNS.some((pattern) => pattern.test(trimmed))
    || detectServerFunctionIntent(trimmed);
};

/** UI workflow should win over server-functions page context (WF-2 over WF-1). */
export const shouldPreferUIWorkflow = (text: string): boolean => (
  detectUIIntent(text) && !detectExplicitServerFunctionOnlyIntent(text)
);

/** Assistant pasted sandbox/handler source in chat instead of using draft_* tools. */
export const looksLikeImplementationDump = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 80) return false;
  if (/```[\s\S]*```/.test(trimmed)) return true;
  const markerHits = IMPLEMENTATION_DUMP_MARKERS.filter((pattern) => pattern.test(trimmed)).length;
  return markerHits >= 2;
};
