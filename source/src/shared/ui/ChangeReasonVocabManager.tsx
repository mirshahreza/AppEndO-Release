import React, { useMemo, useState } from 'react';
import { ListPlus, Pencil, Tags } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EMPTY_BASE_INFO_EDIT_FORM,
  type BaseInfoEditForm,
} from '../api/contracts/base-info/editForm';
import type { BaseInfoRow } from '../api/contracts/base-info/types';
import { RECORD_CHANGE_REASON_FOLDER_OPTIONS } from '../api/contracts/record-events';
import {
  createBaseInfoNode,
  fetchBaseInfoChildren,
  updateBaseInfoNode,
  baseInfoQueryKeys,
} from '../api/queries/base-info';
import { mapBaseInfoListRowToFormRecord } from '../lib/baseInfoFormRowMap';
import { AppButton } from './AppButton';
import { BaseInfoFormFields } from './BaseInfoFormFields';
import { CreateEditModalShell } from './CreateEditModalShell';

const toEditForm = (row: BaseInfoRow, parentId: string): BaseInfoEditForm => {
  const mapped = mapBaseInfoListRowToFormRecord(row as unknown as Record<string, unknown>);
  return {
    ...EMPTY_BASE_INFO_EDIT_FORM,
    parentId,
    title: String(mapped.title ?? row.label ?? ''),
    titleEn: String(mapped.titleEn ?? ''),
    titleFa: String(mapped.titleFa ?? ''),
    titleAr: String(mapped.titleAr ?? ''),
    shortName: String(mapped.shortName ?? ''),
    note: String(mapped.note ?? ''),
    noteEn: String(mapped.noteEn ?? ''),
    noteFa: String(mapped.noteFa ?? ''),
    noteAr: String(mapped.noteAr ?? ''),
    viewOrder: mapped.viewOrder == null ? '' : String(mapped.viewOrder),
    value: mapped.value == null ? '' : String(mapped.value),
    metadata: String(mapped.metadata ?? ''),
    uiColor: String(mapped.uiColor ?? ''),
    uiHtml: String(mapped.uiHtml ?? ''),
    isActive: mapped.isActive === true || mapped.isActive === 'true',
  };
};

const toSavePayload = (form: BaseInfoEditForm, parentId: string, isCreate: boolean) => ({
  parentId,
  ...(isCreate ? { childDigits: Number(form.childDigits) || 2 } : {}),
  title: form.title.trim() || undefined,
  titleEn: form.titleEn.trim() || undefined,
  titleFa: form.titleFa.trim() || undefined,
  titleAr: form.titleAr.trim() || undefined,
  shortName: form.shortName.trim() || undefined,
  note: form.note.trim() || undefined,
  noteEn: form.noteEn.trim() || undefined,
  noteFa: form.noteFa.trim() || undefined,
  noteAr: form.noteAr.trim() || undefined,
  viewOrder: form.viewOrder.trim() ? Number(form.viewOrder) : undefined,
  value: form.value.trim() ? Number(form.value) : undefined,
  metadata: form.metadata.trim() || undefined,
  uiColor: form.uiColor.trim() || undefined,
  uiHtml: form.uiHtml.trim() || undefined,
  isActive: form.isActive,
});

const folderLabel = (nodeId: string, fallbackTitle?: string): string => (
  RECORD_CHANGE_REASON_FOLDER_OPTIONS.find((item) => item.id === nodeId)?.label
  ?? fallbackTitle
  ?? nodeId
);

type ItemEditor = {
  parentId: string;
  row?: BaseInfoRow;
};

