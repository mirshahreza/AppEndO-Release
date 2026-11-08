import React from 'react';
import { applyCatalogProp, readCatalogProp } from '../../../domain/component-designer/applyCatalogProp';
import type { DesignerAction, DesignerNode } from '../../../domain/component-designer/types';
import { allocateCrudSetColumnId, type CrudSetGridColumn } from '../../../domain/component-designer/crudSetSpec';
import { CrudSetColumnList } from '../../../shared/ui';
import { DesignerFieldRow } from './DesignerFieldRow';

type InspectorCrudSetColumnsFieldProps = {
  node: DesignerNode;
  dispatch: React.Dispatch<DesignerAction>;
  propPath?: string;
};

export const InspectorCrudSetColumnsField: React.FC<InspectorCrudSetColumnsFieldProps> = ({
  node,
  dispatch,
  propPath = 'spec.columns',
}) => {
  const raw = readCatalogProp(node.props, { propPath });
  const columns = Array.isArray(raw) ? raw as CrudSetGridColumn[] : [];

  return (
    <DesignerFieldRow label="Columns" layout="stack">
      <CrudSetColumnList
        columns={columns}
        onChange={(next) => {
          const withIds = next.map((column) => (
            column.id ? column : { ...column, id: allocateCrudSetColumnId(next, column.field) }
          ));
          const nextProps = applyCatalogProp(node.props, { propPath }, withIds);
          const rootKey = propPath.split('.')[0] ?? 'spec';
          dispatch({
            type: 'set-node-prop',
            nodeId: node.id,
            key: rootKey,
            value: nextProps[rootKey],
          });
        }}
      />
    </DesignerFieldRow>
  );
};
