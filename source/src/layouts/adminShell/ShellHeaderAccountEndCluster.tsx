import React from 'react';
import { Maximize, Minimize2 } from 'lucide-react';
import { HeaderHintTooltip } from '../../shared/ui/SideHintTooltip';
import { pageGuideChromeProps } from '../../shared/ui/shell/pageGuide/pageGuideChrome';
import {
  ADMIN_SHELL_HEADER_VERTICAL_SEPARATOR_CLASS,
  ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS,
} from '../../shared/ui/surfaceClasses';

export type ShellHeaderAccountEndClusterProps = {
  onProfileOpen: () => void;
  displayName: string;
  avatarXs?: string | null;
  avatarInitial: string;
  primaryRole: string;
  tShell: (key: string) => string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
};

export const ShellHeaderAccountEndCluster: React.FC<ShellHeaderAccountEndClusterProps> = ({
  onProfileOpen,
  displayName,
  avatarXs,
  avatarInitial,
  primaryRole,
  tShell,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const fullscreenTitle = isFullscreen
    ? tShell('shell.exitFullscreen')
    : tShell('shell.enterFullscreen');

  return (
    <div
      className="flex shrink-0 items-center gap-1"
      data-shell-header-account-end=""
    >
      <HeaderHintTooltip
        title={fullscreenTitle}
        hint={tShell('pageGuide.chrome.fullscreen.hint')}
        tone="violet"
        className="inline-flex shrink-0"
      >
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={fullscreenTitle}
          className={ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS}
          {...pageGuideChromeProps(tShell, 'fullscreen', 20)}
        >
          {isFullscreen ? (
            <Minimize2 className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <Maximize className="h-[18px] w-[18px]" aria-hidden />
          )}
        </button>
      </HeaderHintTooltip>

      <span
        role="separator"
        aria-orientation="vertical"
        className={ADMIN_SHELL_HEADER_VERTICAL_SEPARATOR_CLASS}
      />

      <HeaderHintTooltip
        title={tShell('pageGuide.chrome.account.title')}
        hint={tShell('pageGuide.chrome.account.hint')}
        tone="emerald"
      >
        <button
          type="button"
          onClick={onProfileOpen}
          className="group flex shrink-0 items-center gap-2 rounded-xl border border-transparent py-1.5 px-1.5 text-start transition-all duration-300 select-none hover:border-primary-500/10 hover:bg-primary-500/5 hover:shadow-xs rtl:flex-row-reverse"
          aria-label={tShell('shell.openAccount')}
          {...pageGuideChromeProps(tShell, 'account', 16)}
        >
          <div className="hidden flex-col text-end xl:flex">
            <span className="text-[13px] font-semibold text-primary-700 transition-colors group-hover:text-primary-700">
              {displayName}
            </span>
            <span className="text-[11px] leading-none font-medium text-slate-400 transition-colors group-hover:text-slate-500">
              {primaryRole}
            </span>
          </div>
          <div className="relative shrink-0">
            <div className="relative flex h-[36px] w-[36px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-sm ring-0 ring-primary-500/0 transition-all duration-300 group-hover:scale-105 group-hover:border-primary-500/30 group-hover:ring-3 group-hover:ring-primary-500/15">
              {avatarXs ? (
                <img src={avatarXs} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-slate-500">{avatarInitial}</span>
              )}
            </div>
          </div>
        </button>
      </HeaderHintTooltip>
    </div>
  );
};
