/**
 * Export/codegen wrapper for `form.base-info-record`.
 */
import * as React from 'react';
import type { DesignerBindingDefinitions, DesignerNode } from './types';
import { DesignerRuntimeBaseInfoRecordForm } from './DesignerRuntimeBaseInfoRecordForm';

type DesignerBaseInfoRecordFormFieldProps = {
  node?: DesignerNode;
  designerStore?: Record<string, unknown>;
  bindingDefinitions?: DesignerBindingDefinitions;
  className?: string;
  baseInfoRecordFixedParentId?: string;
  baseInfoRecordParentLabel?: string;
  baseInfoRecordDataSourceRef?: string;
};

export const DesignerBaseInfoRecordFormField: React.FC<DesignerBaseInfoRecordFormFieldProps> = (props) => {
  const node: DesignerNode = props.node ?? {
    id: 'base-info-record-export',
    type: 'container',
    children: [],
    binding: {},
    props: {
      className: props.className,
      baseInfoRecordFixedParentId: props.baseInfoRecordFixedParentId,
      baseInfoRecordParentLabel: props.baseInfoRecordParentLabel,
      baseInfoRecordDataSourceRef: props.baseInfoRecordDataSourceRef,
      _designerPaletteItemId: 'form.base-info-record',
    },
  };

  return (
    <DesignerRuntimeBaseInfoRecordForm
      node={node}
      options={{
        mode: 'runtime',
        designerStore: props.designerStore,
        bindingDefinitions: props.bindingDefinitions,
        previewEvents: {
          bindingContext: {},
          designerStore: props.designerStore ?? {},
          patchStore: () => undefined,
          mutationCallbacks: {},
          isSubmitting: false,
        },
      }}
    />
  );
};
