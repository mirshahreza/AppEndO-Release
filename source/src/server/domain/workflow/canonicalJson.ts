import { createHash } from 'node:crypto';
import { toCanonicalJsonText } from '../../../shared/lib/canonicalJson';

/**
 * One canonical semantic JSON utility — sole authority per doc 03 section 20. Shared by draft
 * normalization, publication, draft-operation fingerprinting and simulation snapshot
 * fingerprinting; independent canonicalizers for those paths are forbidden.
 *
 * This module owns exactly the generic, schema-agnostic half of section 20: recursive canonical
 * key ordering, array-order preservation, UTF-8 encoding and SHA-256 hashing. Normalizing omitted
 * optional fields to their registered schema-version defaults (the other half of section 20) is
 * schema-specific and is the caller's responsibility before canonicalizing — e.g.
 * `awm/draftOperationApplier.ts`'s `normalizeNode` already does this for AWM node defaults per
 * doc 05 section 19. This keeps the canonicalizer itself generic and reusable across every
 * fingerprint site named above, matching the "one shared implementation" requirement.
 */

export { toCanonicalJsonText };

/** Lowercase hex SHA-256 of the canonical UTF-8 text form — the sole fingerprint algorithm (doc 03 section 20, doc 04 section 9). */
export function canonicalJsonFingerprint(value: unknown): string {
  return createHash('sha256').update(toCanonicalJsonText(value), 'utf8').digest('hex');
}
