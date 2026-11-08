import type { BaseTreeGridRow } from '../../components/ui/BaseTreeGrid';
import type { DesignerNode } from '../../domain/component-designer/types';
import type { OutlineNodeDisplay } from '../../domain/component-designer/outlineNodeDisplay';

export type OutlineTreeRow = BaseTreeGridRow & {
  node: DesignerNode;
  diagnosticsCount: number;
  isRoot: boolean;
  display: OutlineNodeDisplay;
  treeLabel: string;
};
