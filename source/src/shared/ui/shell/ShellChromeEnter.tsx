import React, { useCallback, useLayoutEffect, useState } from 'react';
import { dismissAppBootSplash } from '../../../components/dismissAppBootSplash';
import { cn } from '../../../lib/utils';
import { ShellFormattedReveal } from './ShellFormattedReveal';
import { ShellRevealProvider } from './ShellRevealContext';

export type ShellChromeEnterProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * First shell surface: loading cover stays until chrome + first page are fully
 * formed, then one reveal. `surfaceReady` lets page enter skip a second cover.
 * `#app-boot-splash` stays up through the whole wait and cover exit so the user
 * never sees a second loading style (atmosphere / embedded) in the last second.
 */
export const ShellChromeEnter: React.FC<ShellChromeEnterProps> = ({
  children,
  className,
  contentClassName,
}) => {
  const [surfaceReady, setSurfaceReady] = useState(false);
  const onReadyChange = useCallback((ready: boolean) => {
    setSurfaceReady(ready);
  }, []);
  const onRevealed = useCallback(() => {
    dismissAppBootSplash();
  }, []);

  useLayoutEffect(() => {
    document.documentElement.removeAttribute('data-app-boot-phase');
  }, []);

  return (
    <ShellRevealProvider surfaceReady={surfaceReady}>
      <div
        className={cn('flex h-full min-h-0 min-w-0 w-full flex-1 flex-col', className)}
        data-shell-chrome-enter="true"
      >
        <ShellFormattedReveal
          resetKey="shell-chrome"
          cover="fullscreen"
          className="h-full w-full overflow-hidden"
          contentClassName={cn('relative h-full w-full overflow-hidden', contentClassName)}
          onReadyChange={onReadyChange}
          onRevealed={onRevealed}
        >
          {children}
        </ShellFormattedReveal>
      </div>
    </ShellRevealProvider>
  );
};
