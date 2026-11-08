import type { ReactNode } from 'react';

/** Same loading/error chrome as published `hwy-members-all` (member directory list). */
export const HWY_LIST_PAGE_GRID_LOADING_KEY = 'hwy.members.loading';
export const HWY_LIST_PAGE_GRID_LOADING_FALLBACK = 'Loading members…';
export const HWY_LIST_PAGE_GRID_ERROR_KEY = 'hwy.members.error';
export const HWY_LIST_PAGE_GRID_ERROR_FALLBACK = 'Could not load members.';

type HwyListPageGridT = (key: string, fallback?: string) => string;

export const resolveHwyListPageGridLoadingMessage = (t: HwyListPageGridT): string => (
  t(HWY_LIST_PAGE_GRID_LOADING_KEY, HWY_LIST_PAGE_GRID_LOADING_FALLBACK)
);

export const resolveHwyListPageGridErrorContent = (
  error: unknown,
  t: HwyListPageGridT,
): ReactNode | undefined => {
  if (!error) {
    return undefined;
  }
  return t(HWY_LIST_PAGE_GRID_ERROR_KEY, HWY_LIST_PAGE_GRID_ERROR_FALLBACK);
};

export const resolveHwyListPageGridIsEmpty = (
  isLoading: boolean,
  error: unknown,
  rowCount: number,
): boolean => !isLoading && !error && rowCount === 0;

export const resolveHwyListPageGridQueryChrome = (input: {
  isLoading: boolean;
  error: unknown;
  rowCount: number;
  t: HwyListPageGridT;
}) => ({
  isLoading: input.isLoading,
  loadingMessage: resolveHwyListPageGridLoadingMessage(input.t),
  errorContent: resolveHwyListPageGridErrorContent(input.error, input.t),
  isEmpty: resolveHwyListPageGridIsEmpty(input.isLoading, input.error, input.rowCount),
});
