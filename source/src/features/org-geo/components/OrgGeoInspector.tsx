import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { UiColorField } from '../../../components/ui/UiColorField';
import { AppButton, UiCheckboxChoice, UiInput } from '../../../shared/ui';
import { resolveLucideIconNameFromUiHtml } from '../../../shared/lib/baseInfoUiIcon';
import { normalizeHexColor } from '../../../shared/lib/uiColorUtils';
import { InspectorLucideIconPickerField } from '../../component-designer/components/InspectorLucideIconPickerField';
import type { ScopedBaseInfoTreeModel } from '../hooks/useScopedBaseInfoTree';
import {
  accentTextClasses,
  type OrgGeoWorkspaceConfig,
} from '../lib/orgGeoWorkspaceConfig';
import { resolveOrgChartLevelTitle } from '../lib/orgChartRootConfig';
import { resolveGeoNodeTypeLabel } from '../lib/orgGeoNodeKind';
import { OrgGeoMembersPanel } from './OrgGeoMembersPanel';

type OrgGeoInspectorProps = {
  page: ScopedBaseInfoTreeModel;
  config: OrgGeoWorkspaceConfig;
  onClose: () => void;
};

const toLucideUiHtml = (iconName: string): string => {
  const trimmed = iconName.trim();
  if (!trimmed) return '';
  return `<i data-lucide="${trimmed}"></i>`;
};

const InspectorHeader: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="flex items-center justify-between gap-2">
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Selected</p>
    <button
      type="button"
      aria-label="Close inspector"
      title="Close inspector"
      onClick={onClose}
      className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  </div>
);

export const OrgGeoInspector: React.FC<OrgGeoInspectorProps> = ({ page, config, onClose }) => {
  const selected = page.selectedChartRow;
  const selectedDepth = selected
    ? Math.max(0, selected.id.split('.').length - page.rootId.split('.').length)
    : 0;
  const { tint, linkTint } = accentTextClasses(config.accent);
  const canDelete = Boolean(selected && selected.id !== page.rootId && !selected.has_children);
  const canAddChild = Boolean(selected && selected.id !== page.rootId);

  const [titleEn, setTitleEn] = useState('');
  const [iconName, setIconName] = useState('');
  const [uiColor, setUiColor] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!selected) {
      setTitleEn('');
      setIconName('');
      setUiColor('');
      setIsActive(true);
      return;
    }
    setTitleEn(selected.title_en || selected.title || selected.label || '');
    setIconName(resolveLucideIconNameFromUiHtml(selected.ui_html) || '');
    // Empty = inherit level color (same as empty icon → inherit level icon).
    setUiColor(normalizeHexColor(selected.ui_color) || '');
    setIsActive(selected.is_active !== false);
  }, [
    selected?.id,
    selected?.title_en,
    selected?.title,
    selected?.label,
    selected?.ui_html,
    selected?.ui_color,
    selected?.is_active,
  ]);

  const saveDraft = () => {
    if (!selected) return;
    void page.quickUpdateSelected({
      titleEn: titleEn.trim(),
      uiHtml: toLucideUiHtml(iconName),
      uiColor: normalizeHexColor(uiColor) || '',
      isActive,
    });
  };

  if (!selected) return null;

  const typeLabel = config.resolveNodeTypeLabel?.(selected)
    ?? resolveGeoNodeTypeLabel(selected)
    ?? resolveOrgChartLevelTitle(selectedDepth, page.rootChartConfig, config.levelLabel);

  return (
    <aside className="flex w-full min-w-0 shrink-0 flex-col gap-3 overflow-y-auto overflow-x-hidden border-t border-slate-200 bg-white p-4 lg:w-80 lg:border-s lg:border-t-0">
      <InspectorHeader onClose={onClose} />
      <p className="font-mono text-[11px] text-slate-400">{selected.id}</p>
      <p className={`text-xs font-medium ${tint}`}>
        {typeLabel}
      </p>

      <div className="flex items-center gap-2">
        <InspectorLucideIconPickerField
          label=""
          compact
          clearable
          value={iconName}
          onChange={setIconName}
          ariaLabel={config.iconPickerAriaLabel}
          fallbackIcon={config.fallbackIcon}
        />
        <div className="w-[7.5rem] shrink-0">
          <UiColorField
            value={uiColor}
            onChange={setUiColor}
            ariaLabel="Node color"
            disabled={page.isSaving}
            placeholder="#hex"
            clearable
          />
        </div>
        <UiInput
          className="min-w-0 flex-1"
          size="sm"
          value={titleEn}
          ariaLabel="Title"
          placeholder="Title"
          disabled={page.isSaving}
          onChange={(event) => setTitleEn(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              saveDraft();
            }
          }}
        />
      </div>
      <div className="flex h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 py-[2px]">
        <UiCheckboxChoice
          checked={isActive}
          disabled={page.isSaving}
          onChange={setIsActive}
          className="text-xs text-slate-700"
        >
          Active
        </UiCheckboxChoice>
      </div>

      <div className="flex items-center justify-between gap-2">
        <AppButton
          intent="primary"
          size="sm"
          disabled={page.isSaving || !titleEn.trim()}
          onClick={saveDraft}
        >
          {page.isSaving ? 'Saving…' : 'Save'}
        </AppButton>
        <button
          type="button"
          onClick={() => page.openEditModal(selected)}
          className={`text-xs font-medium no-underline hover:underline ${linkTint}`}
        >
          More
        </button>
      </div>

      <OrgGeoMembersPanel dimensionKey={config.dimensionKey} nodeId={selected.id} />

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <AppButton
          type="button"
          intent="primary"
          size="sm"
          disabled={!canAddChild || page.isLoading || page.isSaving || page.isMoving}
          onClick={() => page.openCreateChildById(selected.id)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add child
        </AppButton>
        <AppButton
          type="button"
          intent="destructive-soft"
          size="sm"
          disabled={!canDelete || page.isDeleting}
          onClick={() => page.openDeleteModal(selected)}
          title={
            selected.id === page.rootId
              ? 'Root cannot be deleted'
              : selected.has_children
                ? 'Remove child nodes first'
                : 'Delete node'
          }
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </AppButton>
      </div>
    </aside>
  );
};
