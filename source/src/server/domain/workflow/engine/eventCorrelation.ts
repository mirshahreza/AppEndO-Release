import { toCanonicalJsonText, canonicalJsonFingerprint } from '../canonicalJson';
import { WorkflowDomainError } from '../errors';
import type { JsonValue } from '../awm/types';

/**
 * Canonical EVENT-correlation encoder (doc 03 section 7: "correlationEncoderVersion and
 * correlationHashAlgorithm are required with correlationValueHash. The hash algorithm is SHA-256;
 * encoder identity is the exact registered canonical encoder version.").
 *
 * Repository Reality Audit / Slice 6 design decision: no per-`eventName` correlation-key registry
 * exists anywhere in this repository (doc 04's Action registry has no event-name counterpart), so
 * there is no shared authority that could derive a correlation value from a raw event payload on
 * ingress's behalf. The frozen contract only constrains the *shape* of the value (doc 05 section
 * 30's "must produce JSON null, string, number or boolean", reused here for WAIT_EVENT's own
 * `correlation` expression per doc 05 section 6/19) and the *encoding* (this module). The resolved
 * design: `WAIT_EVENT.correlation` evaluates once at wait creation (doc 05 section 26 normal
 * evaluation context, no CURRENT_EVENT — no event exists yet) to the scalar the node is waiting
 * for; event ingress (`eventIngressService.ts`) accepts an explicit already-derived scalar
 * `correlationValue` from its caller (the same way `deduplicationKey` is already an explicit
 * optional caller-supplied string on `insertOrReturnExistingInbox`). Both sides encode their scalar
 * with this exact same function, so hash equality is a correct candidate-match signal (doc 03
 * section 7: "Hash equality is candidate lookup only.").
 */

export const WORKFLOW_EVENT_CORRELATION_ENCODER_VERSION = 'WF_EVENT_CORRELATION_ENCODER_V1';
export const WORKFLOW_EVENT_CORRELATION_HASH_ALGORITHM = 'SHA-256';

export type EncodedCorrelation = {
  correlationKey: string;
  correlationValueHash: string;
  correlationEncoderVersion: string;
  correlationHashAlgorithm: string;
};

const isCorrelationScalar = (value: JsonValue): value is null | string | number | boolean =>
  value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

/**
 * Encodes a typed JSON scalar into its canonical correlation fingerprint. `correlationKey` is the
 * canonical JSON text of the value — non-authoritative human-readable evidence only; the hash is
 * the sole matching authority (doc 03 section 7).
 */
export function encodeCorrelationValue(value: JsonValue): EncodedCorrelation {
  if (!isCorrelationScalar(value)) {
    throw new WorkflowDomainError(
      'WF_EXEC_EXPRESSION_FAILED',
      'Correlation value must evaluate to JSON null, string, number or boolean (doc 05 section 30).',
      { value },
    );
  }
  return {
    correlationKey: toCanonicalJsonText(value),
    correlationValueHash: canonicalJsonFingerprint(value),
    correlationEncoderVersion: WORKFLOW_EVENT_CORRELATION_ENCODER_VERSION,
    correlationHashAlgorithm: WORKFLOW_EVENT_CORRELATION_HASH_ALGORITHM,
  };
}
