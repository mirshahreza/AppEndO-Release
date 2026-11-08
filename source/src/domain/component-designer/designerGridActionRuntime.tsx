import * as React from 'react';
import { ActionTooltip } from '../../shared/ui/ActionTooltip';
import { AppGridRowActions } from '../../shared/ui/AppGridRowActions';
import { FLOATING_ACTION_SEPARATOR_CLASS } from '../../shared/ui/surfaceClasses';
import { NativeButton } from '../../shared/ui/NativeButton';
import type { RuntimeRenderMode } from './runtimeTypes';
import {
  DESIGNER_GRID_ACTION_BUTTON_CLASS,
  GRID_ACTION_INTENT_CLASS,
  resolveDesignerGridActionIcon,
  type DesignerGridRowAction,
} from './designerGridActionColumns';

type GridActionInvokeContext = {
  mode: RuntimeRenderMode;
  row: Record<string, unknown>;
  canInvoke: boolean;
  /** When true, action controls stay clickable in design mode (canvas GridDetail preview). */
  allowDesignInvoke: boolean;
  isActionDisabled?: (action: DesignerGridRowAction) => boolean;
  onInvokeAction?: (action: DesignerGridRowAction) => void;
  onInvoke: (actionId: string) => void;
};

const renderGridActionIconButton = (
  action: DesignerGridRowAction,
  context: GridActionInvokeContext,
  options: { showDividerBefore?: boolean } = {},
): React.ReactNode => {
  const Icon = resolveDesignerGridActionIcon(action.icon);
  const ariaLabel = action.tooltip || action.label || action.actionId;
  const isDisabled = context.isActionDisabled?.(action) ?? false;
  const canClick = context.allowDesignInvoke && context.canInvoke && !isDisabled;
  const badgeValue = action.badgeField ? context.row[action.badgeField] : undefined;
  const badgeText = badgeValue === undefined || badgeValue === null || badgeValue === ''
    ? null
    : String(badgeValue);

  const button = (
    <NativeButton
      type="button"
      onClick={() => {
        if (context.onInvokeAction) {
          context.onInvokeAction(action);
          return;
        }
        context.onInvoke(action.actionId);
      }}
      disabled={!canClick}
      className={`${DESIGNER_GRID_ACTION_BUTTON_CLASS} ${GRID_ACTION_INTENT_CLASS[action.intent]} disabled:text-slate-400 disabled:hover:bg-transparent`}
      aria-label={ariaLabel}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {badgeText !== null ? (
        <span className="absolute -end-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold leading-4 text-white">
          {badgeText}
        </span>
      ) : null}
    </NativeButton>
  );

  return (
    <React.Fragment key={action.actionId}>
      {options.showDividerBefore ? (
        <span className={FLOATING_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
      ) : null}
      <ActionTooltip content={action.tooltip || ariaLabel}>
        {button}
      </ActionTooltip>
    </React.Fragment>
  );
};

export const DesignerGridIconActionCell: React.FC<{
  action: DesignerGridRowAction;
  label?: string;
  display: 'button' | 'icon';
  context: GridActionInvokeContext;
}> = ({ action, label, display, context }) => {
  if (display === 'icon') {
    return (
      <div className="flex items-center justify-end">
        {renderGridActionIconButton(action, context)}
      </div>
    );
  }

  const isDisabled = context.isActionDisabled?.(action) ?? false;
  const canClick = context.allowDesignInvoke && context.canInvoke && !isDisabled;
  return (
    <button
      type="button"
      className={`inline-flex h-7 items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 text-[11px] font-semibold text-indigo-700 ${canClick ? 'hover:bg-indigo-100' : 'opacity-60'}`}
      disabled={!canClick}
      onClick={() => {
        if (context.onInvokeAction) {
          context.onInvokeAction(action);
          return;
        }
        context.onInvoke(action.actionId);
      }}
    >
      {label || action.label || 'Details'}
    </button>
  );
};

export const DesignerGridActionGroupCell: React.FC<{
  actions: readonly DesignerGridRowAction[];
  context: GridActionInvokeContext;
  maxVisible?: number;
}> = ({ actions, context, maxVisible }) => (
  <AppGridRowActions
    maxVisible={maxVisible}
    actions={actions.map((action) => {
      const Icon = resolveDesignerGridActionIcon(action.icon);
      const isDisabled = context.isActionDisabled?.(action) ?? false;
      const canClick = context.allowDesignInvoke && context.canInvoke && !isDisabled;
      const badgeValue = action.badgeField ? context.row[action.badgeField] : undefined;
      const badgeText = badgeValue === undefined || badgeValue === null || badgeValue === ''
        ? null
        : String(badgeValue);

      return {
        id: action.actionId,
        label: action.label || action.tooltip || action.actionId,
        title: action.tooltip || action.label || action.actionId,
        intent: action.intent,
        disabled: !canClick,
        icon: <Icon className="h-3.5 w-3.5" aria-hidden="true" />,
        badge: badgeText !== null ? (
          <span className="absolute -end-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold leading-4 text-white">
            {badgeText}
          </span>
        ) : null,
        onClick: () => {
          if (context.onInvokeAction) {
            context.onInvokeAction(action);
            return;
          }
          context.onInvoke(action.actionId);
        },
      };
    })}
  />
);
