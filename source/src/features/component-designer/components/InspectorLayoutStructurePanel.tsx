import * as React from 'react';
import { Columns2, Rows2 } from 'lucide-react';
import {
  resolveLayoutStructureHint,
  type LayoutTrackAxis,
} from '../../../domain/component-designer/layoutStructure';
import type {
  DesignerAction,
  DesignerDocument,
  DesignerNode,
} from '../../../domain/component-designer/types';
import { AppButton } from '../../../shared/ui';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { DesignerFieldRow } from './DesignerFieldRow';

export type InspectorLayoutStructurePanelProps = {
  node: DesignerNode;
  document: DesignerDocument;
  dispatch: React.Dispatch<DesignerAction>;
};

export const InspectorLayoutStructurePanel: React.FC<InspectorLayoutStructurePanelProps> = ({
  node,
  document,
  dispatch,
}) => {
  const hint = resolveLayoutStructureHint(document.nodes, node.id);
  if (!hint) {
    return null;
  }

  const addTrack = (axis: LayoutTrackAxis) => {
    dispatch({ type: 'add-layout-track', nodeId: node.id, axis, place: 'after' });
  };

  return (
    <div
      className="space-y-1"
      data-inspector-field="layoutStructure"
      data-testid="inspector-layout-structure"
      {...pageGuideLocalProps(
        'Layout structure',
        'Add columns or rows to this layout from Properties, or use the plus marks on the canvas.',
        12,
      )}
    >
      <DesignerFieldRow
        label="Structure"
        align="start"
        hint="Add columns or rows here, or use the plus marks on the canvas when you hover a pane or cell."
      >
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          <AppButton
            type="button"
            size="sm"
            intent="secondary"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={!hint.canAddColumn}
            aria-label={hint.addColumnLabel}
            onClick={() => addTrack('column')}
          >
            <Columns2 className="h-3.5 w-3.5" />
            {hint.addColumnLabel}
          </AppButton>
          <AppButton
            type="button"
            size="sm"
            intent="secondary"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={!hint.canAddRow}
            aria-label={hint.addRowLabel}
            onClick={() => addTrack('row')}
          >
            <Rows2 className="h-3.5 w-3.5" />
            {hint.addRowLabel}
          </AppButton>
        </div>
      </DesignerFieldRow>
    </div>
  );
};
