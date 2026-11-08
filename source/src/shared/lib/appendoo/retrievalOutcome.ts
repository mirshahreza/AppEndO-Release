/**
 * V5 Phase P04 § 6.2 — "empty result ≠ subsystem failure".
 *
 * `contextIntelligence.service.ts` (`ContextIntelligenceService.buildRunContextPack`) has three
 * `try { ... } catch { featureGraph = undefined }`-shaped blocks that collapse "the subsystem
 * threw" and "the subsystem legitimately found nothing" into the same observable state. This
 * module makes that distinction a first-class, typed result instead of a silently swallowed catch.
 */
export type RetrievalHit = { path: string };

export type RetrievalOutcome<T> =
  | { status: 'SUCCESS'; data: T }
  | { status: 'FAILED'; errorCode: string; retryable: boolean };

/**
 * Wraps a synchronous subsystem call. A thrown exception → `FAILED` (real failure, distinguishable
 * from an intentional empty/undefined result). Anything the function itself returns — including
 * `undefined`, `[]`, or an empty string — is `SUCCESS`, because the subsystem ran to completion
 * and that IS its answer (doc rule: "empty result ≠ subsystem failure").
 */
export const runRetrievalStep = <T>(fn: () => T, retryable = true): RetrievalOutcome<T> => {
  try {
    return { status: 'SUCCESS', data: fn() };
  } catch (error) {
    return {
      status: 'FAILED',
      errorCode: error instanceof Error ? error.message : String(error),
      retryable,
    };
  }
};

export const isRetrievalFailure = <T>(outcome: RetrievalOutcome<T>): boolean => outcome.status === 'FAILED';

/** Unwraps a `RetrievalOutcome`, using `fallback` for the FAILED case — same value shape the old swallowed catches produced, but the FAILED/SUCCESS distinction is preserved on the outcome object itself for the caller to inspect. */
export const retrievalOutcomeOr = <T>(outcome: RetrievalOutcome<T>, fallback: T): T => (
  outcome.status === 'SUCCESS' ? outcome.data : fallback
);
