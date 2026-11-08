import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  DEFAULT_GRID_MAX_VISIBLE_ACTIONS,
  orderCardFooterGridRowActions,
  splitGridRowActions,
  type GridRowActionIntent,
} from '../lib/gridRowActions';
import { ActionTooltip } from './ActionTooltip';
import {
  SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
  SplitButtonMenuItem,
  useFixedDropDownMenuStyle,
  useSplitButtonMenu,
} from './AppSplitButton';
import { AppButton } from './AppButton';
import { NativeButton } from './NativeButton';
import { overlayMotionDocumentDir, overlayMotionPanelProps } from './overlay-motion/overlayMotion';
import {
  FLOATING_ACTION_SEPARATOR_CLASS,
  GRID_ACTION_ACCESS_CLASS,
} from './surfaceClasses';

export type GridRowActionItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  intent?: GridRowActionIntent;
  disabled?: boolean;
  title?: string;
  badge?: React.ReactNode;
  /** Card footer: labeled `sm` button (touch target) instead of a 20px icon. */
  cardLabeled?: boolean;
};

export type AppGridRowActionsProps = {
  actions: readonly GridRowActionItem[];
  maxVisible?: number;
  className?: string;
  align?: 'start' | 'end' | 'center';
  /** Table rows use 20px icons; card footers use larger targets when `cardLabeled` is set. */
  density?: 'table' | 'card';
};

export const GRID_ROW_ACTION_BUTTON_CLASS =
  'relative h-5 w-5 inline-flex items-center justify-center rounded-sm transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent';

export const GRID_ROW_ACTION_INTENT_CLASS: Record<GridRowActionIntent, string> = {
  view: 'text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50',
  edit: 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50',
  delete: 'text-rose-600 hover:text-rose-700 hover:bg-rose-50',
  access: GRID_ACTION_ACCESS_CLASS,
  utility: 'text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50',
  warning: 'text-amber-600 hover:text-amber-700 hover:bg-amber-50',
};

const alignClass: Record<NonNullable<AppGridRowActionsProps['align']>, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

const GridRowActionIconButton: React.FC<{
  action: GridRowActionItem;
  density: 'table' | 'card';
}> = ({ action, density }) => {
  const ariaLabel = action.title || action.label;

  if (density === 'card' && action.cardLabeled) {
    return (
      <AppButton
        type="button"
        size="sm"
        intent={action.intent === 'delete' ? 'destructive-soft' : action.intent ?? 'utility'}
        onClick={action.onClick}
        disabled={action.disabled}
        title={ariaLabel}
        className="min-h-8 gap-1.5 px-2 text-xs font-medium"
      >
        {action.icon}
        <span>{action.label}</span>
      </AppButton>
    );
  }

  const button = (
    <NativeButton
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={cn(
        GRID_ROW_ACTION_BUTTON_CLASS,
        density === 'card' && 'h-8 w-8',
        GRID_ROW_ACTION_INTENT_CLASS[action.intent ?? 'utility'],
        'disabled:text-slate-400 disabled:hover:bg-transparent',
      )}
      aria-label={ariaLabel}
    >
      {action.icon}
      {action.badge}
    </NativeButton>
  );

  return (
    <ActionTooltip content={ariaLabel}>
      {button}
    </ActionTooltip>
  );
};

const GridRowActionsOverflow: React.FC<{
  actions: readonly GridRowActionItem[];
  density: 'table' | 'card';
}> = ({ actions, density }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = useSplitButtonMenu(menuOpen, setMenuOpen, [panelRef]);
  const fixedMenuStyle = useFixedDropDownMenuStyle(menuOpen, menuRef, { align: 'end' });
  const menuMotion = overlayMotionPanelProps({
    kind: 'popover',
    origin: 'top-end',
    dir: overlayMotionDocumentDir(),
  });

  const menuPanel = menuOpen ? (
    <div
      ref={panelRef}
      className={cn(SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS, 'min-w-[10rem]', menuMotion.className)}
      data-overlay-kind={menuMotion['data-overlay-kind']}
      data-overlay-origin={menuMotion['data-overlay-origin']}
      data-overlay-dir={menuMotion['data-overlay-dir']}
      style={fixedMenuStyle}
      role="menu"
      aria-label="More row actions"
    >
      {actions.map((action) => (
        <SplitButtonMenuItem
          key={action.id}
          icon={action.icon}
          disabled={action.disabled}
          className={action.disabled ? undefined : GRID_ROW_ACTION_INTENT_CLASS[action.intent ?? 'utility']}
          onClick={() => {
            action.onClick();
            setMenuOpen(false);
          }}
        >
          {action.label}
        </SplitButtonMenuItem>
      ))}
    </div>
  ) : null;

  return (
    <div ref={menuRef} className="relative inline-flex">
      <ActionTooltip content="More actions">
        <NativeButton
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className={cn(
            GRID_ROW_ACTION_BUTTON_CLASS,
            density === 'card' && 'h-8 w-8',
            'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
          )}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        </NativeButton>
      </ActionTooltip>
      {menuPanel && typeof document !== 'undefined' ? createPortal(menuPanel, document.body) : menuPanel}
    </div>
  );
};

export const AppGridRowActions: React.FC<AppGridRowActionsProps> = ({
  actions,
  maxVisible = DEFAULT_GRID_MAX_VISIBLE_ACTIONS,
  className,
  align = 'end',
  density = 'table',
}) => {
  const orderedActions =
    density === 'card' ? orderCardFooterGridRowActions(actions) : actions;
  const { inline, overflow } = splitGridRowActions(orderedActions, maxVisible);
  const items: React.ReactNode[] = [];

  inline.forEach((action, index) => {
    if (index > 0) {
      items.push(
        <span key={`sep-${action.id}`} className={FLOATING_ACTION_SEPARATOR_CLASS} aria-hidden="true" />,
      );
    }
    items.push(<GridRowActionIconButton key={action.id} action={action} density={density} />);
  });

  if (overflow.length > 0) {
    if (inline.length > 0) {
      items.push(<span key="sep-overflow" className={FLOATING_ACTION_SEPARATOR_CLASS} aria-hidden="true" />);
    }
    items.push(<GridRowActionsOverflow key="overflow" actions={overflow} density={density} />);
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center', alignClass[align], className)}>
      {items}
    </div>
  );
};
