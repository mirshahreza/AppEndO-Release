import React from 'react';
import { Plus, Save, X } from 'lucide-react';
import {
  UiCheckboxChoice,
  UiInput,
  UiRadioChoiceGroup,
  UiSelect,
  UiTreeSelect,
  resolveChoiceBoxShellClass,
  type UiTreeSelectNode,
} from '../../../../shared/ui';
import { useCultureT } from '../../../../core/culture/CultureContext';
import {
  fetchBaseInfoAncestorPath,
  fetchBaseInfoChildren,
  formatBaseInfoTreeLabel,
  useBaseInfoChildrenQuery,
} from '../../../../shared/api/queries/base-info';
import type { BaseInfoRow } from '../../../../shared/api/contracts/base-info/types';
import { AppButton, CreateEditModalShell } from '../../../../shared/ui';
import type { SettingsAttributeFormState } from './types';
import type { AttributeScope } from '../../../../shared/api/contracts/attributes/types';
import { sanitizeAttributeKeyInput } from './utils';
import { cn } from '../../../../lib/utils';
import {
  attributeFormText,
  getAttributeDataTypeOptions,
} from '../../settingsAttributesI18n';
import { getUserEditPolicyOptions } from '../../settingsLabelsI18n';
import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_GRID_GAP_CLASS,
  SETTINGS_FORM_GROUP_BODY_STACK_CLASS,
  SETTINGS_SUBSECTION_LABEL_CLASS,
} from '../form/SettingsFormPrimitives';

const mapBaseInfoRowToTreeNode = (row: BaseInfoRow): UiTreeSelectNode => ({
  id: row.id,
  label: formatBaseInfoTreeLabel(row),
  hasChildren: Boolean(row.has_children),
});

const mergeTreeChildren = (
  nodes: UiTreeSelectNode[],
  parentId: string,
  children: UiTreeSelectNode[],
): UiTreeSelectNode[] => nodes.map((node) => {
  if (node.id === parentId) {
    return {
      ...node,
      children,
      hasChildren: children.length > 0 || node.hasChildren,
    };
  }
  if (!node.children?.length) return node;
  return {
    ...node,
    children: mergeTreeChildren(node.children, parentId, children),
  };
});

const findTreeNode = (nodes: UiTreeSelectNode[], id: string): UiTreeSelectNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findTreeNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const EMPTY_BASE_INFO_ROWS: BaseInfoRow[] = [];

type SettingsAttributeFormFieldsProps = {
  form: SettingsAttributeFormState;
  onFormChange: (form: SettingsAttributeFormState) => void;
  disableKey?: boolean;
  isEdit?: boolean;
  scope: AttributeScope;
  showValidation?: boolean;
};

