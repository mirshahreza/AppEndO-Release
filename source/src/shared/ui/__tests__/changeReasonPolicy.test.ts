import { describe, expect, it } from 'vitest';
import {
  changeReasonPolicyFromMeta,
  pruneChangeReasonPolicy,
} from '../ChangeReasonPolicyFields';

describe('changeReasonPolicyFromMeta', () => {
  it('drops General so Manage reasons does not edit the shared folder', () => {
    expect(changeReasonPolicyFromMeta({
      reasonAsk: 'optional',
      reasonVocabNodeId: '100.6.0',
    }).reasonVocabNodeId).toBe('');
  });

  it('keeps a dedicated situation folder', () => {
    expect(changeReasonPolicyFromMeta({
      reasonAsk: 'optional',
      reasonVocabNodeId: '100.6.47',
    }).reasonVocabNodeId).toBe('100.6.47');
  });
});

describe('pruneChangeReasonPolicy', () => {
  it('does not write General when no folder is assigned', () => {
    expect(pruneChangeReasonPolicy({
      reasonAsk: 'optional',
      reasonCapture: 'both',
      reasonVocabNodeId: '',
      reasonIncludeGeneral: true,
    })).toEqual({
      reasonAsk: 'optional',
      reasonCapture: 'both',
    });
  });
});
