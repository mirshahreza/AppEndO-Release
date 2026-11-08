import React, { useEffect, useState } from 'react';
import { ImageIcon, Plus, Save, Trash2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { formatNavigationIconRefLabel } from '../../../shared/lib/navigationIcons/navigationIconRef';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  UiCheckbox,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import { NAV_DEFAULT_ICON_COLOR } from '../../platform-navigations/constants';
import { NavigationTailwindColorPicker } from '../../platform-navigations/components/NavigationTailwindColorPicker';
import { NAVIGATION_GROUPED_FIELD_SHELL_CLASS } from '../../platform-navigations/components/NavigationGroupedField';
import { resolveNavColor } from '../../platform-navigations/lib/navigationTailwindColorOptions';
import { NavigationIconPickerDialog } from '../../platform-navigations/components/dialogs/NavigationIconPickerDialog';
import type { CubeDerivedMeasureDef } from '../../../shared/api/contracts/data-api';
import type { EdgeModelModelerModel } from '../hooks/useEdgeModelModeler';
import {
  ModelHistoryFields,
  emptyModelHistoryForm,
  modelHistoryFromMeta,
  pruneModelHistory,
  type ModelHistoryForm,
} from './EdgeModelHistoryFields';

const FIELD_CLASS = 'w-full min-w-0';
const CONTROL_CLASS = 'block w-full min-w-0';
const BODY_STRETCH_CLASS =
  'w-full min-w-0 [&_[data-slot=input]]:!w-full [&_[data-slot=input-wrapper]]:!w-full [&_[data-slot=textarea]]:!w-full';

type GeneralEditForm = {
  title: string;
  icon: string;
  color: string;
  readOnly: boolean;
  tagsText: string;
  cubeDerivedMeasures: CubeDerivedMeasureDef[];
  history: ModelHistoryForm;
};

export type EdgeModelModelerGeneralEditDialogProps = {
  open: boolean;
  onClose: () => void;
  modeler: EdgeModelModelerModel;
};

export const EdgeModelModelerGeneralEditDialog: React.FC<EdgeModelModelerGeneralEditDialogProps> = ({
  open,
  onClose,
  modeler,
}) => {
  const [form, setForm] = useState<GeneralEditForm | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(null);
      setIconPickerOpen(false);
      return;
    }
    if (!modeler.draft) {
      return;
    }
    setForm((current) => current ?? {
      title: modeler.draft!.title,
      icon: modeler.draft!.icon,
      color: modeler.draft!.color,
      readOnly: modeler.draft!.readOnly,
      tagsText: modeler.draft!.studio.tagsText,
      cubeDerivedMeasures: modeler.draft!.studio.cubeDerivedMeasures ?? [],
      history: modelHistoryFromMeta(modeler.draft!.studio.history) ?? emptyModelHistoryForm(),
    });
  }, [modeler.draft, open]);

  if (!open || !modeler.model || !modeler.draft || !form) {
    return null;
  }

  const { model } = modeler;
  const objectLabel = modeler.draft.title || model.objectName;
  const iconLabel = form.icon.trim()
    ? formatNavigationIconRefLabel(form.icon)
    : 'No icon';
  const iconColor = resolveNavColor(form.color, NAV_DEFAULT_ICON_COLOR);

  const handleSave = () => {
    modeler.updateLabels({
      title: form.title,
      icon: form.icon.trim(),
      color: form.color.trim(),
    });
    modeler.setReadOnly(form.readOnly);
    modeler.updateStudioTagsText(form.tagsText);
    modeler.updateCubeDerivedMeasures(form.cubeDerivedMeasures);
    modeler.updateModelHistory(pruneModelHistory(form.history));
    onClose();
  };

  return (
    <>
      <CreateEditModalShell
        size="lg"
        title="Edit general"
        subtitle={objectLabel}
        metaBand={(
          <UiCheckbox
            size="sm"
            checked={form.readOnly}
            disabled={model.objectType === 'VIEW'}
            onChange={(event) => setForm((current) => (
              current ? { ...current, readOnly: event.target.checked } : current
            ))}
          >
            Prevent structural edits through the modeler
          </UiCheckbox>
        )}
        metaBandTone="elevated"
        metaBandClassName="!py-2.5"
        onClose={onClose}
        onBackdropClick={onClose}
        bodyClassName={BODY_STRETCH_CLASS}
        footer={(
          <div className="flex justify-end gap-2">
            <AppButton intent="secondary" size="sm" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              Close
            </AppButton>
            <AppButton intent="primary" size="sm" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              Save
            </AppButton>
          </div>
        )}
      >
        <div className={`flex flex-col gap-3 ${BODY_STRETCH_CLASS}`}>
          <FormField label="Title" className={FIELD_CLASS}>
            <UiInput
              size="sm"
              aiAssist={false}
              className={CONTROL_CLASS}
              value={form.title}
              onChange={(event) => setForm((current) => (
                current ? { ...current, title: event.target.value } : current
              ))}
              ariaLabel="Model title"
            />
          </FormField>
          <FormField
            label="Icon"
            hint="Optional glyph and color shown in the modeler header and general panel."
            className={FIELD_CLASS}
          >
            <div className="flex items-center gap-2">
              <span className={cn(
                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50',
                iconColor,
              )}
              >
                {form.icon.trim() ? (
                  <NavigationIcon iconRef={form.icon} className="h-4 w-4" />
                ) : (
                  <ImageIcon className="h-4 w-4 opacity-50" aria-hidden="true" />
                )}
              </span>
              <div className={cn(NAVIGATION_GROUPED_FIELD_SHELL_CLASS, 'w-auto shrink-0')}>
                <NavigationTailwindColorPicker
                  value={iconColor}
                  defaultColor={NAV_DEFAULT_ICON_COLOR}
                  ariaLabel="Model icon color"
                  onChange={(nextValue) => setForm((current) => (
                    current ? { ...current, color: nextValue ?? '' } : current
                  ))}
                />
              </div>
              <AppButton
                type="button"
                size="sm"
                intent="secondary"
                className="flex min-w-0 flex-1 justify-start leading-none"
                aria-label="Choose model icon"
                onClick={() => setIconPickerOpen(true)}
              >
                <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate font-mono text-[11px] leading-none">{iconLabel}</span>
              </AppButton>
              {form.icon.trim() ? (
                <AppButton
                  type="button"
                  size="sm"
                  intent="secondary"
                  aria-label="Clear model icon"
                  onClick={() => setForm((current) => (
                    current ? { ...current, icon: '' } : current
                  ))}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </AppButton>
              ) : null}
            </div>
          </FormField>
          <FormField
            label="Studio tags"
            hint="Comma-separated labels stored in studio metadata only."
            className={FIELD_CLASS}
          >
            <UiInput
              size="sm"
              aiAssist={false}
              className={CONTROL_CLASS}
              value={form.tagsText}
              onChange={(event) => setForm((current) => (
                current ? { ...current, tagsText: event.target.value } : current
              ))}
              ariaLabel="Studio tags"
              placeholder="crm, billing, internal"
            />
          </FormField>
          <ModelHistoryFields
            value={form.history}
            onChange={(history) => setForm((current) => (
              current ? { ...current, history } : current
            ))}
          />
          <FormField
            label="Cube derived measures"
            hint="Ratios and differences computed after star-schema aggregation. Requires at least two stored cube measures."
            className={FIELD_CLASS}
          >
            {(() => {
              const measureNames = Object.keys(modeler.draft.studio.columnCubeMeasures ?? {});
              const canAdd = measureNames.length >= 2;
              return (
                <div className="flex flex-col gap-2">
                  {form.cubeDerivedMeasures.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="grid grid-cols-[1fr_7rem_1fr_1fr_auto] items-end gap-2">
                      <UiInput
                        size="sm"
                        aiAssist={false}
                        value={item.name}
                        onChange={(event) => setForm((current) => {
                          if (!current) return current;
                          const next = [...current.cubeDerivedMeasures];
                          next[index] = { ...item, name: event.target.value };
                          return { ...current, cubeDerivedMeasures: next };
                        })}
                        ariaLabel="Derived measure name"
                        placeholder="margin"
                      />
                      <UiSelect
                        size="sm"
                        value={item.operation}
                        onChange={(event) => setForm((current) => {
                          if (!current) return current;
                          const next = [...current.cubeDerivedMeasures];
                          next[index] = {
                            ...item,
                            operation: event.target.value as CubeDerivedMeasureDef['operation'],
                          };
                          return { ...current, cubeDerivedMeasures: next };
                        })}
                        ariaLabel="Derived measure operation"
                      >
                        <option value="ratio">ratio</option>
                        <option value="difference">difference</option>
                        <option value="percentDiff">percentDiff</option>
                      </UiSelect>
                      <UiSelect
                        size="sm"
                        value={item.numerator}
                        onChange={(event) => setForm((current) => {
                          if (!current) return current;
                          const next = [...current.cubeDerivedMeasures];
                          next[index] = { ...item, numerator: event.target.value };
                          return { ...current, cubeDerivedMeasures: next };
                        })}
                        ariaLabel="Derived measure numerator"
                      >
                        {measureNames.map((name) => (
                          <option key={`num-${name}`} value={name}>{name}</option>
                        ))}
                      </UiSelect>
                      <UiSelect
                        size="sm"
                        value={item.denominator}
                        onChange={(event) => setForm((current) => {
                          if (!current) return current;
                          const next = [...current.cubeDerivedMeasures];
                          next[index] = { ...item, denominator: event.target.value };
                          return { ...current, cubeDerivedMeasures: next };
                        })}
                        ariaLabel="Derived measure denominator"
                      >
                        {measureNames.map((name) => (
                          <option key={`den-${name}`} value={name}>{name}</option>
                        ))}
                      </UiSelect>
                      <AppButton
                        type="button"
                        size="sm"
                        intent="secondary"
                        aria-label="Remove derived measure"
                        onClick={() => setForm((current) => (
                          current
                            ? {
                              ...current,
                              cubeDerivedMeasures: current.cubeDerivedMeasures.filter((_, itemIndex) => itemIndex !== index),
                            }
                            : current
                        ))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </AppButton>
                    </div>
                  ))}
                  <AppButton
                    type="button"
                    size="sm"
                    intent="secondary"
                    disabled={!canAdd}
                    onClick={() => setForm((current) => {
                      if (!current || !canAdd) return current;
                      return {
                        ...current,
                        cubeDerivedMeasures: [
                          ...current.cubeDerivedMeasures,
                          {
                            name: 'ratio',
                            operation: 'ratio',
                            numerator: measureNames[0]!,
                            denominator: measureNames[1]!,
                          },
                        ],
                      };
                    })}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add derived measure
                  </AppButton>
                </div>
              );
            })()}
          </FormField>
        </div>
      </CreateEditModalShell>

      <NavigationIconPickerDialog
        open={iconPickerOpen}
        selectedIcon={form.icon.trim() || undefined}
        onClose={() => setIconPickerOpen(false)}
        onSelect={(iconRef) => {
          setForm((current) => (current ? { ...current, icon: iconRef } : current));
          setIconPickerOpen(false);
        }}
      />
    </>
  );
};
