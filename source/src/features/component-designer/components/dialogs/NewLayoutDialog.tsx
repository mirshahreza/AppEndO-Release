import * as React from 'react';
import { ChevronLeft, ChevronRight, LayoutTemplate, X } from 'lucide-react';
import { DesignerDialog, DESIGNER_DIALOG_BODY_CLASS, DESIGNER_DIALOG_BODY_FULL_HEIGHT_CLASS } from './DesignerDialog';
import { NativeButton } from '../../../../shared/ui/NativeButton';
import { AppButton, CatalogTagsField, type CatalogTagsFieldHandle, UiInput } from '../../../../shared/ui';
import {
  FIRST_RUN_WIZARD_TEMPLATES,
  NEW_LAYOUT_CATEGORY_OPTIONS,
  NEW_LAYOUT_CATEGORY_LABELS,
  NEW_LAYOUT_CATEGORY_TONES,
  countPresetsForCategory,
  filterPresetsByCategory,
  getPresetCategories,
  renderPresetMiniPreview,
  type FirstRunWizardTemplate,
  type NewLayoutPreset,
  type NewLayoutPresetCategory,
} from '../../../../domain/component-designer/layout-presets/newLayoutPresets';
import type { NewLayoutPresetId } from '../../../../domain/component-designer/layout-presets/types';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../../shared/ui/surfaceClasses';
import { sanitizeDesignerComponentNameInput } from '../../utils/componentName';
import { DesignerFieldRow } from '../DesignerFieldRow';

export type NewLayoutIdentity = {
  name: string;
  tags: string[];
};

export type NewLayoutDialogProps = {
  open: boolean;
  selectedCategory: NewLayoutPresetCategory;
  onCategoryChange: (category: NewLayoutPresetCategory) => void;
  onClose: () => void;
  onStartLayout: (presetId: NewLayoutPresetId, identity: NewLayoutIdentity) => void;
  tagSuggestions?: readonly string[];
};

type DialogView = 'wizard' | 'browse' | 'name';

const WIZARD_TEMPLATE_COUNT = countPresetsForCategory('all');

