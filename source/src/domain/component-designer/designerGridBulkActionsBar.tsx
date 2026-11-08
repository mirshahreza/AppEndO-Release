import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { AppButton } from '../../shared/ui/AppButton';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
} from '../../shared/ui';
import { resolveDesignerGridActionIcon } from './designerGridActionColumns';
import type { DesignerGridToolbarBulkAction } from './designerGridSelectionRuntime';
import { executeGridBulkAction } from './designerGridSelectionRuntime';
import type { DynamicActionRuntimeContext } from './bindingDynamicActionsRuntime';
import type { DesignerBindingDefinitions } from './types';

type DesignerGridBulkActionsBarProps = {
  bulkActions: readonly DesignerGridToolbarBulkAction[];
  selectedKeys: readonly string[];
  bindingDefinitions: DesignerBindingDefinitions;
  runtime: DynamicActionRuntimeContext;
  selectionStorePath?: string;
  activeIdStorePath?: string;
  disabled?: boolean;
};

export const DesignerGridBulkActionsBar: React.FC<DesignerGridBulkActionsBarProps> = ({
  bulkActions,
  selectedKeys,
  bindingDefinitions,
  runtime,
  selectionStorePath,
  activeIdStorePath,
  disabled = false,
}) => {
  const [busyActionId, setBusyActionId] = React.useState<string | null>(null);

  if (selectedKeys.length === 0 || bulkActions.length === 0) {
    return null;
  }

  return (
    <div
      className={`${PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS} items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50/70 px-2 py-1.5`}
      data-designer-grid-bulk-actions=""
      role="toolbar"
      aria-label={`Bulk actions (${selectedKeys.length} selected)`}
    >
      <span className="ps-[4px] text-[11px] font-semibold text-indigo-800">
        {selectedKeys.length} selected
      </span>
      {bulkActions.map((action) => {
        const Icon = resolveDesignerGridActionIcon(action.icon ?? 'Trash2') ?? Trash2;
        return (
          <AppButton
            key={action.id}
            type="button"
            size="sm"
            intent="warning"
            disabled={disabled || busyActionId !== null}
            data-bulk-action-id={action.id}
            onClick={() => {
              void (async () => {
                setBusyActionId(action.id);
                try {
                  await executeGridBulkAction(action, selectedKeys, {
                    bindingDefinitions,
                    runtime,
                    selectionStorePath,
                    activeIdStorePath,
                  });
                } finally {
                  setBusyActionId(null);
                }
              })();
            }}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {action.label}
          </AppButton>
        );
      })}
    </div>
  );
};
