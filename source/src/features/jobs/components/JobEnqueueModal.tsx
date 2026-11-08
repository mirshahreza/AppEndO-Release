import React, { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { AppButton, UiInput, UiTextarea } from '../../../shared/ui';
import { CreateEditModalShell } from '../../../shared/ui/CreateEditModalShell';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_VIEW_CLASS } from '../../../shared/ui/surfaceClasses';
import type { EnqueueJobPayload } from '../../../shared/api/contracts/jobs/types';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { ServerFunctionPickerDialog, type ServerFunctionPickerItem } from '../../scheduled-tasks/components/ServerFunctionPickerDialog';

export type JobEnqueueForm = EnqueueJobPayload & { payloadText: string };

export type JobEnqueueModalProps = {
  open: boolean;
  form: JobEnqueueForm;
  functionCatalog: ServerFunctionPickerItem[];
  formError: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: (next: JobEnqueueForm) => void;
};

export const JobEnqueueModal: React.FC<JobEnqueueModalProps> = ({
  open,
  form,
  functionCatalog,
  formError,
  isSaving,
  onClose,
  onSubmit,
  onFormChange,
}) => {
  const t = useCultureT();
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedFunction = useMemo(
    () => functionCatalog.find((item) => item.id === form.functionId) ?? null,
    [form.functionId, functionCatalog],
  );

  const payloadJsonObjectMsg = t(operationsKey('common.payloadJsonObject'));
  const payloadJsonInvalidMsg = t(operationsKey('common.payloadJsonInvalid'));
  const isPayloadFieldError = formError === payloadJsonObjectMsg || formError === payloadJsonInvalidMsg;
  const payloadError = isPayloadFieldError ? formError : null;
  const modalError = formError && !isPayloadFieldError ? formError : null;

  if (!open) return null;

  return (
    <>
      <CreateEditModalShell
        size="2xl"
        title={t(operationsKey('jobs.modal.title'))}
        onClose={onClose}
        onBackdropClick={onClose}
        footer={(
          <>
            <AppButton intent="cancel" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              {t('actions.cancel')}
            </AppButton>
            <AppButton intent="create" onClick={onSubmit} disabled={isSaving}>
              <Plus className="h-3.5 w-3.5" />
              {isSaving ? t(operationsKey('jobs.enqueueing')) : t(operationsKey('jobs.enqueue'))}
            </AppButton>
          </>
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-xs font-semibold text-slate-600">{t(operationsKey('common.serverFunction'))}</label>
            <div className="flex items-center gap-2">
              <UiInput
                size="sm"
                autoDir={false}
                value={form.functionId}
                readOnly
                placeholder={t(operationsKey('jobs.modal.selectFunctionPlaceholder'))}
              />
              <AppButton
                size="icon-md"
                className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_VIEW_CLASS}`}
                aria-label={t(operationsKey('common.selectFunctionAria'))}
                title={t(operationsKey('common.selectFunctionAria'))}
                onClick={() => setPickerOpen(true)}
              >
                <Search className="h-4 w-4" />
              </AppButton>
            </div>
            {selectedFunction ? (
              <span className="ps-[4px] text-[11px] text-slate-500">
                {selectedFunction.method} {selectedFunction.path}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-xs font-semibold text-slate-600">{t(operationsKey('common.title'))}</label>
            <UiInput
              size="sm"
              value={form.title ?? ''}
              onChange={(event) => onFormChange({ ...form, title: event.target.value })}
              placeholder={selectedFunction?.name || t(operationsKey('common.optionalDisplayTitle'))}
            />
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-xs font-semibold text-slate-600">{t(operationsKey('common.payloadJson'))}</label>
            <UiTextarea
              size="sm"
              value={form.payloadText}
              onChange={(event) => onFormChange({ ...form, payloadText: event.target.value })}
              className="font-mono text-xs min-h-[120px]"
              isInvalid={Boolean(payloadError)}
              errorMessage={payloadError ?? undefined}
              autoDir={false}
            />
          </div>

          {modalError ? <p className="text-xs font-semibold text-rose-600">{modalError}</p> : null}
        </div>
      </CreateEditModalShell>

      <ServerFunctionPickerDialog
        open={pickerOpen}
        functions={functionCatalog}
        selectedId={form.functionId}
        onClose={() => setPickerOpen(false)}
        onSelect={(functionId) => onFormChange({
          ...form,
          functionId,
          title: form.title?.trim() ? form.title : (functionCatalog.find((item) => item.id === functionId)?.name ?? ''),
        })}
      />
    </>
  );
};
