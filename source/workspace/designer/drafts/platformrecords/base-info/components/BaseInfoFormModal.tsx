import React, { Suspense, lazy } from 'react';
import { Check } from 'lucide-react';
import { UiCheckboxChoice, UiInput, UiTextarea } from '@/src/shared/ui';
import { UiColorField } from '@/src/components/ui/UiColorField';
import { cn } from '@/src/lib/utils';
import { AppButton, CreateEditModalShell } from '@/src/shared/ui';
import { UI_HTML_EDITOR_HEIGHT, UI_HTML_EDITOR_LINE_HEIGHT } from '../constants';
import type { BaseInfoPageModel } from '../hooks/useBaseInfoPage';

type BaseInfoFormModalProps = {
  page: BaseInfoPageModel;
};

const Editor = lazy(() => import('@monaco-editor/react'));

export const BaseInfoFormModal: React.FC<BaseInfoFormModalProps> = ({ page }) => {
  if (!page.isModalOpen) {
    return null;
  }

  return (
    <CreateEditModalShell
      size="5xl"
      title={page.isCreateMode ? 'Create Base Info' : `Edit Base Info #${page.editingId}`}
      onClose={page.closeModal}
      footer={(
        <>
          <AppButton intent="cancel" onClick={page.closeModal}>Cancel</AppButton>
          <AppButton intent="primary" onClick={page.isCreateMode ? page.submitCreate : page.submitEdit} disabled={page.isSaving}>
            <Check className="w-3.5 h-3.5" />
            {page.isSaving ? 'Saving...' : page.isCreateMode ? 'Create' : 'Save'}
          </AppButton>
        </>
      )}
    >
          <div className="overflow-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Active</label>
              <div className="mt-[2px] h-8 rounded-md border border-slate-200 bg-white p-[2px] flex items-center">
                <UiCheckboxChoice
                  checked={page.editForm.isActive}
                  onChange={(checked) => page.setEditForm((p) => ({ ...p, isActive: checked }))}
                  className="text-xs text-slate-700"
                >
                  Active
                </UiCheckboxChoice>
              </div>
            </div>

            <div className={cn(page.isCreateMode ? 'xl:col-span-2' : 'xl:col-span-3')}>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Parent</label>
              <div className="mt-[2px] h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 flex items-center">
                {page.parentDisplayValue}
              </div>
            </div>

            {page.isCreateMode ? (
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Child Digits</label>
                <UiInput className="mt-[2px]" size="sm" value={page.editForm.childDigits} onChange={(e) => page.setEditForm((p) => ({ ...p, childDigits: e.target.value }))} />
              </div>
            ) : null}

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Title (Default)</label>
              <UiInput className="mt-[2px]" size="sm" value={page.editForm.title} onChange={(e) => page.setEditForm((p) => ({ ...p, title: e.target.value }))} />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Title En</label>
              <UiInput className="mt-[2px]" size="sm" value={page.editForm.titleEn} onChange={(e) => page.setEditForm((p) => ({ ...p, titleEn: e.target.value }))} />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Title Fa</label>
              <UiInput className="mt-[2px]" size="sm" value={page.editForm.titleFa} onChange={(e) => page.setEditForm((p) => ({ ...p, titleFa: e.target.value }))} />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Title Ar</label>
              <UiInput className="mt-[2px]" size="sm" value={page.editForm.titleAr} onChange={(e) => page.setEditForm((p) => ({ ...p, titleAr: e.target.value }))} />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Note</label>
              <UiTextarea className="mt-[2px]" size="sm" rows={3} value={page.editForm.note} onChange={(e) => page.setEditForm((p) => ({ ...p, note: e.target.value }))} />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Note En</label>
              <UiTextarea className="mt-[2px]" size="sm" rows={3} value={page.editForm.noteEn} onChange={(e) => page.setEditForm((p) => ({ ...p, noteEn: e.target.value }))} />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Note Fa</label>
              <UiTextarea className="mt-[2px]" size="sm" rows={3} value={page.editForm.noteFa} onChange={(e) => page.setEditForm((p) => ({ ...p, noteFa: e.target.value }))} />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Note Ar</label>
              <UiTextarea className="mt-[2px]" size="sm" rows={3} value={page.editForm.noteAr} onChange={(e) => page.setEditForm((p) => ({ ...p, noteAr: e.target.value }))} />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">View Order</label>
              <UiInput className="mt-[2px]" size="sm" value={page.editForm.viewOrder} onChange={(e) => page.setEditForm((p) => ({ ...p, viewOrder: e.target.value }))} />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Value</label>
              <UiInput className="mt-[2px]" size="sm" value={page.editForm.value} onChange={(e) => page.setEditForm((p) => ({ ...p, value: e.target.value }))} />
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">Metadata</label>
              <UiTextarea className="mt-[2px]" size="sm" rows={3} value={page.editForm.metadata} onChange={(e) => page.setEditForm((p) => ({ ...p, metadata: e.target.value }))} />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">UI Color</label>
              <UiColorField
                className="mt-[2px]"
                value={page.editForm.uiColor}
                onChange={(nextValue) => page.setEditForm((p) => ({ ...p, uiColor: nextValue }))}
                ariaLabel="UI color hex"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">UI Html</label>
              <div className="mt-[2px] w-full overflow-hidden rounded-md border border-slate-300 p-[2px]">
                <Suspense fallback={<div className="flex items-center justify-center text-xs text-slate-500" style={{ height: `${UI_HTML_EDITOR_HEIGHT}px` }}>Loading editor…</div>}>
                  <Editor
                    language="html"
                    value={page.editForm.uiHtml}
                    onChange={(value) => page.setEditForm((p) => ({ ...p, uiHtml: value ?? '' }))}
                    height={`${UI_HTML_EDITOR_HEIGHT}px`}
                    options={{
                      minimap: { enabled: false },
                      wordWrap: 'on',
                      lineNumbers: 'off',
                      glyphMargin: false,
                      folding: false,
                      lineDecorationsWidth: 8,
                      lineNumbersMinChars: 0,
                      overviewRulerBorder: false,
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      lineHeight: UI_HTML_EDITOR_LINE_HEIGHT,
                      padding: { top: 8, bottom: 8 },
                    }}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>

      {page.saveError ? <p className="mt-2 text-xs text-red-600 font-semibold">{page.saveError}</p> : null}
    </CreateEditModalShell>
  );
};
