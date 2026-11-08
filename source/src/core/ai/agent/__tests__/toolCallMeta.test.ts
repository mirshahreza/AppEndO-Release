import { describe, expect, it } from 'vitest';
import {
  extractToolCallIntention,
  stripToolCallMetaArgs,
  TOOL_CALL_INTENTION_KEY,
} from '../../../../core/ai/agent/toolCallMeta';

describe('toolCallMeta', () => {
  it('extracts _intention from tool args', () => {
    expect(extractToolCallIntention({
      query: 'foo',
      [TOOL_CALL_INTENTION_KEY]: 'To find related code',
    })).toBe('To find related code');
  });

  it('strips meta args before tool execute', () => {
    expect(stripToolCallMetaArgs({
      path: 'src/a.ts',
      [TOOL_CALL_INTENTION_KEY]: 'why',
      intention: 'ignored when _intention present',
    })).toEqual({ path: 'src/a.ts' });
  });
});
