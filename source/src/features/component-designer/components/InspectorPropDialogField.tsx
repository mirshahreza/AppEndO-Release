import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { DesignerCodeEditorField, UiTextarea } from '../../../shared/ui';
import { DesignerDialog, DESIGNER_DIALOG_BODY_CLASS } from './dialogs/DesignerDialog';
import { DesignerFieldRow } from './DesignerFieldRow';
import {
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

export type InspectorPropDialogFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  dialogTitle: string;
  onChange: (value: string) => void;
  hideLabel?: boolean;
  /** Returns an error message for invalid drafts (e.g. malformed JSON) — Apply is disabled while set. */
  validate?: (draft: string) => string | null;
};

export const InspectorPropDialogField: React.FC<InspectorPropDialogFieldProps> = ({
  label,
  value,
  placeholder,
  dialogTitle,
  onChange,
  hideLabel = false,
  validate,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const validationError = validate ? validate(draft) : null;

  React.useEffect(() => {
    if (!isOpen) {
      setDraft(value);
    }
  }, [isOpen, value]);

  const preview = value.trim() || placeholder || 'Not set';

  const editorControl = (
    <div className="flex min-w-0 items-center gap-1.5">
      <div
        className={`min-w-0 flex-1 truncate rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/80 px-2 py-1 ${INSPECTOR_TEXT_XS} text-slate-600`}
        title={value.trim() || undefined}
      >
        {preview}
      </div>
      <button
        type="button"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-slate-400 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600"
        aria-label={`Edit ${label.toLowerCase()}`}
        onClick={() => setIsOpen(true)}
      >
        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );

  return (
    <>
      {hideLabel ? editorControl : (
        <DesignerFieldRow label={label}>
          {editorControl}
        </DesignerFieldRow>
      )}

      <DesignerDialog
        title={dialogTitle}
        open={isOpen}
        onClose={() => setIsOpen(false)}
        surfaceClassName="max-w-xl"
        bodyClassName={DESIGNER_DIALOG_BODY_CLASS}
        footer={(
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className={`h-8 rounded-md border border-slate-300 px-3 ${INSPECTOR_TEXT_SM} font-semibold text-slate-600 hover:bg-slate-100`}
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Boolean(validationError)}
              className={`h-8 rounded-md bg-cyan-600 px-3 ${INSPECTOR_TEXT_SM} font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300`}
              onClick={() => {
                onChange(draft);
                setIsOpen(false);
              }}
            >
              Apply
            </button>
          </div>
        )}
      >
        <div className="bg-white p-[15px]">
          {/*
            `validate` is only ever wired up for jsonEditor fields (InspectorPropFields /
            InspectorPropBindingControl both pass `validateJsonFieldDraft` here) — use it as the
            signal to upgrade to the Monaco JSON editor (syntax highlighting, bracket matching,
            inline parse-error squiggles) instead of a plain textarea. Non-JSON dialog usage
            (e.g. raw `className` editing) has no `validate` and keeps the plain textarea.
          */}
          {validate ? (
            <DesignerCodeEditorField
              ariaLabel={dialogTitle}
              language="json"
              editorHeight={180}
              lineNumbers={false}
              minimap={false}
              fontSize={12}
              placeholder={placeholder}
              value={draft}
              isInvalid={Boolean(validationError)}
              onChange={(nextValue) => setDraft(nextValue)}
            />
          ) : (
            <UiTextarea
              value={draft}
              placeholder={placeholder}
              onChange={(event) => setDraft(event.target.value)}
              autoDir={false}
              aiAssist={false}
              className={`min-h-[180px] w-full resize-y rounded-md border bg-white px-3 py-2 font-mono ${INSPECTOR_TEXT_SM} text-slate-700 outline-none focus:ring-1 ${validationError ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-cyan-400 focus:ring-cyan-200'}`}
              ariaLabel={dialogTitle}
              rows={8}
            />
          )}
          {validationError ? (
            <p className={`mt-1.5 ${INSPECTOR_TEXT_XS} font-medium text-red-600`}>{validationError}</p>
          ) : null}
        </div>
      </DesignerDialog>
    </>
  );
};
