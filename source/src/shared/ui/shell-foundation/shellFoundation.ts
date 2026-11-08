import * as React from 'react';
import { cn } from '../../../lib/utils';

export type ShellDirection = 'ltr' | 'rtl';
export type ShellViewportTier = 'desktop' | 'tablet' | 'phone';
export type ShellLogicalSide = 'start' | 'end';
export type ShellVisibility = Partial<Record<ShellViewportTier, boolean>>;
export type ShellRegionWidth = 'full' | 'contained' | 'inset';
export type ShellRegionPlacement = 'start' | 'center' | 'end' | 'space-between';
export type ShellSpacing = 'none' | 'xs' | 'sm' | 'md' | 'lg';
export type ShellSeparator = 'none' | 'hairline' | 'surface-shift' | 'shadow';
export type ShellSafeArea = 'none' | 'inline' | 'block-start' | 'all';

export type ShellElementProps<T extends HTMLElement = HTMLElement> = {
  children?: React.ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  ref?: React.Ref<T>;
};

export const spacingClass = {
  none: '',
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
} satisfies Record<ShellSpacing, string>;

export const gapClass = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
} satisfies Record<ShellSpacing, string>;

export const visibilityClass = (visibility?: ShellVisibility) => cn(
  visibility?.phone === false && 'max-md:hidden',
  visibility?.tablet === false && 'md:max-lg:hidden',
  visibility?.desktop === false && 'lg:hidden',
);

export const safeAreaClass = {
  none: '',
  inline: 'ps-[env(safe-area-inset-left)] pe-[env(safe-area-inset-right)]',
  'block-start': 'pt-[env(safe-area-inset-top)]',
  all: 'pt-[env(safe-area-inset-top)] pe-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] ps-[env(safe-area-inset-left)]',
} satisfies Record<ShellSafeArea, string>;

export const widthClass = {
  full: 'w-full',
  contained: 'mx-auto w-full max-w-7xl',
  inset: 'mx-auto w-[calc(100%-2rem)] max-w-7xl',
} satisfies Record<ShellRegionWidth, string>;

export const placementClass = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  'space-between': 'justify-between',
} satisfies Record<ShellRegionPlacement, string>;

export const separatorClass = {
  none: '',
  hairline: 'border-b border-divider',
  'surface-shift': 'bg-content2',
  shadow: 'shadow-sm',
} satisfies Record<ShellSeparator, string>;

export const getFocusableElements = (root: HTMLElement | null) => {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
};
