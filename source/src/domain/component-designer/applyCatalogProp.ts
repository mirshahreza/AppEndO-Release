import type { BaseComponentOptionMeta } from '../base-components/catalogAccess';
import { getAtDotPath, setAtDotPath, unwrapPropsForCatalogWrite } from '../base-components/optionPath';
import { parseCrudSetSpec, type CrudSetCreateApi, type CrudSetPatchApi, type CrudSetSpec } from './crudSetSpec';
import type { CompiledInspectorField } from './compileInspectorFromCatalog';

const DEFAULT_CREATE: CrudSetCreateApi = {
  id: 'create',
  label: 'Create',
  endpointId: '',
  acceptedFields: [],
};

const DEFAULT_CONTENT_PATCH: CrudSetPatchApi = {
  id: 'edit',
  label: 'Edit',
  endpointId: '',
  kind: 'content',
  interaction: 'form',
  acceptedFields: [],
};

const DEFAULT_PURPOSE_FORM: CrudSetPatchApi = {
  id: 'purpose',
  label: 'Update',
  endpointId: '',
  kind: 'purpose',
  interaction: 'form',
  acceptedFields: [],
};

const DEFAULT_PURPOSE_TOGGLE: CrudSetPatchApi = {
  id: 'toggle',
  label: 'Toggle',
  endpointId: '',
  kind: 'purpose',
  interaction: 'boolean-toggle',
  acceptedFields: ['locked'],
};

const readSpec = (props: Record<string, unknown>): CrudSetSpec | null =>
  parseCrudSetSpec(props.spec);

const writeSpec = (
  props: Record<string, unknown>,
  spec: CrudSetSpec,
): Record<string, unknown> => ({
  ...props,
  spec,
});

const applyCrudSetComposition = (
  props: Record<string, unknown>,
  propPath: string,
  value: unknown,
): Record<string, unknown> | null => {
  const spec = readSpec(props);
  if (!spec) return null;

  if (propPath === 'spec.createApis.length') {
    const count = typeof value === 'number' ? value : Number(value);
    const next = [...spec.createApis];
    if (count <= 0) {
      return writeSpec(props, { ...spec, createApis: [] });
    }
    while (next.length < count) {
      next.push({
        ...DEFAULT_CREATE,
        id: next.length === 0 ? 'create' : `create-${next.length + 1}`,
        label: next.length === 0 ? 'Create' : `Create ${next.length + 1}`,
      });
    }
    return writeSpec(props, { ...spec, createApis: next.slice(0, count) });
  }

  if (propPath === 'spec.patches.content') {
    const enabled = value === true;
    const others = spec.patches.filter((patch) => patch.kind !== 'content');
    return writeSpec(props, {
      ...spec,
      patches: enabled
        ? [spec.patches.find((patch) => patch.kind === 'content') ?? DEFAULT_CONTENT_PATCH, ...others]
        : others,
    });
  }

  if (propPath === 'spec.patches.purpose') {
    const mode = String(value);
    const withoutPurpose = spec.patches.filter((patch) => patch.kind !== 'purpose');
    if (mode === 'none' || mode === '') {
      return writeSpec(props, { ...spec, patches: withoutPurpose });
    }
    const existing = spec.patches.find((patch) => patch.kind === 'purpose');
    const nextPurpose = mode === 'boolean-toggle'
      ? { ...(existing ?? DEFAULT_PURPOSE_TOGGLE), interaction: 'boolean-toggle' as const, kind: 'purpose' as const }
      : { ...(existing ?? DEFAULT_PURPOSE_FORM), interaction: 'form' as const, kind: 'purpose' as const };
    return writeSpec(props, { ...spec, patches: [...withoutPurpose, nextPurpose] });
  }

  if (propPath === 'spec.patches.toggleConfirm') {
    return writeSpec(props, {
      ...spec,
      patches: spec.patches.map((patch) => (
        patch.interaction === 'boolean-toggle'
          ? { ...patch, toggleConfirm: value === true }
          : patch
      )),
    });
  }

  if (propPath === 'spec.patches.openFromColumnId') {
    const enabled = value === true || (typeof value === 'string' && value.length > 0);
    const columnId = typeof value === 'string' && value.length > 0 && value !== 'true' ? value : undefined;
    return writeSpec(props, {
      ...spec,
      patches: spec.patches.map((patch) => (
        patch.kind === 'content'
          ? { ...patch, openFromColumnId: enabled ? (columnId ?? spec.columns[0]?.field) : undefined }
          : patch
      )),
    });
  }

  if (propPath === 'spec.deleteApi') {
    if (value === false || value === undefined || value === null) {
      const { deleteApi: _removed, ...rest } = spec;
      return writeSpec(props, rest as CrudSetSpec);
    }
    return writeSpec(props, {
      ...spec,
      deleteApi: spec.deleteApi ?? { endpointId: '' },
    });
  }

  return null;
};

const readCrudSetComposition = (
  props: Record<string, unknown>,
  propPath: string,
): unknown => {
  const spec = readSpec(props);
  if (!spec) return undefined;
  if (propPath === 'spec.createApis.length') return spec.createApis.length;
  if (propPath === 'spec.patches.content') return spec.patches.some((patch) => patch.kind === 'content');
  if (propPath === 'spec.patches.purpose') {
    const purpose = spec.patches.find((patch) => patch.kind === 'purpose');
    if (!purpose) return 'none';
    return purpose.interaction === 'boolean-toggle' ? 'boolean-toggle' : 'form';
  }
  if (propPath === 'spec.patches.toggleConfirm') {
    return spec.patches.some((patch) => patch.interaction === 'boolean-toggle' && patch.toggleConfirm === true);
  }
  if (propPath === 'spec.patches.openFromColumnId') {
    return spec.patches.some((patch) => patch.kind === 'content' && Boolean(patch.openFromColumnId));
  }
  if (propPath === 'spec.deleteApi') return Boolean(spec.deleteApi);
  return undefined;
};

export const applyCatalogProp = (
  props: Readonly<Record<string, unknown>>,
  field: Pick<CompiledInspectorField, 'propPath'>,
  value: unknown,
): Record<string, unknown> => {
  const composed = applyCrudSetComposition(unwrapPropsForCatalogWrite(props), field.propPath, value);
  if (composed) return composed;

  const next = unwrapPropsForCatalogWrite(props);
  setAtDotPath(next, field.propPath, value);
  return next;
};

export const readCatalogProp = (
  props: Readonly<Record<string, unknown>>,
  field: Pick<CompiledInspectorField, 'propPath'>,
): unknown => {
  const composed = readCrudSetComposition(props as Record<string, unknown>, field.propPath);
  if (composed !== undefined) return composed;
  const unwrapped = unwrapPropsForCatalogWrite(props);
  return getAtDotPath(unwrapped, field.propPath);
};

export const catalogOptionValuesFromProps = (
  options: readonly BaseComponentOptionMeta[],
  props: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  const values: Record<string, unknown> = {};
  for (const option of options) {
    const path = option.propPath ?? option.id;
    const current = readCatalogProp(props, { propPath: path });
    values[option.id] = current === undefined ? option.defaultValue : current;
  }
  return values;
};
