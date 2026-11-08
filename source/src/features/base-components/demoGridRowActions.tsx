import React from 'react';
import { Eye, KeyRound, Pencil, Tags, Trash2 } from 'lucide-react';
import {
  AppGridRowActions,
  type GridRowActionItem,
} from '../../shared/ui/AppGridRowActions';
import {
  DEFAULT_GRID_MAX_VISIBLE_ACTIONS,
  gridActionsColumnWidth,
  resolveGridActionSlotCount,
} from '../../shared/lib/gridRowActions';

export const DEMO_GRID_ROW_ACTIONS: readonly GridRowActionItem[] = [
  { id: 'view', label: 'View', intent: 'view', icon: <Eye className="h-3.5 w-3.5" />, onClick: () => undefined },
  { id: 'edit', label: 'Edit', intent: 'edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => undefined },
  { id: 'tags', label: 'Attributes', intent: 'edit', icon: <Tags className="h-3.5 w-3.5" />, onClick: () => undefined },
  { id: 'access', label: 'Access', intent: 'access', icon: <KeyRound className="h-3.5 w-3.5" />, onClick: () => undefined },
  { id: 'delete', label: 'Delete', intent: 'delete', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => undefined },
];

export function demoGridActionsColumnWidth(maxVisible: number = DEFAULT_GRID_MAX_VISIBLE_ACTIONS): number {
  return gridActionsColumnWidth(resolveGridActionSlotCount(DEMO_GRID_ROW_ACTIONS.length, maxVisible));
}

export const DemoGridRowActions: React.FC<{ maxVisible?: number }> = ({
  maxVisible = DEFAULT_GRID_MAX_VISIBLE_ACTIONS,
}) => (
  <AppGridRowActions actions={DEMO_GRID_ROW_ACTIONS} maxVisible={maxVisible} />
);