export const SettingsAttributeFormFields: React.FC<SettingsAttributeFormFieldsProps> = ({
  form,
  onFormChange,
  disableKey = false,
  isEdit = false,
  scope,
  showValidation = false,
}) => {
  const t = useCultureT();
  const userEditPolicyOptions = React.useMemo(() => getUserEditPolicyOptions(t), [t]);
  const dataTypeOptions = React.useMemo(() => getAttributeDataTypeOptions(t), [t]);
  const rootsQuery = useBaseInfoChildrenQuery({ lang: 'en', root: '' });
  const rootOptions = rootsQuery.data ?? EMPTY_BASE_INFO_ROWS;
  const [hydratedTreeItems, setHydratedTreeItems] = React.useState<UiTreeSelectNode[] | null>(null);
  const [resolvedPath, setResolvedPath] = React.useState<{ id: string; label: string } | null>(null);
  const [expandedPathIds, setExpandedPathIds] = React.useState<string[]>([]);
  const rootTreeItems = React.useMemo(
    () => rootOptions.map(mapBaseInfoRowToTreeNode),
    [rootOptions],
  );
  const baseInfoTreeItems = hydratedTreeItems ?? rootTreeItems;
  const valuePathLabel = resolvedPath?.id === form.baseInfoRootId.trim()
    ? resolvedPath.label
    : '';
  const loadBaseInfoChildren = React.useCallback(async (nodeId: string): Promise<UiTreeSelectNode[]> => {
    const rows = await fetchBaseInfoChildren({ lang: 'en', root: '', parentId: nodeId });
    return rows.map(mapBaseInfoRowToTreeNode);
  }, []);

  React.useEffect(() => {
    const selectedId = form.baseInfoRootId.trim();
    if (!selectedId) {
      setHydratedTreeItems((current) => (current === null ? current : null));
      setResolvedPath((current) => (current === null ? current : null));
      setExpandedPathIds((current) => (current.length === 0 ? current : []));
      return undefined;
    }
    if (rootsQuery.isLoading) return undefined;

    let cancelled = false;

    const hydrateSelectedPath = async () => {
      if (findTreeNode(rootTreeItems, selectedId)) {
        if (!cancelled) {
          setHydratedTreeItems(null);
          setResolvedPath(null);
          setExpandedPathIds([]);
        }
        return;
      }

      try {
        const ancestors = await fetchBaseInfoAncestorPath(selectedId);
        if (cancelled || ancestors.length === 0) return;

        const label = ancestors.map((node) => formatBaseInfoTreeLabel(node)).join(' / ');
        setResolvedPath({ id: selectedId, label });

        let tree = rootTreeItems;
        const expandIds: string[] = [];
        for (let index = 0; index < ancestors.length - 1; index += 1) {
          const parent = ancestors[index];
          expandIds.push(parent.id);
          if (findTreeNode(tree, parent.id)) {
            const children = await fetchBaseInfoChildren({
              lang: 'en',
              root: '',
              parentId: parent.id,
            });
            tree = mergeTreeChildren(tree, parent.id, children.map(mapBaseInfoRowToTreeNode));
          }
        }

        if (!cancelled) {
          setHydratedTreeItems(tree);
          setExpandedPathIds(expandIds);
        }
      } catch {
        if (!cancelled) {
          setResolvedPath({ id: selectedId, label: selectedId });
          setHydratedTreeItems(null);
          setExpandedPathIds([]);
        }
      }
    };

    void hydrateSelectedPath();
    return () => {
      cancelled = true;
    };
  }, [form.baseInfoRootId, rootTreeItems, rootsQuery.isLoading]);

  const isBaseInfoSource = form.sourceType === 'BASE_INFO';
  const isCustomSource = form.sourceType === 'CUSTOM';
  const isMultiCardinality = form.cardinality === 'multi';
  const keyMissing = !disableKey && !form.key.trim();
  const rootMissing = isBaseInfoSource && !form.baseInfoRootId.trim();

  return (
    <div className={cn('grid grid-cols-1 lg:grid-cols-[1fr_auto]', SETTINGS_FORM_GRID_GAP_CLASS)}>
      <div className={cn('min-w-0', SETTINGS_FORM_GROUP_BODY_STACK_CLASS)}>
      <div className={cn('rounded-lg border border-slate-200 bg-white p-3', SETTINGS_FORM_GROUP_BODY_STACK_CLASS)}>
        <div className={cn('grid grid-cols-1 sm:grid-cols-2', SETTINGS_FORM_GRID_GAP_CLASS)}>
          <div className="flex flex-col gap-[2px]">
            <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>{attributeFormText('key', t)} *</label>
            <UiInput
              size="sm"
              autoDir={false}
              value={form.key}
              disabled={disableKey}
              onChange={(e) => onFormChange({ ...form, key: sanitizeAttributeKeyInput(e.target.value) })}
              placeholder={attributeFormText('keyPlaceholder', t)}
              className={cn(SETTINGS_CONTROL_CLASS, 'font-mono')}
              isInvalid={showValidation && keyMissing}
              errorMessage={showValidation && keyMissing ? t('settings.attributes.keyRequired') : undefined}
            />
          </div>
          <div className="flex flex-col gap-[2px]">
            <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>{attributeFormText('label', t)}</label>
            <UiInput size="sm" className={SETTINGS_CONTROL_CLASS} value={form.label} onChange={(e) => onFormChange({ ...form, label: e.target.value })} />
          </div>
        </div>
      </div>

      <div className={cn('rounded-lg border border-slate-200 bg-white p-3', SETTINGS_FORM_GROUP_BODY_STACK_CLASS)}>
        <div
          className={cn(
            resolveChoiceBoxShellClass(isEdit),
            '!flex-row !flex-wrap items-center gap-x-4 gap-y-1 !py-[7px]',
          )}
        >
          <span className={cn('shrink-0', SETTINGS_SUBSECTION_LABEL_CLASS)}>
            {attributeFormText('sourceType', t)}{isEdit ? '' : ' *'}
          </span>
          <UiRadioChoiceGroup
            name="settings-attribute-source-type"
            value={form.sourceType}
            orientation="horizontal"
            disabled={isEdit}
            className="!w-auto gap-x-3 [&>*]:!w-auto"
            ariaLabel={`${attributeFormText('sourceType', t)}${isEdit ? '' : ' *'}`}
            onChange={(value) => {
              if (isEdit) return;
              if (value !== 'BASE_INFO' && value !== 'CUSTOM') return;
              const sourceType = value;
              onFormChange({
                ...form,
                sourceType,
                ...(sourceType === 'CUSTOM'
                  ? { cardinality: 'single', minSelections: '', maxSelections: '' }
                  : {}),
              });
            }}
            options={[
              { value: 'BASE_INFO', label: attributeFormText('sourceType.baseInfo', t) },
              { value: 'CUSTOM', label: attributeFormText('sourceType.custom', t) },
            ]}
          />
        </div>

        <div className="flex flex-col gap-[2px]">
          <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>
            {attributeFormText('baseInfoRoot', t)}{isBaseInfoSource ? ' *' : ''}
          </label>
          <UiTreeSelect
            size="sm"
            value={form.baseInfoRootId}
            valueLabel={valuePathLabel}
            items={baseInfoTreeItems}
            defaultExpandedIds={expandedPathIds}
            onLoadChildren={loadBaseInfoChildren}
            isDisabled={!isBaseInfoSource}
            isLoading={rootsQuery.isLoading}
            isInvalid={showValidation && rootMissing}
            errorMessage={showValidation && rootMissing ? t('settings.attributes.baseInfoRootRequired') : undefined}
            placeholder={attributeFormText('selectRoot', t)}
            ariaLabel={`${attributeFormText('baseInfoRoot', t)}${isBaseInfoSource ? ' *' : ''}`}
            onChange={(value) => onFormChange({ ...form, baseInfoRootId: value })}
          />
        </div>
      </div>

      <div className={cn('rounded-lg border border-slate-200 bg-white p-3', SETTINGS_FORM_GROUP_BODY_STACK_CLASS)}>
        <div className={cn('grid grid-cols-1 sm:grid-cols-2', SETTINGS_FORM_GRID_GAP_CLASS)}>
          <div className="flex flex-col gap-[2px]">
            <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>
              {attributeFormText('dataType', t)}{isCustomSource ? ' *' : ''}
            </label>
            <UiSelect
              size="sm"
              value={form.dataType}
              disabled={!isCustomSource}
              onChange={(e) => onFormChange({
                ...form,
                dataType: e.target.value as SettingsAttributeFormState['dataType'],
              })}
            >
              {dataTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </UiSelect>
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>{attributeFormText('cardinality', t)} *</label>
            <UiSelect
              size="sm"
              value={isCustomSource ? 'single' : form.cardinality}
              disabled={isCustomSource}
              onChange={(e) => onFormChange({
                ...form,
                cardinality: e.target.value as SettingsAttributeFormState['cardinality'],
              })}
            >
              <option value="single">{attributeFormText('cardinality.single', t)}</option>
              <option value="multi">{attributeFormText('cardinality.multi', t)}</option>
            </UiSelect>
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>{attributeFormText('minSelections', t)}</label>
            <UiInput
              size="sm"
              value={isCustomSource ? '' : form.minSelections}
              disabled={isCustomSource || !isMultiCardinality}
              onChange={(e) => onFormChange({ ...form, minSelections: e.target.value })}
              placeholder={attributeFormText('optionalPlaceholder', t)}
            />
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>{attributeFormText('maxSelections', t)}</label>
            <UiInput
              size="sm"
              value={isCustomSource ? '' : form.maxSelections}
              disabled={isCustomSource || !isMultiCardinality}
              onChange={(e) => onFormChange({ ...form, maxSelections: e.target.value })}
              placeholder={attributeFormText('optionalPlaceholder', t)}
            />
          </div>
        </div>
      </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 lg:w-52 shrink-0">
        <div className="flex flex-col">
          <div className="pt-2 pb-1">
            <UiCheckboxChoice
              checked={form.isActive}
              onChange={(checked) => onFormChange({ ...form, isActive: checked })}
            >
              {attributeFormText('active', t)}
            </UiCheckboxChoice>
          </div>

          <div className="-mt-[3px] pt-0 pb-2">
            <UiCheckboxChoice
              checked={form.isRequired}
              onChange={(checked) => onFormChange({ ...form, isRequired: checked })}
            >
              {attributeFormText('required', t)}
            </UiCheckboxChoice>
          </div>

          {scope === 'USER' ? (
            <div className="flex flex-col gap-[2px] py-2">
              <span className={SETTINGS_SUBSECTION_LABEL_CLASS}>{attributeFormText('userEditPolicy', t)}</span>
              <UiRadioChoiceGroup
                name="settings-attribute-user-edit-policy"
                value={form.userEditPolicy}
                onChange={(value) => {
                  if (value !== 'NONE' && value !== 'WHEN_EMPTY' && value !== 'ALWAYS') return;
                  onFormChange({
                    ...form,
                    userEditPolicy: value,
                    userEditable: value !== 'NONE',
                  });
                }}
                className="mt-[2px]"
                ariaLabel={attributeFormText('userEditPolicy', t)}
                options={userEditPolicyOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export type SettingsAttributeFormModalProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  form: SettingsAttributeFormState;
  onFormChange: (form: SettingsAttributeFormState) => void;
  formError: string | null;
  isSaving: boolean;
  disableKey?: boolean;
  isEdit?: boolean;
  scope: AttributeScope;
  onClose: () => void;
  onSubmit: () => void;
};

export const SettingsAttributeFormModal: React.FC<SettingsAttributeFormModalProps> = ({
  open,
  title,
  submitLabel,
  form,
  onFormChange,
  formError,
  isSaving,
  disableKey = false,
  isEdit = false,
  scope,
  onClose,
  onSubmit,
}) => {
  const t = useCultureT();
  if (!open) return null;

  return (
    <CreateEditModalShell
      size="4xl"
      title={title}
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            {t('actions.cancel')}
          </AppButton>
          <AppButton intent="primary" onClick={onSubmit} disabled={isSaving}>
            {isEdit ? (
              <Save className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {isSaving ? t('settings.ui.saving') : submitLabel}
          </AppButton>
        </>
      )}
    >
      <SettingsAttributeFormFields
        form={form}
        onFormChange={onFormChange}
        disableKey={disableKey}
        isEdit={isEdit}
        scope={scope}
        showValidation={Boolean(formError)}
      />
      {formError && <p className="mt-2 text-xs text-red-600 font-semibold">{formError}</p>}
    </CreateEditModalShell>
  );
};
