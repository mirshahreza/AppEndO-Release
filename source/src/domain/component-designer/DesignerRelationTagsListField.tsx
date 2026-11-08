/**
 * Export/codegen wrapper for `form.relation-tags-list` — published pages use runtimeRenderer;
 * this field exists for generated TSX bundles that import the catalog component by name.
 */
import * as React from 'react';
import type { DesignerBindingDefinitions } from './types';
import { DesignerRuntimeRelationTagsList } from './DesignerRuntimeRelationTagsList';
import type { DesignerNode } from './types';

type DesignerRelationTagsListFieldProps = {
  node?: DesignerNode;
  designerStore?: Record<string, unknown>;
  bindingDefinitions?: DesignerBindingDefinitions;
  className?: string;
  relationTagsDataSourceRef?: string;
  relationTagsContentIdPath?: string;
  relationTagsValueField?: string;
  relationTagsRowKeyField?: string;
  relationTagsParentField?: string;
  relationTagsSelectPlacement?: string;
  relationTagsPlaceholder?: string;
  relationTagsOptions?: string;
};

export const DesignerRelationTagsListField: React.FC<DesignerRelationTagsListFieldProps> = (props) => {
  const node: DesignerNode = props.node ?? {
    id: 'relation-tags-list-export',
    type: 'container',
    children: [],
    binding: {},
    props: {
      className: props.className,
      relationTagsDataSourceRef: props.relationTagsDataSourceRef,
      relationTagsContentIdPath: props.relationTagsContentIdPath,
      relationTagsValueField: props.relationTagsValueField,
      relationTagsRowKeyField: props.relationTagsRowKeyField,
      relationTagsParentField: props.relationTagsParentField,
      relationTagsSelectPlacement: props.relationTagsSelectPlacement,
      relationTagsPlaceholder: props.relationTagsPlaceholder,
      relationTagsOptions: props.relationTagsOptions,
    },
  };

  return (
    <DesignerRuntimeRelationTagsList
      node={node}
      options={{
        mode: 'runtime',
        designerStore: props.designerStore,
        bindingDefinitions: props.bindingDefinitions,
        previewEvents: {
          refreshDataSource: async () => undefined,
        },
      }}
    />
  );
};
