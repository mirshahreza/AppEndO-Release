import { canonicalJsonFingerprint } from '../canonicalJson';
import type { ActionDefinition } from './types';

const uniqueSortedOrdinal = (values: readonly string[]): string[] =>
  Array.from(new Set(values)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * Doc 04 section 11: "Arrays that represent sets are normalized unique and ordinal-sorted before
 * fingerprinting." Uses the shared canonical JSON utility (doc 03 section 20) for the actual hash
 * — no independent fingerprint algorithm.
 */
export function computeActionDefinitionFingerprint(definition: ActionDefinition): string {
  // Conditional spread rather than `field: value ?? undefined` — canonicalJsonFingerprint (doc 03
  // section 20) correctly rejects an object key explicitly set to `undefined` as non-JSON, so an
  // absent optional field must be an absent key, not a key with an undefined value.
  const normalized: ActionDefinition = {
    ...definition,
    requiredCapabilities: uniqueSortedOrdinal(definition.requiredCapabilities),
    requiredPermissions: uniqueSortedOrdinal(definition.requiredPermissions),
    secretReferenceFields: uniqueSortedOrdinal(definition.secretReferenceFields),
    tags: uniqueSortedOrdinal(definition.tags),
    ...(definition.agenticConstraints
      ? {
          agenticConstraints: {
            ...definition.agenticConstraints,
            ...(definition.agenticConstraints.allowedOutcomeKeys
              ? { allowedOutcomeKeys: uniqueSortedOrdinal(definition.agenticConstraints.allowedOutcomeKeys) }
              : {}),
          },
        }
      : {}),
  };
  return canonicalJsonFingerprint(normalized);
}
