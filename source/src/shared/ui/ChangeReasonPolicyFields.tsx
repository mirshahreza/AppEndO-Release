import React, { useEffect, useState } from 'react';
import type { RecordEventReasonAsk, RecordEventReasonCapture } from '../api/contracts/record-events';
import { hasAssignedReasonFolder } from '../api/contracts/record-events';
import { ensureChangeReasonFolder } from '../api/queries/changeReasonFolder';
import { ChangeReasonVocabManager } from './ChangeReasonVocabManager';
import { FormField } from './FormSection';
import { UiCheckbox, UiSelect } from './HeroFieldControls';

export type ChangeReasonPolicyForm = {
  reasonAsk: RecordEventReasonAsk;
  reasonCapture: RecordEventReasonCapture;
  reasonVocabNodeId: string;
  reasonIncludeGeneral: boolean;
};

export const emptyChangeReasonPolicyForm = (): ChangeReasonPolicyForm => ({
  reasonAsk: 'off',
  reasonCapture: 'both',
  reasonVocabNodeId: '',
  reasonIncludeGeneral: true,
});

export const changeReasonPolicyFromMeta = (
  policy?: { reasonAsk?: RecordEventReasonAsk; reasonCapture?: RecordEventReasonCapture; reasonVocabNodeId?: string; reasonIncludeGeneral?: boolean } | null,
): ChangeReasonPolicyForm => {
  const assigned = policy?.reasonVocabNodeId?.trim() ?? '';
  return {
    ...emptyChangeReasonPolicyForm(),
    reasonAsk: policy?.reasonAsk ?? 'off',
    reasonCapture: policy?.reasonCapture ?? 'both',
    reasonVocabNodeId: hasAssignedReasonFolder(assigned) ? assigned : '',
    reasonIncludeGeneral: policy?.reasonIncludeGeneral !== false,
  };
};

export const pruneChangeReasonPolicy = (
  form: ChangeReasonPolicyForm,
): {
  reasonAsk: RecordEventReasonAsk;
  reasonCapture?: RecordEventReasonCapture;
  reasonVocabNodeId?: string;
  reasonIncludeGeneral?: boolean;
} | undefined => {
  const folderPatch = hasAssignedReasonFolder(form.reasonVocabNodeId)
    ? { reasonVocabNodeId: form.reasonVocabNodeId.trim() }
    : {};
  if (form.reasonAsk === 'off') {
    return Object.keys(folderPatch).length > 0
      ? { reasonAsk: 'off', ...folderPatch }
      : undefined;
  }
  return {
    reasonAsk: form.reasonAsk,
    reasonCapture: form.reasonCapture,
    ...folderPatch,
    ...(form.reasonIncludeGeneral ? {} : { reasonIncludeGeneral: false }),
  };
};

/** Persist Ask off explicitly so function APIs do not fall back to code constants. */
export const serializeFunctionChangeReasonPolicy = (
  form: ChangeReasonPolicyForm,
): NonNullable<ReturnType<typeof pruneChangeReasonPolicy>> => (
  pruneChangeReasonPolicy(form) ?? { reasonAsk: 'off' }
);

type ChangeReasonPolicyFieldsProps = {
  value: ChangeReasonPolicyForm;
  onChange: (patch: Partial<ChangeReasonPolicyForm>) => void;
  folderOwnerKey: string;
  folderTitle: string;
  disabled?: boolean;
};

export const ChangeReasonPolicyFields: React.FC<ChangeReasonPolicyFieldsProps> = ({
  value,
  onChange,
  folderOwnerKey,
  folderTitle,
  disabled = false,
}) => {
  const reasonOff = value.reasonAsk === 'off';
  const fieldsDisabled = disabled;
  const [managerOpen, setManagerOpen] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState(value.reasonVocabNodeId);
  const [ensuring, setEnsuring] = useState(false);
  const [ensureError, setEnsureError] = useState<string | null>(null);

  useEffect(() => {
    if (value.reasonVocabNodeId) {
      setActiveFolderId(value.reasonVocabNodeId);
    }
  }, [value.reasonVocabNodeId]);

  const openManager = async () => {
    if (fieldsDisabled || !folderOwnerKey.trim()) return;
    setEnsuring(true);
    setEnsureError(null);
    try {
      const folderId = await ensureChangeReasonFolder({
        ownerKey: folderOwnerKey,
        title: folderTitle,
        storedNodeId: value.reasonVocabNodeId,
      });
      setActiveFolderId(folderId);
      if (folderId !== value.reasonVocabNodeId) {
        onChange({ reasonVocabNodeId: folderId });
      }
      setManagerOpen(true);
    } catch (error) {
      setEnsureError(error instanceof Error ? error.message : 'Unable to open reason items for this API.');
    } finally {
      setEnsuring(false);
    }
  };

  return (
    <>
      <FormField
        label="Reason"
        className="min-w-0 w-full"
        hint="Ask without Track stores nothing. Applies to update, patch, and delete — not list, get, or create."
      >
        <UiSelect
          size="sm"
          ariaLabel="Change reason ask"
          value={value.reasonAsk}
          disabled={fieldsDisabled}
          onChange={(event) => onChange({ reasonAsk: event.target.value as RecordEventReasonAsk })}
        >
          <option value="off">Off</option>
          <option value="optional">Optional</option>
          <option value="required">Required</option>
        </UiSelect>
      </FormField>
      <FormField label="Capture" className="min-w-0 w-full">
        <UiSelect
          size="sm"
          ariaLabel="Change reason capture"
          value={value.reasonCapture}
          disabled={fieldsDisabled || reasonOff}
          onChange={(event) => onChange({ reasonCapture: event.target.value as RecordEventReasonCapture })}
        >
          <option value="both">Code and text</option>
          <option value="code">Code only</option>
          <option value="text">Text only</option>
        </UiSelect>
      </FormField>
      <FormField label="Include general" className="min-w-0 w-full">
        <UiCheckbox
          size="sm"
          checked={value.reasonIncludeGeneral}
          disabled={fieldsDisabled || reasonOff}
          onChange={(event) => onChange({ reasonIncludeGeneral: event.target.checked })}
        >
          Add General reasons to the combo
        </UiCheckbox>
      </FormField>
      <FormField
        label="Reason items"
        hint="Leaf reasons for this API only. General stays in Base Info."
        className="min-w-0 w-full"
      >
        <ChangeReasonVocabManager
          vocabNodeId={activeFolderId || value.reasonVocabNodeId}
          folderTitle={folderTitle}
          disabled={fieldsDisabled}
          open={managerOpen}
          onOpenRequest={() => { void openManager(); }}
          onClose={() => setManagerOpen(false)}
          opening={ensuring}
        />
        {ensureError ? (
          <p className="mt-1 text-xs text-rose-700">{ensureError}</p>
        ) : null}
      </FormField>
    </>
  );
};
