import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { lookupEmbeddedEnglish } from '../../../core/culture/embeddedTranslationBundles';
import { AppButton, CreateEditModalShell, FormField, UiInput } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { INLINE_TRANSLATION_EDIT_DIALOG_BACKDROP_CLASS } from './inlineTranslationDomMarkers';

export type InlineTranslationEditDialogProps = {
  open: boolean;
  cultureKey: string | null;
  currentValue: string;
  onClose: () => void;
  onSave: (nextValue: string) => Promise<void>;
};

export const InlineTranslationEditDialog: React.FC<InlineTranslationEditDialogProps> = ({
  open,
  cultureKey,
  currentValue,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState(currentValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(currentValue);
      setError(null);
      setSaving(false);
    }
  }, [currentValue, open]);

  if (!open || !cultureKey) {
    return null;
  }

  const masterLabel = lookupEmbeddedEnglish(cultureKey) || cultureKey;

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save translation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CreateEditModalShell
      size="md"
      title="Edit translation"
      onClose={onClose}
      onBackdropClick={onClose}
      closeOnEscape
      backdropClassName={cn(INLINE_TRANSLATION_EDIT_DIALOG_BACKDROP_CLASS, '!z-[150]')}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose} disabled={saving}>
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            disabled={saving || !draft.trim() || draft.trim() === currentValue.trim()}
            onClick={() => { void handleSave(); }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving…' : 'Replace'}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-4" data-inline-translation-ignore>
        <FormField label="Key" hint="Culture catalog key for this label.">
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 break-all">
            {cultureKey}
          </p>
        </FormField>
        <FormField label="Master (English)" hint="Built-in reference text.">
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {masterLabel}
          </p>
        </FormField>
        <FormField label="Current translation">
          <p className={cn('rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800')}>
            {currentValue}
          </p>
        </FormField>
        <FormField label="Corrected translation">
          <UiInput
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
          />
        </FormField>
        {error ? (
          <p className="text-sm text-rose-600" role="alert">{error}</p>
        ) : null}
      </div>
    </CreateEditModalShell>
  );
};
