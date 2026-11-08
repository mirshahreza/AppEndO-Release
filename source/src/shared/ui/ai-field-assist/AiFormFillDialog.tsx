import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Mic, MicOff, Sparkles } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type {
  EuaAssistSurface,
  EuaExtractedFieldValue,
  EuaFieldAssistFillMode,
  EuaFieldMapEntry,
} from '../../api/contracts/ai/euaFieldAssist';
import { fillFormFromText } from '../../api/queries/euaFieldAssist';
import { extractFieldValuesLocally } from './buildStructuredExtractPrompt';
import { filterEuaFieldsBySection } from './buildFillFormPrompt';
import { useBrowserSpeechRecognition } from './useBrowserSpeechRecognition';
import { buildVoiceFillSummary, useBrowserTextToSpeech } from './useBrowserTextToSpeech';
import { useIsEuaCapabilityEnabled } from './useEuaCapability';
import { AppButton } from '../AppButton';
import { ConfirmDialogShell } from '../ConfirmDialogShell';
import { FormField } from '../FormSection';
import { UiCheckboxChoice } from '../FormChoiceFields';
import { UiTextareaCore } from '../HeroFieldControls';

type ReviewRow = {
  name: string;
  label: string;
  currentValue: string;
  nextValue: string;
  selected: boolean;
};

export type AiFormFillDialogProps = {
  open: boolean;
  fields: EuaFieldMapEntry[];
  fillMode?: EuaFieldAssistFillMode;
  sectionId?: string;
  formId?: string;
  sectionTitle?: string;
  sectionDescription?: string;
  surface?: EuaAssistSurface;
  modelId?: string;
  disabled?: boolean;
  actionsEnabled?: boolean;
  enableVoice?: boolean;
  enableTtsConfirm?: boolean;
  title?: string;
  sourceLabel?: string;
  sourcePlaceholder?: string;
  onClose: () => void;
  onApply: (updates: EuaExtractedFieldValue[]) => void;
};

