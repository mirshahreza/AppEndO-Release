import type { BaseInfoEditForm } from '../types';

export const buildBaseInfoSavePayload = (editForm: BaseInfoEditForm) => ({
  parentId: editForm.parentId.trim() || undefined,
  title: editForm.title.trim() || undefined,
  shortName: editForm.shortName.trim() || undefined,
  note: editForm.note.trim() || undefined,
  viewOrder: editForm.viewOrder.trim() ? Number(editForm.viewOrder) : undefined,
  value: editForm.value.trim() ? Number(editForm.value) : undefined,
  metadata: editForm.metadata.trim() || undefined,
  uiColor: editForm.uiColor.trim() || undefined,
  uiHtml: editForm.uiHtml.trim() || undefined,
  isActive: editForm.isActive,
});

export const buildBaseInfoCreatePayload = (
  editForm: BaseInfoEditForm,
  childDigits = 3,
) => {
  const parsedChildDigits = Number(editForm.childDigits || String(childDigits));
  const resolvedChildDigits = Number.isFinite(parsedChildDigits) && parsedChildDigits > 0
    ? parsedChildDigits
    : childDigits;
  return {
    ...buildBaseInfoSavePayload(editForm),
    childDigits: resolvedChildDigits,
  };
};