export const NewLayoutDialog: React.FC<NewLayoutDialogProps> = ({
  open,
  selectedCategory,
  onCategoryChange,
  onClose,
  onStartLayout,
  tagSuggestions = [],
}) => {
  const [view, setView] = React.useState<DialogView>('wizard');
  const [pendingPresetId, setPendingPresetId] = React.useState<NewLayoutPresetId | null>(null);
  const [componentName, setComponentName] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const tagsFieldRef = React.useRef<CatalogTagsFieldHandle>(null);

  React.useEffect(() => {
    if (open) {
      setView('wizard');
      setPendingPresetId(null);
      setComponentName('');
      setTags([]);
    }
  }, [open]);

  const filteredPresets = React.useMemo(
    () => filterPresetsByCategory(selectedCategory),
    [selectedCategory],
  );

  const handlePickPreset = React.useCallback((presetId: NewLayoutPresetId) => {
    setPendingPresetId(presetId);
    setComponentName('');
    setTags([]);
    setView('name');
  }, []);

  const handleConfirmName = React.useCallback(() => {
    if (!pendingPresetId || !componentName.trim()) {
      return;
    }
    onStartLayout(pendingPresetId, {
      name: componentName.trim(),
      tags: tagsFieldRef.current?.flush() ?? tags,
    });
  }, [componentName, onStartLayout, pendingPresetId, tags]);

  const isWizard = view === 'wizard';
  const isNameStep = view === 'name';
  const nameInvalid = isNameStep && componentName.trim() === '';

  return (
    <DesignerDialog
      title={isNameStep ? 'Name component' : isWizard ? 'New component' : 'Choose A Starting Layout'}
      titleIcon={isWizard || isNameStep ? <LayoutTemplate className="h-4 w-4 text-cyan-600" /> : undefined}
      open={open}
      onClose={onClose}
      surfaceClassName={isWizard || isNameStep ? 'max-w-md' : 'w-[calc(100vw-24px)] h-[calc(100vh-24px)] max-w-none rounded-lg flex flex-col overflow-hidden'}
      bodyClassName={isWizard || isNameStep ? DESIGNER_DIALOG_BODY_CLASS : DESIGNER_DIALOG_BODY_FULL_HEIGHT_CLASS}
      footerClassName="shrink-0"
      footer={isNameStep ? (
        <div className="flex items-center justify-between gap-2">
          <AppButton intent="secondary" size="sm" onClick={() => setView('wizard')}>
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </AppButton>
          <div className="flex items-center gap-2">
            <AppButton intent="secondary" size="sm" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </AppButton>
            <AppButton intent="primary" size="sm" onClick={handleConfirmName} disabled={nameInvalid}>
              Create
            </AppButton>
          </div>
        </div>
      ) : isWizard ? (
        <div className="flex items-center justify-end">
          <AppButton intent="secondary" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <AppButton intent="secondary" size="sm" onClick={() => setView('wizard')}>
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </AppButton>
          <AppButton intent="secondary" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
        </div>
      )}
    >
      {isNameStep ? (
        <div className="space-y-3 bg-white p-[15px]">
          <p className="text-[11px] text-slate-600">
            Choose a unique name before opening the editor. Rename later from the catalog list.
          </p>
          <DesignerFieldRow label="Component Name">
            <UiInput
              size="sm"
              autoDir={false}
              value={componentName}
              onChange={(event) => setComponentName(sanitizeDesignerComponentNameInput(event.target.value))}
              ariaLabel="Component name"
              placeholder="e.g. order-summary"
              isInvalid={nameInvalid}
              errorMessage={nameInvalid ? 'Component name is required.' : undefined}
            />
          </DesignerFieldRow>
          <CatalogTagsField
            ref={tagsFieldRef}
            value={tags}
            onChange={setTags}
            suggestions={tagSuggestions}
            hint="Pick a previous tag or type a new one and press Enter."
          />
        </div>
      ) : isWizard ? (
        <div className="bg-white p-[15px]">
          <nav
            aria-label="Template location"
            className="mb-2.5 flex flex-wrap items-center gap-1.5 ps-[4px] text-[11px]"
          >
            <span className="font-semibold text-slate-800">Suggested templates</span>
            <span className="text-slate-400" aria-hidden>
              ‹
            </span>
            <button
              type="button"
              onClick={() => setView('browse')}
              className="inline-flex items-center gap-1.5 font-semibold text-primary-600 hover:text-primary-700"
            >
              Browse all
              <span className="rounded bg-slate-100 px-1.5 py-px text-[9px] font-bold tabular-nums text-slate-600">
                {WIZARD_TEMPLATE_COUNT}
              </span>
            </button>
          </nav>

          <div
            className={`overflow-hidden rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white shadow-sm`}
            role="listbox"
            aria-label="Starter templates"
          >
            {FIRST_RUN_WIZARD_TEMPLATES.map((template, index) => (
              <FirstRunWizardRow
                key={template.id}
                template={template}
                isLast={index === FIRST_RUN_WIZARD_TEMPLATES.length - 1}
                onSelect={() => handlePickPreset(template.presetId)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="h-full min-h-0 space-y-3 bg-white p-[15px]">
          <nav
            aria-label="Template location"
            className="flex flex-wrap items-center gap-1.5 ps-[4px] text-[11px]"
          >
            <button
              type="button"
              onClick={() => setView('wizard')}
              className="font-semibold text-primary-600 hover:text-primary-700"
            >
              Suggested templates
            </button>
            <span className="text-slate-400" aria-hidden>
              ‹
            </span>
            <span className="font-semibold text-slate-800">Browse all</span>
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <p className="text-[11px] text-slate-700">
              Pick a starter layout. You will name it next.
            </p>
            <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 shadow-sm">
              {filteredPresets.length} templates
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {NEW_LAYOUT_CATEGORY_OPTIONS.map((category) => {
              const isActive = selectedCategory === category.value;
              const count = countPresetsForCategory(category.value);

              return (
                <AppButton
                  key={category.value}
                  onClick={() => onCategoryChange(category.value)}
                  intent={isActive ? 'toggle-on' : 'cancel'}
                  className="h-7 px-2.5 text-[10px] font-semibold flex items-center gap-1.5"
                >
                  <span>{category.label}</span>
                  <span className={`rounded px-1.5 py-[1px] text-[9px] ${isActive ? 'bg-cyan-100/80 text-cyan-800' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                  </span>
                </AppButton>
              );
            })}
          </div>
          <div className="h-[calc(100%-58px)] overflow-y-auto px-2 py-1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {filteredPresets.map((preset) => (
                <NewLayoutPresetCard key={preset.id} preset={preset} onSelect={handlePickPreset} />
              ))}
            </div>
            {filteredPresets.length === 0 ? (
              <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
                No templates in this category.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </DesignerDialog>
  );
};

type FirstRunWizardRowProps = {
  template: FirstRunWizardTemplate;
  isLast: boolean;
  onSelect: () => void;
};

const FirstRunWizardRow: React.FC<FirstRunWizardRowProps> = ({ template, isLast, onSelect }) => {
  const tone = NEW_LAYOUT_CATEGORY_TONES[template.tone];

  return (
    <button
      type="button"
      role="option"
      onClick={onSelect}
      title={template.description}
      className={[
        'group flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors',
        'hover:bg-slate-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400/70',
        !isLast ? 'border-b border-slate-100' : '',
      ].join(' ')}
    >
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border [&_svg]:h-3.5 [&_svg]:w-3.5 ${tone.icon}`}
      >
        {template.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-slate-800">{template.title}</span>
        <span className="mt-0.5 block truncate text-[10px] text-slate-500">{template.description}</span>
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
    </button>
  );
};

type NewLayoutPresetCardProps = {
  preset: NewLayoutPreset;
  onSelect: (presetId: NewLayoutPresetId) => void;
};

const NewLayoutPresetCard: React.FC<NewLayoutPresetCardProps> = ({ preset, onSelect }) => {
  const categories = getPresetCategories(preset);
  return (
    <NativeButton
      type="button"
      onClick={() => onSelect(preset.id)}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm transition hover:border-cyan-300 hover:shadow-md"
    >
      <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-slate-50">
        {renderPresetMiniPreview(preset.id)}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <span className="truncate text-[11px] font-semibold text-slate-800">{preset.title}</span>
        <span className="line-clamp-2 text-[10px] text-slate-500">{preset.description}</span>
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {categories.slice(0, 2).map((category) => (
            <span key={category} className="rounded bg-slate-100 px-1.5 py-px text-[9px] font-semibold text-slate-600">
              {NEW_LAYOUT_CATEGORY_LABELS[category]}
            </span>
          ))}
        </div>
      </div>
    </NativeButton>
  );
};
