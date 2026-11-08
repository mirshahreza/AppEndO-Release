import React from 'react';
import { cn } from '../lib/utils';
import { useCultureT } from '../core/culture/CultureContext';
import { isCompactChromeTier } from '../shared/lib/viewportTokens';
import { useViewportTier } from '../shared/lib/useViewportTier';

export const APPENDO_LOGO_SRC = '/assets/appendo-logo.png';
export const APPENDO_LOGO_ONLY_SRC = '/assets/appendo-logo-only.png';

export interface AppEndLogoProps {
  collapsed?: boolean;
  /** Sidebar rail uses a larger expanded logo; other surfaces keep the default size. */
  variant?: 'default' | 'sidebar';
  /**
   * Built-in mark-only asset (`appendo-logo-only.png`).
   * Omit to auto-use the mark on sidebar chrome at tablet and below.
   */
  mark?: boolean;
  className?: string;
  /** Custom logo image URL or data URL. Defaults to the built-in AppEnd logo asset. */
  src?: string;
  alt?: string;
  /** When set, the logo opens this URL instead of the default About action. */
  href?: string;
  onClick?: () => void;
}

/** Intrinsic pixel ratio of `/assets/appendo-logo.png` (852×600). */
const APPENDO_LOGO_ASPECT_RATIO = '852 / 600';
/** Intrinsic pixel ratio of `/assets/appendo-logo-only.png` (852×384). */
const APPENDO_LOGO_ONLY_ASPECT_RATIO = '852 / 384';

const SIDEBAR_LOGO_TRANSITION_CLASS =
  'transition-[height,transform] duration-300 ease-out';

const resolveLogoSrc = (src?: string): string => src?.trim() || APPENDO_LOGO_SRC;

const isBuiltInAppEndLogo = (src?: string): boolean => {
  const resolved = resolveLogoSrc(src);
  return resolved === APPENDO_LOGO_SRC || resolved === APPENDO_LOGO_ONLY_SRC;
};

export function resolveAppEndLogoMark(options: {
  src?: string;
  mark?: boolean;
  variant: NonNullable<AppEndLogoProps['variant']>;
  compactChrome: boolean;
  collapsed?: boolean;
}): boolean {
  if (!isBuiltInAppEndLogo(options.src)) {
    return false;
  }
  if (options.mark === true || resolveLogoSrc(options.src) === APPENDO_LOGO_ONLY_SRC) {
    return true;
  }
  if (options.mark === false) {
    return false;
  }
  return options.variant === 'sidebar' && (options.compactChrome || options.collapsed === true);
}

const logoSizeClassName = (
  collapsed: boolean,
  variant: NonNullable<AppEndLogoProps['variant']>,
  useMark: boolean,
  className?: string,
) =>
  cn(
    'w-auto max-w-full drop-shadow-sm',
    variant === 'sidebar' && SIDEBAR_LOGO_TRANSITION_CLASS,
    collapsed
      ? useMark
        ? 'h-[33px] w-auto max-w-[3rem] shrink-0'
        : 'h-8 w-8 shrink-0 object-contain'
      : variant === 'sidebar'
        ? 'h-[64px]'
        : 'h-[75px]',
    className,
  );

const AppEndLogoImage = ({
  collapsed = false,
  variant = 'default',
  mark = false,
  className,
  src,
  alt,
}: Pick<AppEndLogoProps, 'collapsed' | 'variant' | 'mark' | 'className' | 'src' | 'alt'> & {
  alt: string;
}) => {
  const resolvedSrc = resolveLogoSrc(src);
  const sizeClassName = logoSizeClassName(collapsed, variant, mark, className);

  // Built-in mark: paint with `--app-logo-*` (accent theme). Custom `src` stays as-is.
  if (isBuiltInAppEndLogo(src)) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={cn(
          'appendo-logo-themed inline-block shrink-0',
          mark && 'appendo-logo-themed--mark',
          sizeClassName,
        )}
        style={{
          aspectRatio: mark ? APPENDO_LOGO_ONLY_ASPECT_RATIO : APPENDO_LOGO_ASPECT_RATIO,
        }}
      />
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={cn('object-contain', sizeClassName)}
      draggable={false}
    />
  );
};

export const AppEndLogo = ({
  collapsed = false,
  variant = 'default',
  mark,
  className,
  src,
  alt,
  href,
  onClick,
}: AppEndLogoProps) => {
  const t = useCultureT();
  const compactChrome = isCompactChromeTier(useViewportTier());
  const useMark = resolveAppEndLogoMark({ src, mark, variant, compactChrome, collapsed });
  const resolvedAlt = alt?.trim() || t('shell.logo.alt');

  const image = (
    <AppEndLogoImage
      collapsed={collapsed}
      variant={variant}
      mark={useMark}
      src={src}
      alt={resolvedAlt}
      className={className}
    />
  );

  const trimmedHref = href?.trim();
  if (trimmedHref) {
    return (
      <a
        href={trimmedHref}
        aria-label={resolvedAlt || t('shell.logo.linkAria')}
        className="inline-flex items-center justify-center select-none"
      >
        {image}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={t('shell.logo.aboutAria')}
        className={cn(
          'inline-flex max-w-full items-center justify-center cursor-pointer select-none border-none bg-transparent p-0',
          collapsed && variant === 'sidebar' && 'w-full',
        )}
      >
        {image}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center justify-center select-none">
      {image}
    </span>
  );
};
