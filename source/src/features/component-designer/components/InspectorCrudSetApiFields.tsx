import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  CrudSetCreateApi,
  CrudSetPatchApi,
  CrudSetPatchKind,
  CrudSetSpec,
} from '../../../domain/component-designer/crudSetSpec';
import { AppButton, AppSurfaceBox, CrudSetConfigCheckbox, FormField, UiInput, UiSelect } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';
import { BindingApiEndpointPicker } from './BindingApiEndpointPicker';

const FIELD_CLASS = 'min-w-0';
const SELECT_CLASS = 'w-full';
const STACK_CLASS = 'flex flex-col gap-2';
const GROUP_LABEL_CLASS = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

const newItemId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}`;

type InspectorCrudSetApiFieldsProps = {
  spec: CrudSetSpec;
  onChange: (next: CrudSetSpec) => void;
};

export const InspectorCrudSetApiFields: React.FC<InspectorCrudSetApiFieldsProps> = ({
  spec,
  onChange,
}) => {
  const deleteEnabled = Boolean(spec.deleteApi?.endpointId || spec.deleteApi);

  return (
    <div className={STACK_CLASS}>
      <FormField
        label="List"
        hint="Required. Fills, searches, and filters the grid."
        className={FIELD_CLASS}
      >
        <BindingApiEndpointPicker
          value={spec.listApi.endpointId}
          method="GET"
          onChange={(path) => onChange({ ...spec, listApi: { endpointId: path } })}
          onMethodChange={() => undefined}
          methodFilter={['GET']}
        />
      </FormField>
      <FormField
        label="Read-one"
        hint="Required when a form patch or delete is on."
        className={FIELD_CLASS}
      >
        <BindingApiEndpointPicker
          value={spec.readOneApi?.endpointId ?? ''}
          method="GET"
          onChange={(path) => onChange({
            ...spec,
            readOneApi: path.trim() ? { endpointId: path } : undefined,
          })}
          onMethodChange={() => undefined}
          methodFilter={['GET']}
        />
      </FormField>

      <p className={GROUP_LABEL_CLASS}>Creates</p>
      {spec.createApis.map((create, index) => (
        <AppSurfaceBox key={create.id} className="flex flex-col gap-2 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className={GROUP_LABEL_CLASS}>Create {index + 1}</span>
            <AppButton
              type="button"
              size="icon-sm"
              tabStop="skip"
              className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_DELETE_CLASS)}
              aria-label={`Remove create ${index + 1}`}
              onClick={() => onChange({
                ...spec,
                createApis: spec.createApis.filter((item) => item.id !== create.id),
              })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </AppButton>
          </div>
          <FormField label="Toolbar label" className={FIELD_CLASS} reserveHintSlot={false}>
            <UiInput
              size="sm"
              autoDir={false}
              className={SELECT_CLASS}
              value={create.label}
              onChange={(event) => onChange({
                ...spec,
                createApis: spec.createApis.map((item) => (
                  item.id === create.id ? { ...item, label: event.target.value } : item
                )),
              })}
              ariaLabel={`Create ${index + 1} label`}
            />
          </FormField>
          <BindingApiEndpointPicker
            value={create.endpointId}
            method="POST"
            onChange={(path) => onChange({
              ...spec,
              createApis: spec.createApis.map((item) => (
                item.id === create.id ? { ...item, endpointId: path } : item
              )),
            })}
            onMethodChange={() => undefined}
            methodFilter={['POST']}
          />
        </AppSurfaceBox>
      ))}
      <AppButton
        size="sm"
        intent="create"
        onClick={() => {
          const next: CrudSetCreateApi = {
            id: newItemId('create'),
            label: spec.createApis.length === 0 ? 'Create' : `Create ${spec.createApis.length + 1}`,
            endpointId: '',
            acceptedFields: [],
          };
          onChange({ ...spec, createApis: [...spec.createApis, next] });
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        Add create API
      </AppButton>

      <p className={GROUP_LABEL_CLASS}>Patches</p>
      {spec.patches.map((patch, index) => (
        <AppSurfaceBox key={patch.id} className="flex flex-col gap-2 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className={GROUP_LABEL_CLASS}>Patch {index + 1}</span>
            <AppButton
              type="button"
              size="icon-sm"
              tabStop="skip"
              className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_DELETE_CLASS)}
              aria-label={`Remove patch ${index + 1}`}
              onClick={() => onChange({
                ...spec,
                patches: spec.patches.filter((item) => item.id !== patch.id),
              })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </AppButton>
          </div>
          <FormField label="Label" className={FIELD_CLASS} reserveHintSlot={false}>
            <UiInput
              size="sm"
              autoDir={false}
              className={SELECT_CLASS}
              value={patch.label}
              onChange={(event) => onChange({
                ...spec,
                patches: spec.patches.map((item) => (
                  item.id === patch.id ? { ...item, label: event.target.value } : item
                )),
              })}
              ariaLabel={`Patch ${index + 1} label`}
            />
          </FormField>
          <FormField label="Kind" className={FIELD_CLASS} reserveHintSlot={false}>
            <UiSelect
              size="sm"
              className={SELECT_CLASS}
              value={patch.kind}
              onChange={(event) => onChange({
                ...spec,
                patches: spec.patches.map((item) => (
                  item.id === patch.id
                    ? { ...item, kind: event.target.value as CrudSetPatchKind }
                    : item
                )),
              })}
              ariaLabel={`Patch ${index + 1} kind`}
            >
              <option value="content">Content</option>
              <option value="purpose">Purpose</option>
            </UiSelect>
          </FormField>
          <BindingApiEndpointPicker
            value={patch.endpointId}
            method="PATCH"
            onChange={(path) => onChange({
              ...spec,
              patches: spec.patches.map((item) => (
                item.id === patch.id ? { ...item, endpointId: path } : item
              )),
            })}
            onMethodChange={() => undefined}
            methodFilter={['PATCH', 'PUT']}
          />
        </AppSurfaceBox>
      ))}
      <AppButton
        size="sm"
        intent="secondary"
        onClick={() => {
          const next: CrudSetPatchApi = {
            id: newItemId('patch'),
            label: spec.patches.some((item) => item.kind === 'content') ? 'Update' : 'Edit',
            endpointId: '',
            kind: spec.patches.some((item) => item.kind === 'content') ? 'purpose' : 'content',
            acceptedFields: [],
            interaction: 'form',
          };
          onChange({ ...spec, patches: [...spec.patches, next] });
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        Add patch API
      </AppButton>

      <CrudSetConfigCheckbox
        label="Delete"
        checked={deleteEnabled}
        fieldClassName={FIELD_CLASS}
        selectClassName={SELECT_CLASS}
        onChange={(checked) => onChange({
          ...spec,
          deleteApi: checked ? { endpointId: spec.deleteApi?.endpointId ?? '' } : undefined,
        })}
      />
      {deleteEnabled ? (
        <BindingApiEndpointPicker
          value={spec.deleteApi?.endpointId ?? ''}
          method="DELETE"
          onChange={(path) => onChange({ ...spec, deleteApi: { endpointId: path } })}
          onMethodChange={() => undefined}
          methodFilter={['DELETE']}
        />
      ) : null}
    </div>
  );
};
