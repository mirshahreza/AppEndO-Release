import React, { useState } from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useViewportTier } from '../lib/useViewportTier';
import { isCompactChromeTier } from '../lib/viewportTokens';
import { AppButton } from './AppButton';
import type { ButtonIntent } from './buttonSemantics';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';
import {
  SPLIT_BUTTON_MENU_PANEL_CLASS,
  SplitButtonMenuItem,
  useSplitButtonMenu,
} from './AppSplitButton';
import {
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  TOOLBAR_ACTION_COMPACT_BUTTON_CLASS,
  TOOLBAR_ACTION_LABEL_CLASS,
} from './surfaceClasses';
import { ToolbarCreateControl } from './ToolbarCreateControl';

export type ToolbarActionItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  intent?: ButtonIntent;
  disabled?: boolean;
  title?: string;
  /** Page-guide hint. When set, replaces the generic create/action auto-stop. */
  guideHint?: string;
  /** Stays visible on phone; other actions collapse into the overflow menu. */
  primary?: boolean;
  /** Keep visible label on desktop toolbar (default icon-only at lg–xl per `TOOLBAR_ACTION_LABEL_CLASS`). */
  alwaysLabeled?: boolean;
  loading?: boolean;
};

type ToolbarActionButtonProps = {
  action: ToolbarActionItem;
  labeled?: boolean;
};

const ToolbarActionButton: React.FC<ToolbarActionButtonProps> = ({ action, labeled = false }) => {
  const resolvedTitle = action.title ?? action.label;
  const showLabeled = labeled || Boolean(action.alwaysLabeled);
  const icon = action.loading
    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
    : action.icon;

  return (
    <AppButton
      intent={action.intent}
      size="sm"
      onClick={action.onClick}
      disabled={action.disabled}
      title={resolvedTitle}
      aria-label={showLabeled ? undefined : resolvedTitle}
      className={showLabeled ? undefined : TOOLBAR_ACTION_COMPACT_BUTTON_CLASS}
      {...(action.guideHint
        ? pageGuideLocalProps(action.label, action.guideHint, action.intent === 'create' ? 16 : 18)
        : {})}
    >
      {icon}
      {showLabeled ? (
        <span>{action.label}</span>
      ) : (
        <span className={TOOLBAR_ACTION_LABEL_CLASS}>{action.label}</span>
      )}
    </AppButton>
  );
};

export type ToolbarActionGroupProps = {
  actions?: ToolbarActionItem[];
  /** Extra items folded into the compact (⋯) menu on phone + tablet — e.g. Refresh. */
  compactOverflowActions?: ToolbarActionItem[];
};

/**
 * Responsive toolbar actions — industry pattern:
 * - phone + tablet (compact chrome): primary action(s) + overflow (⋯) for secondary
 * - lg–xl: icon-only square buttons with tooltips
 * - xl+: full labeled buttons
 *
 * Create actions (`intent: 'create'`) always use icon-only Plus via `ToolbarCreateControl`
 * (one button or a Plus dropdown when there are multiple create targets).
 */
export const ToolbarActionGroup: React.FC<ToolbarActionGroupProps> = ({
  actions = [],
  compactOverflowActions = [],
}) => {
  const tier = useViewportTier();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useSplitButtonMenu(menuOpen, setMenuOpen);

  const createActions = actions.filter((action) => action.intent === 'create');
  const nonCreateActions = actions.filter((action) => action.intent !== 'create');

  const createControl = createActions.length > 0 ? (
    <ToolbarCreateControl
      items={createActions.map((action) => ({
        id: action.id,
        label: action.label,
        onClick: action.onClick,
        icon: action.icon,
        guideHint: action.guideHint,
      }))}
    />
  ) : null;

  const primaryActions = nonCreateActions.filter((action) => action.primary);
  const secondaryActions = nonCreateActions.filter((action) => !action.primary);
  const compactMenuActions = isCompactChromeTier(tier)
    ? [...secondaryActions, ...compactOverflowActions]
    : [];
  const overflowOnCompactChrome = isCompactChromeTier(tier) && compactMenuActions.length > 0;

  const nonCreateChrome = overflowOnCompactChrome ? (
    <>
      {primaryActions.map((action) => (
        <ToolbarActionButton key={action.id} action={action} labeled />
      ))}
      <div className="relative" ref={menuRef}>
        <AppButton
          intent="utility"
          size="icon-md"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="More actions"
          aria-expanded={menuOpen}
          title="More actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </AppButton>
        {menuOpen ? (
          <div className={cn(SPLIT_BUTTON_MENU_PANEL_CLASS, 'min-w-[10rem]')} role="menu">
            {compactMenuActions.map((action) => (
              <SplitButtonMenuItem
                key={action.id}
                icon={action.loading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : action.icon}
                disabled={action.disabled}
                onClick={() => {
                  action.onClick();
                  setMenuOpen(false);
                }}
              >
                {action.label}
              </SplitButtonMenuItem>
            ))}
          </div>
        ) : null}
      </div>
    </>
  ) : (
    <>
      {nonCreateActions.map((action, index) => (
        <React.Fragment key={action.id}>
          {index > 0 ? <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" /> : null}
          <ToolbarActionButton action={action} />
        </React.Fragment>
      ))}
    </>
  );

  if (!createControl && nonCreateActions.length === 0) {
    return null;
  }

  return (
    <>
      {createControl}
      {createControl && nonCreateActions.length > 0 ? (
        <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
      ) : null}
      {nonCreateChrome}
    </>
  );
};
