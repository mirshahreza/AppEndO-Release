import React from 'react';
import type {
  EdgeAssociationHistory,
  EdgeColumnHistory,
  EdgeModelHistory,
} from '../../../shared/api/contracts/record-events';
import {
  FormField,
  FormSection,
  UiCheckbox,
  UiInput,
} from '../../../shared/ui';

export type ColumnHistoryForm = {
  track: boolean;
  redact: boolean;
};

export type AssociationHistoryForm = {
  trackAssignRemove: boolean;
};

export type ModelHistoryForm = {
  enabled: boolean;
  lifecycleField: string;
  legalHold: boolean;
};

export const emptyColumnHistoryForm = (): ColumnHistoryForm => ({
  track: false,
  redact: false,
});

export const emptyAssociationHistoryForm = (): AssociationHistoryForm => ({
  trackAssignRemove: false,
});

export const emptyModelHistoryForm = (): ModelHistoryForm => ({
  enabled: false,
  lifecycleField: '',
  legalHold: false,
});

export const columnHistoryFromMeta = (history?: EdgeColumnHistory): ColumnHistoryForm => ({
  ...emptyColumnHistoryForm(),
  track: Boolean(history?.track),
  redact: Boolean(history?.redact),
});

export const associationHistoryFromMeta = (history?: EdgeAssociationHistory): AssociationHistoryForm => ({
  ...emptyAssociationHistoryForm(),
  trackAssignRemove: Boolean(history?.trackAssignRemove),
});

export const modelHistoryFromMeta = (history?: EdgeModelHistory | null): ModelHistoryForm => ({
  enabled: Boolean(history?.enabled),
  lifecycleField: history?.lifecycleField ?? '',
  legalHold: Boolean(history?.legalHold),
});

export const pruneColumnHistory = (form: ColumnHistoryForm): EdgeColumnHistory | undefined => {
  if (!form.track && !form.redact) {
    return undefined;
  }
  return {
    track: form.track,
    ...(form.redact ? { redact: true } : {}),
  };
};

export const pruneAssociationHistory = (form: AssociationHistoryForm): EdgeAssociationHistory | undefined => {
  if (!form.trackAssignRemove) {
    return undefined;
  }
  return {
    trackAssignRemove: form.trackAssignRemove,
  };
};

export const pruneModelHistory = (form: ModelHistoryForm): EdgeModelHistory | undefined => {
  if (!form.enabled && !form.lifecycleField.trim() && !form.legalHold) {
    return undefined;
  }
  return {
    enabled: form.enabled,
    ...(form.lifecycleField.trim() ? { lifecycleField: form.lifecycleField.trim() } : {}),
    ...(form.legalHold ? { legalHold: true } : {}),
  };
};

export const ColumnHistoryFields: React.FC<{
  value: ColumnHistoryForm;
  onChange: (next: ColumnHistoryForm) => void;
  isLifecycle?: boolean;
}> = ({ value, onChange, isLifecycle }) => (
  <FormSection
    title="History"
    ink="contrast"
    divided
    hint={isLifecycle
      ? "This column is the model's lifecycle field — Track is implied when History is enabled on the model."
      : 'Append-only events for this column. Redacted values are encrypted at rest and masked on the Timeline.'}
  >
    <div className="grid w-full min-w-0 grid-cols-2 gap-3">
      <FormField label={isLifecycle ? 'Lifecycle' : 'Track'} className="min-w-0 w-full">
        <UiCheckbox
          size="sm"
          checked={value.track || Boolean(isLifecycle)}
          disabled={isLifecycle}
          onChange={(event) => onChange({ ...value, track: event.target.checked })}
        >
          {isLifecycle ? 'Lifecycle field (tracked)' : 'Track changes'}
        </UiCheckbox>
      </FormField>
      <FormField label="Redact" className="min-w-0 w-full">
        <UiCheckbox
          size="sm"
          checked={value.redact}
          onChange={(event) => onChange({ ...value, redact: event.target.checked })}
        >
          Encrypt from/to at rest
        </UiCheckbox>
      </FormField>
    </div>
  </FormSection>
);

export const AssociationHistoryFields: React.FC<{
  value: AssociationHistoryForm;
  onChange: (next: AssociationHistoryForm) => void;
}> = ({ value, onChange }) => (
  <FormSection
    title="History"
    ink="contrast"
    divided
    hint="Emit association.added and association.removed on the parent record. Junction tables do not get their own Timeline."
  >
    <div className="grid w-full min-w-0 grid-cols-2 gap-3">
      <FormField label="Track" className="col-span-2 min-w-0 w-full">
        <UiCheckbox
          size="sm"
          checked={value.trackAssignRemove}
          onChange={(event) => onChange({ ...value, trackAssignRemove: event.target.checked })}
        >
          Track assign and remove
        </UiCheckbox>
      </FormField>
    </div>
  </FormSection>
);

export const ModelHistoryFields: React.FC<{
  value: ModelHistoryForm;
  onChange: (next: ModelHistoryForm) => void;
}> = ({ value, onChange }) => (
  <div className="flex flex-col gap-3">
    <FormField label="History" className="w-full min-w-0">
      <UiCheckbox
        size="sm"
        checked={value.enabled}
        onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
      >
        Enable record event log for this model
      </UiCheckbox>
    </FormField>
    <FormField
      label="Lifecycle field"
      hint="Status or lock column. Changes emit status.changed."
      className="w-full min-w-0"
    >
      <UiInput
        size="sm"
        aiAssist={false}
        className="block w-full min-w-0"
        value={value.lifecycleField}
        onChange={(event) => onChange({ ...value, lifecycleField: event.target.value })}
        ariaLabel="Lifecycle field"
        placeholder="status_id"
      />
    </FormField>
    <FormField label="Legal hold" className="w-full min-w-0">
      <UiCheckbox
        size="sm"
        checked={value.legalHold}
        onChange={(event) => onChange({ ...value, legalHold: event.target.checked })}
      >
        Block retention and DSAR erase for every subject of this model
      </UiCheckbox>
    </FormField>
  </div>
);
