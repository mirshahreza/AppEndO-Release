import React from 'react';
import { Check } from 'lucide-react';
import { AppButton, CreateEditModalShell } from '@/shared/ui';
import type { RoleFormState } from '../types';

export type RoleCreateModalProps = {
  open: boolean;
  form: RoleFormState;
  onFormChange: (form: RoleFormState) => void;
  formError: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

export const RoleCreateModal: React.FC<RoleCreateModalProps> = ({
  open,
  form,
  onFormChange,
  formError,
  isSaving,
  onClose,
  onSubmit,
}) => {
  if (!open) return null;

  return (
    <CreateEditModalShell
      size="lg"
      title="Create Role"
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>Cancel</AppButton>
          <AppButton intent="primary" onClick={onSubmit} disabled={isSaving}>
            <Check className="w-3.5 h-3.5" />{isSaving ? 'Saving...' : 'Create'}
          </AppButton>
        </>
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-[2px]">
          <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Role Name *</label>
          <input type="text" value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })} placeholder="Moderator" className="h-8 text-xs px-2.5 border border-slate-200 rounded-md outline-none focus:border-indigo-400 bg-white text-slate-800 font-mono" />
        </div>
        <div className="flex flex-col gap-[2px] sm:col-span-2">
          <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Note</label>
          <input type="text" value={form.note} onChange={(e) => onFormChange({ ...form, note: e.target.value })} placeholder="Add a note for this role..." className="h-8 text-xs px-2.5 border border-slate-200 rounded-md outline-none focus:border-indigo-400 bg-white text-slate-800" />
        </div>
      </div>
      {formError && <p className="mt-2 text-xs text-red-600 font-semibold">{formError}</p>}
    </CreateEditModalShell>
  );
};
