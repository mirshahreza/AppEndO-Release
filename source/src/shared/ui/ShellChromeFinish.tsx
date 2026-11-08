import React from 'react';
import { cn } from '../../lib/utils';

export type ShellChromeFinishSurface = 'sidebar' | 'header';

export type ShellChromeFinishProps = {
  surface: ShellChromeFinishSurface;
};

/** Optional frost + line texture layers for shell chrome. Intensity comes from Theme Designer tokens. */
export const ShellChromeFinish: React.FC<ShellChromeFinishProps> = ({ surface }) => (
  <div className="admin-shell-chrome-finish" aria-hidden>
    <div
      className={cn(
        'admin-shell-chrome-fill',
        surface === 'sidebar' ? 'admin-shell-chrome-fill--sidebar' : 'admin-shell-chrome-fill--header',
      )}
    />
    <div
      className={cn(
        'admin-shell-chrome-texture',
        surface === 'sidebar' ? 'menu-line-pattern' : 'header-line-pattern',
      )}
    />
  </div>
);
