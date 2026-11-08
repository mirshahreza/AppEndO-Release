import { describe, expect, it } from 'vitest';
import {
  resolveChangeReasonDialogGate,
  changeReasonValueSatisfiesPolicy,
} from '../changeReasonDialogGate';

describe('resolveChangeReasonDialogGate', () => {
  it('skips when nothing changed or only track-without-reason fields changed', () => {
    expect(resolveChangeReasonDialogGate([])).toBe('skip');
    expect(resolveChangeReasonDialogGate([undefined, 'off'])).toBe('skip');
  });

  it('opens an optional dialog when any dirty field asks optionally', () => {
    expect(resolveChangeReasonDialogGate(['off', 'optional'])).toBe('optional');
  });

  it('requires the dialog when any dirty field asks required', () => {
    expect(resolveChangeReasonDialogGate(['optional', 'required', 'off'])).toBe('required');
  });

});

describe('changeReasonValueSatisfiesPolicy', () => {
  it('treats optional as complete even when empty', () => {
    expect(changeReasonValueSatisfiesPolicy(
      { code: '', text: '' },
      { reasonAsk: 'optional', reasonCapture: 'both' },
    )).toBe(true);
  });

  it('requires only the captured parts when Ask is required', () => {
    expect(changeReasonValueSatisfiesPolicy(
      { code: '100.6.6', text: '' },
      { reasonAsk: 'required', reasonCapture: 'code' },
    )).toBe(true);
    expect(changeReasonValueSatisfiesPolicy(
      { code: '', text: 'lockout' },
      { reasonAsk: 'required', reasonCapture: 'text' },
    )).toBe(true);
    expect(changeReasonValueSatisfiesPolicy(
      { code: '100.6.6', text: '' },
      { reasonAsk: 'required', reasonCapture: 'both' },
    )).toBe(false);
  });
});
