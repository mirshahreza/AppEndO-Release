/**
 * Export/codegen wrapper for `form.cms-content-assets` — published pages use runtimeRenderer;
 * this field exists for generated TSX bundles that import the catalog component by name.
 */
import * as React from 'react';
import type { DesignerBindingDefinitions } from './types';
import { DesignerRuntimeCmsContentAssets } from './DesignerRuntimeCmsContentAssets';
import type { DesignerNode } from './types';

type DesignerCmsContentAssetsFieldProps = {
  node?: DesignerNode;
  designerStore?: Record<string, unknown>;
  bindingDefinitions?: DesignerBindingDefinitions;
  className?: string;
  cmsContentAssetsDataSourceRef?: string;
  cmsContentAssetsContentIdPath?: string;
};

export const DesignerCmsContentAssetsField: React.FC<DesignerCmsContentAssetsFieldProps> = (props) => {
  const node: DesignerNode = props.node ?? {
    id: 'cms-content-assets-export',
    type: 'container',
    children: [],
    binding: {},
    props: {
      className: props.className,
      cmsContentAssetsDataSourceRef: props.cmsContentAssetsDataSourceRef,
      cmsContentAssetsContentIdPath: props.cmsContentAssetsContentIdPath,
    },
  };

  return (
    <DesignerRuntimeCmsContentAssets
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
