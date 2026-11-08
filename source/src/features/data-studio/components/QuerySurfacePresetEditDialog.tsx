import React, { useEffect, useMemo, useState } from 'react';
import type { QueryPresetDefinition } from '../../../shared/api/contracts/data-api';
import {
  CreateEditModalShell,
  FormField,
  FormSection,
  ListFilterDialog,
  ListFilterToolbarControl,
  UiCheckbox,
  UiInput,
  UiSelect,
  useListFilter,
} from '../../../shared/ui';
import { isListWhereTreeActive } from '../../../shared/ui';
import {
  createEmptyWhereTree,
  DEFAULT_WHERE_OPERATORS,
  type WhereField,
  type WhereGroupNode,
} from '../../../shared/ui/where-builder/whereBuilderModel';
import { MODELER_CAPTION_CLASS } from '../lib/modelerChipStyles';

const slugifyPresetId = (label: string): string => {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'preset';
};

type QuerySurfacePresetEditDialogProps = {
  open: boolean;
  initial: QueryPresetDefinition | null;
  existingIds: readonly string[];
  whereFields: readonly WhereField[];
  onClose: () => void;
  onSave: (preset: QueryPresetDefinition) => void;
};

export const QuerySurfacePresetEditDialog: React.FC<QuerySurfacePresetEditDialogProps> = ({
  open,
  initial,
  existingIds,
  whereFields,
  onClose,
  onSave,
}) => {
  const isNew = initial === null;
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [labelKey, setLabelKey] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionKey, setDescriptionKey] = useState('');
  const [application, setApplication] = useState<QueryPresetDefinition['application']>('optional');
  const [visibility, setVisibility] = useState<QueryPresetDefinition['visibility']>('public');
  const [defaultSelected, setDefaultSelected] = useState(false);
  const [whereTree, setWhereTree] = useState<WhereGroupNode>(() => createEmptyWhereTree());

  useEffect(() => {
    if (!open) {
      return;
    }
    if (initial) {
      setId(initial.id);
      setLabel(initial.label);
      setLabelKey(initial.labelKey ?? '');
      setDescription(initial.description ?? '');
      setDescriptionKey(initial.descriptionKey ?? '');
      setApplication(initial.application);
      setVisibility(initial.visibility);
      setDefaultSelected(initial.defaultSelected === true);
      setWhereTree(initial.where as WhereGroupNode);
      return;
    }
    setId('');
    setLabel('');
    setLabelKey('');
    setDescription('');
    setDescriptionKey('');
    setApplication('optional');
    setVisibility('public');
    setDefaultSelected(false);
    setWhereTree(createEmptyWhereTree());
  }, [initial, open]);

  const listFilter = useListFilter({
    value: whereTree,
    fields: whereFields,
    operators: DEFAULT_WHERE_OPERATORS,
    onApply: setWhereTree,
  });

  const applicationOptions = useMemo(() => ([
    { value: 'optional', label: 'Optional chip' },
    { value: 'default-on', label: 'Default on' },
    { value: 'mandatory', label: 'Mandatory (always on)' },
  ]), []);

  const visibilityOptions = useMemo(() => ([
    { value: 'public', label: 'Public' },
    { value: 'restricted', label: 'Role-restricted' },
  ]), []);

  const handleLabelBlur = () => {
    if (!isNew || id.trim()) {
      return;
    }
    const next = slugifyPresetId(label);
    if (!next) {
      return;
    }
    let candidate = next;
    let suffix = 2;
    while (existingIds.includes(candidate) && candidate !== initial?.id) {
      candidate = `${next}-${suffix}`;
      suffix += 1;
    }
    setId(candidate);
  };

  const canSave = label.trim().length > 0
    && /^[a-z0-9._-]+$/.test(id.trim())
    && isListWhereTreeActive(whereTree, DEFAULT_WHERE_OPERATORS);

  if (!open) {
    return null;
  }

  return (
    <>
      <CreateEditModalShell
        onClose={onClose}
        title={isNew ? 'Add named query preset' : 'Edit named query preset'}
        size="2xl"
        primaryAction={{
          label: 'Apply preset',
          onClick: () => {
            onSave({
              id: id.trim(),
              label: label.trim(),
              labelKey: labelKey.trim() || undefined,
              description: description.trim() || undefined,
              descriptionKey: descriptionKey.trim() || undefined,
              where: whereTree,
              application,
              visibility,
              defaultSelected: defaultSelected || undefined,
            });
            onClose();
          },
          disabled: !canSave,
        }}
        secondaryAction={{ label: 'Cancel', onClick: onClose }}
      >
        <div className="flex flex-col gap-4">
          <p className={MODELER_CAPTION_CLASS}>
            Named presets appear as chips on server-backed grids. The WHERE tree uses the same rules as List Filter.
          </p>
          <FormSection title="Identity" ink="slate">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Label" required>
                <UiInput
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  onBlur={handleLabelBlur}
                  placeholder="Active members"
                />
              </FormField>
              <FormField label="Preset id" required hint="Lowercase id used in API (?presets=).">
                <UiInput
                  value={id}
                  onChange={(event) => setId(event.target.value)}
                  disabled={!isNew}
                  placeholder="active-members"
                />
              </FormField>
            </div>
            <FormField label="Culture label key" hint="Package culture key for translated chip labels at runtime.">
              <UiInput
                value={labelKey}
                onChange={(event) => setLabelKey(event.target.value)}
                placeholder="hwy.members.preset.active"
              />
            </FormField>
            <FormField label="Description">
              <UiInput
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional helper text for builders"
              />
            </FormField>
            <FormField label="Culture description key">
              <UiInput
                value={descriptionKey}
                onChange={(event) => setDescriptionKey(event.target.value)}
                placeholder="Optional"
              />
            </FormField>
          </FormSection>
          <FormSection title="Behavior" ink="indigo">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Application">
                <UiSelect
                  value={application}
                  options={applicationOptions}
                  onChange={(event) => {
                    setApplication(event.target.value as QueryPresetDefinition['application']);
                  }}
                />
              </FormField>
              <FormField label="Visibility">
                <UiSelect
                  value={visibility}
                  options={visibilityOptions}
                  onChange={(event) => {
                    setVisibility(event.target.value as QueryPresetDefinition['visibility']);
                  }}
                />
              </FormField>
            </div>
            <UiCheckbox
              checked={defaultSelected}
              onChange={(event) => setDefaultSelected(event.target.checked)}
            >
              Selected by default on new grids
            </UiCheckbox>
          </FormSection>
          <FormSection title="Filter (WHERE)" ink="slate">
            <ListFilterToolbarControl
              filterButtonProps={listFilter.filterButtonProps}
              separatorBefore={false}
            />
            {!isListWhereTreeActive(whereTree, DEFAULT_WHERE_OPERATORS) ? (
              <p className={MODELER_CAPTION_CLASS}>Add at least one condition.</p>
            ) : null}
          </FormSection>
        </div>
      </CreateEditModalShell>
      <ListFilterDialog {...listFilter.filterDialogProps} />
    </>
  );
};
