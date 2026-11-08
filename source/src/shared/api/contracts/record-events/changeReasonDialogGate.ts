export type ChangeReasonDialogGate = 'skip' | 'optional' | 'required';

type ReasonAsk = 'off' | 'optional' | 'required';
type ReasonCapture = 'code' | 'text' | 'both';

export const changeReasonAskIsOn = (ask?: ReasonAsk | null): boolean => (
  ask === 'optional' || ask === 'required'
);

export const changeReasonCaptureNeedsCode = (capture?: ReasonCapture | null): boolean => (
  (capture ?? 'both') !== 'text'
);

export const changeReasonCaptureNeedsText = (capture?: ReasonCapture | null): boolean => (
  (capture ?? 'both') !== 'code'
);

export const changeReasonValueSatisfiesPolicy = (
  value: { code: string; text: string },
  policy?: { reasonAsk?: ReasonAsk; reasonCapture?: ReasonCapture } | null,
): boolean => {
  if (policy?.reasonAsk !== 'required') return true;
  if (changeReasonCaptureNeedsCode(policy.reasonCapture) && !value.code.trim()) return false;
  if (changeReasonCaptureNeedsText(policy.reasonCapture) && !value.text.trim()) return false;
  return true;
};

/** Confirm overlay: required wins, else optional, else skip (track-only or untracked). */
export const resolveChangeReasonDialogGate = (
  asks: ReadonlyArray<ReasonAsk | undefined | null>,
): ChangeReasonDialogGate => {
  let optional = false;
  for (const ask of asks) {
    if (ask === 'required') return 'required';
    if (ask === 'optional') optional = true;
  }
  return optional ? 'optional' : 'skip';
};
