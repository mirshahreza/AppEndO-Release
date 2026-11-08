import { describe, expect, it } from 'vitest';
import {
  associationHistoryFromMeta,
  columnHistoryFromMeta,
  emptyColumnHistoryForm,
  pruneAssociationHistory,
  pruneColumnHistory,
  pruneModelHistory,
} from '../EdgeModelHistoryFields';

describe('column and association history prune', () => {
  it('stores track without reason fields', () => {
    const pruned = pruneColumnHistory({
      ...emptyColumnHistoryForm(),
      track: true,
    });
    expect(pruned).toEqual({ track: true });
  });

  it('stores redact with track', () => {
    expect(pruneColumnHistory({ track: true, redact: true })).toEqual({
      track: true,
      redact: true,
    });
  });

  it('omits empty association history', () => {
    expect(pruneAssociationHistory({ trackAssignRemove: false })).toBeUndefined();
    expect(pruneAssociationHistory({ trackAssignRemove: true })).toEqual({
      trackAssignRemove: true,
    });
  });

  it('hydrates track and redact from meta', () => {
    expect(columnHistoryFromMeta({ track: true, redact: true })).toEqual({
      track: true,
      redact: true,
    });
    expect(associationHistoryFromMeta({ trackAssignRemove: true }).trackAssignRemove).toBe(true);
  });

  it('does not persist per-model retention days', () => {
    expect(pruneModelHistory({
      enabled: true,
      lifecycleField: '',
      legalHold: false,
    })).toEqual({ enabled: true });
  });
});