const ReasonItemList: React.FC<{
  parentId: string;
  title: string;
  onAdd: () => void;
  onEdit: (row: BaseInfoRow) => void;
}> = ({ parentId, title, onAdd, onEdit }) => {
  const query = useQuery({
    queryKey: baseInfoQueryKeys.children({ lang: 'en', root: '', parentId }),
    queryFn: () => fetchBaseInfoChildren({ lang: 'en', root: '', parentId }),
    enabled: Boolean(parentId),
  });
  const rows = (query.data ?? []).filter((row) => row.has_children !== true);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <AppButton size="sm" intent="create" onClick={onAdd}>
          <ListPlus className="h-3.5 w-3.5" />
          Add
        </AppButton>
      </div>
      {query.isLoading ? (
        <p className="text-xs text-slate-500">Loading reasons…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500">No reason items yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-700">{row.label || row.title_en || row.title}</p>
                <p className="font-mono text-[11px] text-slate-500">{row.id}</p>
              </div>
              <AppButton
                size="icon-sm"
                intent="secondary"
                aria-label={`Edit ${row.id}`}
                onClick={() => onEdit(row)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </AppButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export type ChangeReasonVocabManagerProps = {
  vocabNodeId?: string;
  folderTitle?: string;
  disabled?: boolean;
  open?: boolean;
  opening?: boolean;
  onOpenRequest?: () => void;
  onClose?: () => void;
};

export const ChangeReasonVocabManager: React.FC<ChangeReasonVocabManagerProps> = ({
  vocabNodeId,
  folderTitle,
  disabled = false,
  open,
  opening = false,
  onOpenRequest,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [editor, setEditor] = useState<ItemEditor | null>(null);
  const [form, setForm] = useState<BaseInfoEditForm>(EMPTY_BASE_INFO_EDIT_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;
  const parentId = vocabNodeId?.trim() ?? '';
  const sectionTitle = folderLabel(parentId, folderTitle);

  const closeEditor = () => {
    setEditor(null);
    setSaveError(null);
    setForm(EMPTY_BASE_INFO_EDIT_FORM);
  };

  const closeManager = () => {
    if (isControlled) {
      onClose?.();
    } else {
      setUncontrolledOpen(false);
    }
    closeEditor();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: baseInfoQueryKeys.all });
    await queryClient.invalidateQueries({ queryKey: ['change-reason-vocab'] });
  };

  const submit = async () => {
    if (!editor) return;
    if (!form.title.trim() && !form.titleEn.trim() && !form.titleFa.trim() && !form.titleAr.trim()) {
      setSaveError('At least one title is required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const body = toSavePayload(form, editor.parentId, !editor.row);
      if (editor.row) {
        await updateBaseInfoNode(editor.row.id, body);
      } else {
        await createBaseInfoNode(body);
      }
      await invalidate();
      closeEditor();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save reason item.');
    } finally {
      setSaving(false);
    }
  };

  const sections = useMemo(
    () => (parentId ? [{ parentId, title: sectionTitle }] : []),
    [parentId, sectionTitle],
  );

  return (
    <>
      <AppButton
        size="sm"
        intent="secondary"
        disabled={disabled || opening}
        onClick={() => {
          if (onOpenRequest) {
            onOpenRequest();
            return;
          }
          setUncontrolledOpen(true);
        }}
      >
        <Tags className="h-3.5 w-3.5" />
        {opening ? 'Opening…' : 'Manage reasons'}
      </AppButton>

      {isOpen && parentId ? (
        <CreateEditModalShell
          size="lg"
          title="Manage reason items"
          onClose={closeManager}
          footer={(
            <AppButton intent="cancel" onClick={closeManager}>
              Close
            </AppButton>
          )}
        >
          <div className="grid gap-5">
            {sections.map((section) => (
              <ReasonItemList
                key={section.parentId}
                parentId={section.parentId}
                title={section.title}
                onAdd={() => {
                  setForm({ ...EMPTY_BASE_INFO_EDIT_FORM, parentId: section.parentId, childDigits: '2' });
                  setEditor({ parentId: section.parentId });
                }}
                onEdit={(row) => {
                  setForm(toEditForm(row, section.parentId));
                  setEditor({ parentId: section.parentId, row });
                }}
              />
            ))}
          </div>
        </CreateEditModalShell>
      ) : null}

      {editor ? (
        <CreateEditModalShell
          size="lg"
          title={editor.row ? 'Edit reason item' : 'Add reason item'}
          onClose={closeEditor}
          footer={(
            <>
              <AppButton intent="cancel" onClick={closeEditor}>
                Cancel
              </AppButton>
              <AppButton intent="primary" onClick={() => void submit()} disabled={saving}>
                {saving ? 'Saving' : 'Save'}
              </AppButton>
            </>
          )}
        >
          {saveError ? (
            <p className="mb-3 text-xs text-rose-700">{saveError}</p>
          ) : null}
          <BaseInfoFormFields
            form={form}
            onFormChange={(updater) => setForm((previous) => updater(previous))}
            isCreateMode={!editor.row}
            parentDisplayValue={`${editor.parentId} — ${folderLabel(editor.parentId, folderTitle)}`}
          />
        </CreateEditModalShell>
      ) : null}
    </>
  );
};
