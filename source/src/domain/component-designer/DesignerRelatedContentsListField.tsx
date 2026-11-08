/**
 * Export/codegen wrapper for `form.related-contents-list` — published pages use runtimeRenderer;
 * this field exists for generated TSX bundles that import the catalog component by name.
 */
import * as React from 'react';
import type { DesignerBindingDefinitions } from './types';
import { DesignerRuntimeRelatedContentsList } from './DesignerRuntimeRelatedContentsList';
import type { DesignerNode } from './types';

type DesignerRelatedContentsListFieldProps = {
  node?: DesignerNode;
  designerStore?: Record<string, unknown>;
  bindingDefinitions?: DesignerBindingDefinitions;
  className?: string;
  relatedContentsDataSourceRef?: string;
  relatedContentsContentIdPath?: string;
  relatedContentsCreateModalNodeId?: string;
  relatedContentsOptionsDataSourceRef?: string;
  relatedContentsContentOptions?: string;
  relatedContentsExcludeContentTypeCode?: string;
};

export const DesignerRelatedContentsListField: React.FC<DesignerRelatedContentsListFieldProps> = (props) => {
  const node: DesignerNode = props.node ?? {
    id: 'related-contents-list-export',
    type: 'container',
    children: [],
    binding: {},
    props: {
      className: props.className,
      relatedContentsDataSourceRef: props.relatedContentsDataSourceRef,
      relatedContentsContentIdPath: props.relatedContentsContentIdPath,
      relatedContentsCreateModalNodeId: props.relatedContentsCreateModalNodeId,
      relatedContentsOptionsDataSourceRef: props.relatedContentsOptionsDataSourceRef,
      relatedContentsContentOptions: props.relatedContentsContentOptions,
      relatedContentsExcludeContentTypeCode: props.relatedContentsExcludeContentTypeCode,
    },
  };

  return (
    <DesignerRuntimeRelatedContentsList
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
