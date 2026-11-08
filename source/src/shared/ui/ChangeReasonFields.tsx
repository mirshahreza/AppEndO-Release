import React, { useEffect, useMemo, useState } from 'react';
import {
  RECORD_CHANGE_REASON_GENERAL,
  catalogLeavesForReasonVocab,
  changeReasonCaptureNeedsCode,
  changeReasonCaptureNeedsText,
  mergeChangeReasonSelectOptions,
  reasonIncludeGeneralEnabled,
  resolveReasonVocabNodeId,
  toChangeReasonSelectOptions,
  unionChangeReasonSelectOptions,
  withSelectedChangeReasonCode,
  type ChangeReasonSelectOption,
  type RecordEventReasonCapture,
} from '../api/contracts/record-events';
import { fetchBaseInfoOptions } from '../api/queries/base-info';
import { useCulture } from '../../core/culture/CultureContext';
import { FormField } from './FormSection';
import { UiSelect, UiTextarea } from './HeroFieldControls';

export type ChangeReasonValue = {
  code: string;
  text: string;
};

export const emptyChangeReason = (): ChangeReasonValue => ({ code: '', text: '' });

export const pickChangeReasonPayload = (values: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = {};
  if (typeof values.__changeReasonCode === 'string' && values.__changeReasonCode.trim()) {
    next.__changeReasonCode = values.__changeReasonCode.trim();
  }
  if (typeof values.__changeReasonText === 'string' && values.__changeReasonText.trim()) {
    next.__changeReasonText = values.__changeReasonText.trim();
  }
  return next;
};

export const attachChangeReason = (
  body: Record<string, unknown>,
  reason: ChangeReasonValue,
): Record<string, unknown> => ({
  ...body,
  ...pickChangeReasonPayload({
    __changeReasonCode: reason.code,
    __changeReasonText: reason.text,
  }),
});

export const omitChangeReasonTransport = (
  values: Record<string, unknown>,
): Record<string, unknown> => {
  const next = { ...values };
  delete next.__changeReasonCode;
  delete next.__changeReasonText;
  delete next.__revertedFromSeq;
  delete next.__revertedFromEventId;
  return next;
};

export type ChangeReasonFieldsProps = {
  value: ChangeReasonValue;
  onChange: (next: ChangeReasonValue) => void;
  required?: boolean;
  capture?: RecordEventReasonCapture;
  vocabNodeId?: string;
  includeGeneral?: boolean;
};

export const ChangeReasonFields: React.FC<ChangeReasonFieldsProps> = ({
  value,
  onChange,
  required = false,
  capture = 'both',
  vocabNodeId,
  includeGeneral,
}) => {
  const showCode = changeReasonCaptureNeedsCode(capture);
  const showText = changeReasonCaptureNeedsText(capture);
  const resolved = resolveReasonVocabNodeId(vocabNodeId);
  const withGeneral = reasonIncludeGeneralEnabled(includeGeneral);
  const needGeneral = withGeneral && resolved !== RECORD_CHANGE_REASON_GENERAL;
  const catalogSituational = catalogLeavesForReasonVocab(resolved);
  const catalogGeneral = catalogLeavesForReasonVocab(RECORD_CHANGE_REASON_GENERAL);
  const [situational, setSituational] = useState<ChangeReasonSelectOption[]>(catalogSituational);
  const [general, setGeneral] = useState<ChangeReasonSelectOption[]>(catalogGeneral);
  const { cultureId } = useCulture();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const situationalRows = await fetchBaseInfoOptions(resolved, cultureId);
        const generalRows = needGeneral
          ? await fetchBaseInfoOptions(RECORD_CHANGE_REASON_GENERAL, cultureId)
          : situationalRows;
        if (cancelled) return;
        setSituational(unionChangeReasonSelectOptions(
          catalogLeavesForReasonVocab(resolved),
          toChangeReasonSelectOptions(situationalRows, resolved),
        ));
        setGeneral(unionChangeReasonSelectOptions(
          catalogLeavesForReasonVocab(RECORD_CHANGE_REASON_GENERAL),
          toChangeReasonSelectOptions(generalRows, RECORD_CHANGE_REASON_GENERAL),
        ));
      } catch {
        if (!cancelled) {
          setSituational(catalogLeavesForReasonVocab(resolved));
          setGeneral(catalogLeavesForReasonVocab(RECORD_CHANGE_REASON_GENERAL));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needGeneral, resolved, cultureId]);

  const options = useMemo(
    () => withSelectedChangeReasonCode(
      mergeChangeReasonSelectOptions(situational, general, withGeneral, resolved),
      value.code,
    ),
    [general, resolved, situational, value.code, withGeneral],
  );

  return (
    <div className="grid gap-3">
      {showCode ? (
        <FormField label="Reason" required={required}>
          <UiSelect
            size="sm"
            ariaLabel="Change reason"
            placeholder={required ? 'Select a reason' : 'Optional'}
            value={value.code}
            onChange={(event) => onChange({ ...value, code: String(event.target.value) })}
          >
            <option value="">{required ? 'Select a reason' : 'Optional'}</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </UiSelect>
        </FormField>
      ) : null}
      {showText ? (
        <FormField label="Details" required={required}>
          <UiTextarea
            size="sm"
            value={value.text}
            onChange={(event) => onChange({ ...value, text: event.target.value })}
            placeholder="Why this change was made"
          />
        </FormField>
      ) : null}
    </div>
  );
};
