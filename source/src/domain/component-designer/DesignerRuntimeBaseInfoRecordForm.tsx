import * as React from 'react';
import { BaseInfoFormFields } from '../../shared/ui/BaseInfoFormFields';
import { mapRecordToBaseInfoEditForm } from '../../shared/lib/baseInfoEditForm';
import type { BaseInfoEditForm } from '../../shared/api/contracts/base-info/editForm';
import {
  findAncestorDataRegion,
  resolveAncestorRegionDataVar,
} from './bindingRegionEngine';
import {
  BASE_INFO_RECORD_FORM_COLUMNS,
  baseInfoRecordHiddenFieldName,
  readBaseInfoRecordFormProp,
} from './baseInfoRecordFormColumns';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import { readString, resolveRuntimeNodeClassName } from './runtimeShared';
import type { RuntimeRenderOptions } from './runtimeTypes';
import type { DesignerNode } from './types';

const coerceRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const readRegionRecord = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): Record<string, unknown> | null => {
  const document = options.designerDocument;
  const bindingContext = options.previewEvents?.bindingContext;
  if (!document || !bindingContext) {
    return null;
  }

  const ancestor = findAncestorDataRegion(document, node.id);
  if (!ancestor) {
    return null;
  }

  const dataVar = resolveAncestorRegionDataVar(document, ancestor);
  return coerceRecord(bindingContext[dataVar]);
};

const resolveIsCreateMode = (
  record: Record<string, unknown> | null,
  primaryKey = 'id',
): boolean => {
  const id = record?.[primaryKey];
  return id === undefined || id === null || String(id).trim().length === 0;
};

export const DesignerRuntimeBaseInfoRecordForm: React.FC<{
  node: DesignerNode;
  options: RuntimeRenderOptions;
}> = ({ node, options }) => {
  const fixedParentId = readBaseInfoRecordFormProp(node.props, 'baseInfoRecordFixedParentId');
  const parentLabel = readBaseInfoRecordFormProp(node.props, 'baseInfoRecordParentLabel');
  const regionRecord = readRegionRecord(node, options);
  const isCreateMode = resolveIsCreateMode(regionRecord);

  const [form, setForm] = React.useState<BaseInfoEditForm>(() => mapRecordToBaseInfoEditForm(regionRecord, {
    parentId: fixedParentId,
    childDigits: '3',
    isActive: true,
  }));

  const regionSyncKey = React.useMemo(
    () => JSON.stringify(regionRecord ?? {}),
    [regionRecord],
  );

  React.useEffect(() => {
    setForm(mapRecordToBaseInfoEditForm(regionRecord, {
      parentId: fixedParentId,
      childDigits: '3',
      isActive: true,
    }));
  }, [fixedParentId, regionSyncKey]);

  const parentDisplayValue = parentLabel || fixedParentId || 'Root';
  const className = resolveRuntimeNodeClassName(node, 'w-full');

  return (
    <div
      className={className}
      data-designer-component="form.base-info-record"
    >
      <BaseInfoFormFields
        form={form}
        onFormChange={setForm}
        isCreateMode={isCreateMode}
        parentDisplayValue={parentDisplayValue}
      />
      {BASE_INFO_RECORD_FORM_COLUMNS.map(({ column, createOnly }) => {
        if (createOnly && !isCreateMode) {
          return null;
        }

        const fieldName = baseInfoRecordHiddenFieldName(node.id, column);
        const rawValue = form[column as keyof BaseInfoEditForm];
        const value = rawValue === undefined || rawValue === null
          ? ''
          : typeof rawValue === 'boolean'
            ? (rawValue ? 'true' : 'false')
            : String(rawValue);

        return (
          <input
            key={fieldName}
            type="hidden"
            name={fieldName}
            value={value}
          />
        );
      })}
    </div>
  );
};

export const resolveBaseInfoRecordPaletteItemId = (node: DesignerNode): string | undefined => {
  const paletteItemId = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof paletteItemId === 'string' ? paletteItemId.trim() : undefined;
};

export const readBaseInfoRecordNodeProps = (node: DesignerNode) => ({
  fixedParentId: readString(node.props.baseInfoRecordFixedParentId),
  parentLabel: readString(node.props.baseInfoRecordParentLabel),
  dataSourceRef: readString(node.props.baseInfoRecordDataSourceRef),
});
