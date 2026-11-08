import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppButton } from '../shared/ui/AppButton';
import { cn } from '../lib/utils';
import { useCultureT } from '../core/culture/CultureContext';
import { errorsKey } from '../core/culture/translations/cultureKeyHelpers';

export type RouteNotFoundPageProps = {
  /** Full viewport (top-level unknown routes) vs shell content area. */
  variant?: 'fullscreen' | 'embedded';
  homeTo?: string;
  homeLabel?: string;
};

export const RouteNotFoundPage: React.FC<RouteNotFoundPageProps> = ({
  variant = 'fullscreen',
  homeTo = '/',
  homeLabel,
}) => {
  const t = useCultureT();
  const { pathname } = useLocation();
  const isFullscreen = variant === 'fullscreen';
  const resolvedHomeLabel = homeLabel ?? t(errorsKey('routeNotFound.goHome'));

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center bg-white px-6 text-center',
        isFullscreen ? 'min-h-screen' : 'min-h-[min(480px,70vh)]',
      )}
      data-testid="route-not-found-page"
      role="main"
      aria-labelledby="route-not-found-title"
    >
      <p
        className="select-none text-[clamp(5rem,18vw,7.5rem)] font-extralight leading-none tracking-tight text-slate-100"
        aria-hidden
      >
        404
      </p>

      <div className="-mt-10 flex max-w-md flex-col items-center gap-3">
        <h1 id="route-not-found-title" className="text-lg font-medium text-slate-900">
          {t(errorsKey('routeNotFound.title'))}
        </h1>
        <p className="text-sm leading-relaxed text-slate-500">
          {t(errorsKey('routeNotFound.message'))}
        </p>
        <code className="mt-1 max-w-full truncate rounded-md bg-slate-50 px-2.5 py-1 text-xs text-slate-400">
          {pathname}
        </code>
        <Link to={homeTo} className="mt-4">
          <AppButton intent="secondary" size="md">
            {resolvedHomeLabel}
          </AppButton>
        </Link>
      </div>
    </div>
  );
};