export const AiFormFillDialog: React.FC<AiFormFillDialogProps> = ({
  open,
  fields,
  fillMode = 'extract',
  sectionId,
  formId,
  sectionTitle,
  sectionDescription,
  surface = 'admin',
  modelId,
  disabled = false,
  actionsEnabled = false,
  enableVoice = false,
  enableTtsConfirm = false,
  title,
  sourceLabel,
  sourcePlaceholder,
  onClose,
  onApply,
}) => {
  const [sourceText, setSourceText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const scopedFields = useMemo(
    () => filterEuaFieldsBySection(fields, sectionId),
    [fields, sectionId],
  );
  const speech = useBrowserSpeechRecognition({
    onFinalTranscript: (text) => setSourceText(text),
  });
  const tts = useBrowserTextToSpeech();
  const voiceCapabilityEnabled = useIsEuaCapabilityEnabled('eua.voiceFormFill');
  const ttsCapabilityEnabled = useIsEuaCapabilityEnabled('eua.voiceTtsConfirm');

  const canRun = !disabled && actionsEnabled && Boolean(modelId) && scopedFields.length > 0;
  const hasReview = reviewRows.length > 0;
  const selectedCount = useMemo(
    () => reviewRows.filter((row) => row.selected).length,
    [reviewRows],
  );

  const dialogTitle = title ?? (fillMode === 'narrative' ? 'Fill form from description' : 'Fill fields from text');
  const label = sourceLabel ?? (fillMode === 'narrative' ? 'Describe what to enter' : 'Paste unstructured text');
  const placeholder = sourcePlaceholder ?? (
    fillMode === 'narrative'
      ? 'e.g. Register Northwind API Gateway for production with nightly EU sync notes for operators.'
      : 'e.g. Display name: Northwind API, Environment: production, Notes: nightly sync job.'
  );

  useEffect(() => {
    if (open) {
      setSourceText('');
      setError(null);
      setReviewRows([]);
      setIsRunning(false);
    } else {
      speech.stop();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens/closes only
  }, [open]);

  useEffect(() => {
    if (speech.transcript) {
      setSourceText(speech.transcript);
    }
  }, [speech.transcript]);

  const buildReviewRows = useCallback((entries: EuaExtractedFieldValue[]): ReviewRow[] => {
    const labelByName = new Map(scopedFields.map((field) => [field.name, field.label]));
    const currentByName = new Map(
      scopedFields.map((field) => [field.name, field.currentValue?.trim() ?? '']),
    );

    return entries.map((entry) => ({
      name: entry.name,
      label: labelByName.get(entry.name) ?? entry.name,
      currentValue: currentByName.get(entry.name) ?? '',
      nextValue: entry.value,
      selected: true,
    }));
  }, [scopedFields]);

  const handleExtract = useCallback(async () => {
    if (!canRun || !sourceText.trim()) {
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const result = await fillFormFromText({
        text: sourceText,
        fields: scopedFields,
        mode: fillMode,
        sectionId,
        formId,
        sectionTitle,
        sectionDescription,
        modelId,
        surface,
      });

      setReviewRows(buildReviewRows(result.fields));
    } catch (extractError) {
      const localFields = extractFieldValuesLocally(sourceText, scopedFields);
      if (localFields.length > 0) {
        setReviewRows(buildReviewRows(localFields));
        return;
      }

      const message = extractError instanceof Error ? extractError.message : 'Form fill failed.';
      setError(message);
      setReviewRows([]);
    } finally {
      setIsRunning(false);
    }
  }, [
    buildReviewRows,
    canRun,
    fillMode,
    formId,
    modelId,
    scopedFields,
    sectionDescription,
    sectionId,
    sectionTitle,
    sourceText,
    surface,
  ]);

  const handleApply = useCallback(() => {
    const updates = reviewRows
      .filter((row) => row.selected)
      .map((row) => ({ name: row.name, value: row.nextValue }));
    if (updates.length === 0) {
      return;
    }
    onApply(updates);

    if (enableTtsConfirm && ttsCapabilityEnabled && surface === 'published') {
      tts.speak(buildVoiceFillSummary(
        updates.map((entry) => ({
          label: scopedFields.find((field) => field.name === entry.name)?.label ?? entry.name,
          value: entry.value,
        })),
      ));
    }

    onClose();
  }, [
    enableTtsConfirm,
    onApply,
    onClose,
    reviewRows,
    scopedFields,
    surface,
    tts,
    ttsCapabilityEnabled,
  ]);

  const showVoice = enableVoice && voiceCapabilityEnabled && surface === 'published';

  return (
    <ConfirmDialogShell
      open={open}
      title={dialogTitle}
      size="md"
      onClose={onClose}
      onConfirm={hasReview ? handleApply : () => { void handleExtract(); }}
      confirmIntent="primary"
      confirmLabel={hasReview ? `Apply selected (${selectedCount})` : (fillMode === 'narrative' ? 'Fill form' : 'Extract fields')}
      confirmingLabel={hasReview ? 'Applying…' : 'Working…'}
      isConfirming={isRunning}
      confirmDisabled={hasReview ? selectedCount === 0 : !canRun || !sourceText.trim()}
      cancelLabel="Cancel"
      error={error ?? speech.error ?? undefined}
      bodyClassName="w-full min-w-0 space-y-3"
    >
      {showVoice ? (
        <div className="flex items-center gap-2">
          <AppButton
            intent={speech.isListening ? 'danger' : 'utility'}
            size="sm"
            disabled={!canRun}
            onClick={() => {
              if (speech.isListening) {
                speech.stop();
              } else {
                speech.start();
              }
            }}
          >
            {speech.isListening ? <MicOff className="h-3.5 w-3.5" aria-hidden /> : <Mic className="h-3.5 w-3.5" aria-hidden />}
            {speech.isListening ? 'Stop listening' : 'Speak to fill'}
          </AppButton>
          {!speech.supported ? (
            <p className="text-[11px] text-slate-500">Speech recognition is not supported in this browser.</p>
          ) : null}
        </div>
      ) : null}

      <FormField label={label} className="w-full min-w-0">
        <UiTextareaCore
          className="block w-full min-w-0"
          rows={5}
          autoFocus={!showVoice}
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          placeholder={placeholder}
          aiAssist={false}
        />
      </FormField>

      {!canRun ? (
        <p className="text-[11px] leading-snug text-slate-500 ps-[4px]">
          No chat-capable AI model is configured. Check Settings → AI Models.
        </p>
      ) : null}

      {hasReview ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 ps-[4px]">
            Confirm fields to apply
          </p>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-[6px] border border-slate-200 bg-slate-50/60 p-2">
            {reviewRows.map((row) => (
              <div
                key={row.name}
                className={cn(
                  'rounded-[6px] border border-slate-200 bg-white px-2 py-1.5',
                  !row.selected && 'opacity-60',
                )}
              >
                <UiCheckboxChoice
                  size="sm"
                  checked={row.selected}
                  onChange={(selected) => {
                    setReviewRows((current) => current.map((item) => (
                      item.name === row.name ? { ...item, selected } : item
                    )));
                  }}
                >
                  <span className="text-xs font-semibold text-slate-700">{row.label}</span>
                </UiCheckboxChoice>
                <div className="mt-1 space-y-0.5 ps-[4px] text-[11px] leading-snug">
                  {row.currentValue ? (
                    <p className="text-slate-400 line-through">{row.currentValue}</p>
                  ) : (
                    <p className="text-slate-400 italic">(empty)</p>
                  )}
                  <p className="text-slate-700">{row.nextValue}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </ConfirmDialogShell>
  );
};

export type AiFormFillLauncherProps = {
  fields: EuaFieldMapEntry[];
  fillMode?: EuaFieldAssistFillMode;
  sectionId?: string;
  formId?: string;
  sectionTitle?: string;
  sectionDescription?: string;
  surface?: EuaAssistSurface;
  modelId?: string;
  disabled?: boolean;
  actionsEnabled?: boolean;
  enableVoice?: boolean;
  enableTtsConfirm?: boolean;
  label?: string;
  title?: string;
  onApply: (updates: EuaExtractedFieldValue[]) => void;
  className?: string;
};

export const AiFormFillLauncher: React.FC<AiFormFillLauncherProps> = ({
  fields,
  fillMode = 'extract',
  sectionId,
  formId,
  sectionTitle,
  sectionDescription,
  surface = 'admin',
  modelId,
  disabled = false,
  actionsEnabled = false,
  enableVoice = false,
  enableTtsConfirm = false,
  label = 'Fill from text',
  title,
  onApply,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const canLaunch = !disabled && actionsEnabled && Boolean(modelId) && fields.length > 0;

  return (
    <>
      <AppButton
        intent="utility"
        size="sm"
        className={className}
        disabled={!canLaunch}
        onClick={() => setOpen(true)}
      >
        {enableVoice ? <Mic className="h-3.5 w-3.5" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </AppButton>

      <AiFormFillDialog
        open={open}
        fields={fields}
        fillMode={fillMode}
        sectionId={sectionId}
        formId={formId}
        sectionTitle={sectionTitle}
        sectionDescription={sectionDescription}
        surface={surface}
        modelId={modelId}
        disabled={disabled}
        actionsEnabled={actionsEnabled}
        enableVoice={enableVoice}
        enableTtsConfirm={enableTtsConfirm}
        title={title}
        onClose={() => setOpen(false)}
        onApply={onApply}
      />
    </>
  );
};

export const AiStructuredExtractDialog: React.FC<Omit<AiFormFillDialogProps, 'fillMode' | 'enableVoice' | 'enableTtsConfirm'>> = (props) => (
  <AiFormFillDialog {...props} fillMode="extract" />
);

export const AiStructuredExtractLauncher: React.FC<Omit<AiFormFillLauncherProps, 'fillMode' | 'enableVoice' | 'enableTtsConfirm' | 'label'> & { className?: string }> = (props) => (
  <AiFormFillLauncher {...props} fillMode="extract" label="Fill from text" />
);

export const AiVoiceFormFillLauncher: React.FC<Omit<AiFormFillLauncherProps, 'fillMode' | 'enableVoice' | 'label' | 'title'>> = (props) => (
  <AiFormFillLauncher
    {...props}
    fillMode="narrative"
    enableVoice
    enableTtsConfirm
    label="Fill with voice"
    title="Fill form with voice"
  />
);

export const AiTextToFormLauncher: React.FC<Omit<AiFormFillLauncherProps, 'fillMode' | 'label' | 'title'>> = (props) => (
  <AiFormFillLauncher
    {...props}
    fillMode="narrative"
    label="Describe to fill"
    title="Fill form from description"
  />
);

export type AiStructuredExtractDialogProps = AiFormFillDialogProps;
export type AiStructuredExtractLauncherProps = AiFormFillLauncherProps;
