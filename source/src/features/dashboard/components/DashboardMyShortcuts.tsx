import React, { useState } from 'react';
import { Bookmark, Plus, X } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { useDashboardLayout } from '../../../contexts/DashboardLayoutContext';
import { cn } from '../../../lib/utils';
import { type DashboardHomeShortcut } from '../../../shared/lib/dashboardHomeShortcuts';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { showAppFeedbackToast } from '../../../shared/ui/appFeedbackToast';
import { NativeButton } from '../../../shared/ui/NativeButton';
import {
  DASHBOARD_BODY_PAD_STRIP_CLASS,
  DASHBOARD_CAPTION_ACTION_GLYPH_CLASS,
  DASHBOARD_HEADER_ICON_CLASS,
  dashboardFitCaptionGridClass,
} from '../dashboardDensity';
import {
  prepareDashboardHomeShortcutDrop,
  takeDashboardHomeShortcutDrop,
} from '../dashboardHomeShortcutDrop';
import { DashboardAddShortcutModal } from './DashboardAddShortcutModal';
import { DashboardFitAction } from './DashboardFitAction';
import { useDashboardWidgetFit } from './DashboardWidgetFitContext';
import { DashboardWidgetShell } from './DashboardWidgetShell';

export const DashboardMyShortcuts: React.FC = () => {
  const t = useCultureT();
  const fit = useDashboardWidgetFit();
  const { homeShortcuts, addHomeShortcut, removeHomeShortcut } = useDashboardLayout();
  const [isAdding, setIsAdding] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);

  const handleAdd = (shortcut: DashboardHomeShortcut) => {
    const added = addHomeShortcut(shortcut);
    showAppFeedbackToast(
      added ? t('dashboard.myShortcuts.added') : t('dashboard.myShortcuts.alreadyPinned'),
      { type: added ? 'success' : 'info' },
    );
    return added;
  };

  return (
    <DashboardWidgetShell
      title={t('dashboard.myShortcuts.title')}
      headerIcon={<Bookmark className={DASHBOARD_HEADER_ICON_CLASS} />}
      headerExtra={(
        <NativeButton
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold text-primary-700 hover:bg-slate-100"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('dashboard.myShortcuts.addLink')}
        </NativeButton>
      )}
      bodyClassName={DASHBOARD_BODY_PAD_STRIP_CLASS}
    >
      <div
        className={cn(
          'rounded-lg transition-colors',
          isDropActive && 'bg-primary-50/80 ring-2 ring-primary-400/40',
        )}
        onDragEnter={(event) => {
          if (prepareDashboardHomeShortcutDrop(event)) {
            setIsDropActive(true);
          }
        }}
        onDragOver={(event) => {
          if (prepareDashboardHomeShortcutDrop(event)) {
            setIsDropActive(true);
          }
        }}
        onDragLeave={() => setIsDropActive(false)}
        onDrop={(event) => {
          event.stopPropagation();
          setIsDropActive(false);
          const shortcut = takeDashboardHomeShortcutDrop(event);
          if (!shortcut) {
            return;
          }
          const added = addHomeShortcut(shortcut);
          showAppFeedbackToast(
            added ? t('dashboard.myShortcuts.pinned') : t('dashboard.myShortcuts.alreadyPinned'),
            { type: added ? 'success' : 'info' },
          );
        }}
      >
        {homeShortcuts.length === 0 ? (
          <p className="px-1 py-3 text-center text-xs text-slate-500">
            {t('dashboard.myShortcuts.empty')}
          </p>
        ) : (
          <div className={dashboardFitCaptionGridClass(fit.iconColumns)}>
            {homeShortcuts.map((shortcut) => (
              <ShortcutCard
                key={shortcut.id}
                shortcut={shortcut}
                onRemove={() => removeHomeShortcut(shortcut.id)}
              />
            ))}
          </div>
        )}
      </div>
      <DashboardAddShortcutModal
        open={isAdding}
        onClose={() => setIsAdding(false)}
        onAdd={handleAdd}
      />
    </DashboardWidgetShell>
  );
};

const ShortcutCard: React.FC<{
  shortcut: DashboardHomeShortcut;
  onRemove: () => void;
}> = ({ shortcut, onRemove }) => {
  const t = useCultureT();
  const isInternal = shortcut.path.startsWith('/');
  const icon = shortcut.icon ? (
    <NavigationIcon iconRef={shortcut.icon} className={DASHBOARD_CAPTION_ACTION_GLYPH_CLASS} />
  ) : (
    <Bookmark className={DASHBOARD_CAPTION_ACTION_GLYPH_CLASS} />
  );

  return (
    <div className="group/shortcut relative min-w-0">
      <DashboardFitAction
        layout="caption"
        iconOnly
        icon={icon}
        label={shortcut.label}
        description={shortcut.path}
        hintTone="violet"
        to={isInternal ? shortcut.path : undefined}
        href={isInternal ? undefined : shortcut.path}
      />
      <NativeButton
        type="button"
        className="absolute end-0 top-0 z-10 inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-700 group-hover/shortcut:opacity-100"
        aria-label={t('dashboard.myShortcuts.remove')}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRemove();
        }}
      >
        <X className="h-3 w-3" />
      </NativeButton>
    </div>
  );
};
