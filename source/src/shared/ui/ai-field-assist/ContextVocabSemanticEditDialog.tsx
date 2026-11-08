import React, { useCallback, useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { AppButton } from '../AppButton';
import { CreateEditModalShell } from '../CreateEditModalShell';
import { UiTextarea } from '../HeroFieldControls';
import { FormField } from '../FormSection';
import {
  fetchVocabSemanticContext,
  patchVocabSemanticContext,
} from '../../api/queries/euaFieldAssist';
import { showAppFeedbackToast } from '../appFeedbackToast';

export type ContextVocabSemanticEditDialogProps = {
  open: boolean;
  recordId: string | null;
  expectedParentId?: string;
  recordTitle?: string;
  onClose: () => void;
  onSaved?: () => void;
};

export const ContextVocabSemanticEditDialog: React.FC<ContextVocabSemanticEditDialogProps> = ({
  open,
  recordId,
  expectedParentId,
  recordTitle,
  onClose,
  onSaved,
}) => {
  const [userGuidance, setUserGuidance] = useState('');
  const [semanticRubric, setSemanticRubric] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !recordId?.trim()) {
      setUserGuidance('');
      setSemanticRubric('');
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void fetchVocabSemanticContext(recordId)
      .then((record) => {
        if (cancelled) {
          return;
        }
        setUserGuidance(record.userGuidance);
        setSemanticRubric(record.semanticRubric);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Could not load record.';
        setLoadError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, recordId]);

  const handleSave = useCallback(async () => {
    if (!recordId?.trim()) {
      return;
    }
    setSaving(true);
    try {
      await patchVocabSemanticContext(recordId, {
        userGuidance,
        semanticRubric,
        expectedParentId,
      });
      showAppFeedbackToast('Guidance and validation rubric saved.', { type: 'success' });
      onSaved?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed.';
      showAppFeedbackToast(message, { type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [expectedParentId, onClose, onSaved, recordId, semanticRubric, userGuidance]);

  if (!open) {
    return null;
  }

  const title = recordTitle?.trim()
    ? `Edit guidance — ${recordTitle.trim()}`
    : 'Edit guidance and validation rubric';

  return (
    <CreateEditModalShell
      size="lg"
      title={title}
      onClose={onClose}
      closeOnEscape={!saving}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose} isDisabled={saving || loading}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            onClick={() => {
              void handleSave();
            }}
            isDisabled={saving || loading || !recordId?.trim()}
          >
            <Save className="h-3.5 w-3.5" aria-hidden />
            {saving ? 'Saving…' : 'Save'}
          </AppButton>
        </>
      )}
    >
      {loadError ? (
        <p className="mb-3 text-sm text-rose-700" role="alert">{loadError}</p>
      ) : null}
      <FormField label="User guidance (shown on the form)">
        <UiTextarea
          size="sm"
          rows={3}
          value={userGuidance}
          ariaLabel="User guidance"
          onChange={(event) => setUserGuidance(event.target.value)}
          isDisabled={loading || saving}
        />
      </FormField>
      <FormField label="Semantic validation rubric (for the AI checker)">
        <UiTextarea
          size="sm"
          rows={5}
          value={semanticRubric}
          ariaLabel="Semantic validation rubric"
          onChange={(event) => setSemanticRubric(event.target.value)}
          isDisabled={loading || saving}
        />
      </FormField>
    </CreateEditModalShell>
  );
};
