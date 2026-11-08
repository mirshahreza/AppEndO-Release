import * as React from 'react';

export type DesignerVizDataStateProps = {
  isLoading?: boolean;
  loadingMessage?: string;
  hasError?: boolean;
  errorContent?: string;
  isEmpty?: boolean;
  emptyContent?: string;
  children: React.ReactNode;
  loadingClassName?: string;
  emptyClassName?: string;
  errorClassName?: string;
};

const DEFAULT_LOADING_CLASS =
  'flex h-24 items-center justify-center text-xs text-slate-500';

const DEFAULT_EMPTY_CLASS =
  'rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-500';

const DEFAULT_ERROR_CLASS =
  'rounded-md border border-dashed border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700';

export const renderDesignerVizDataState = ({
  isLoading,
  loadingMessage,
  hasError,
  errorContent,
  isEmpty,
  emptyContent,
  children,
  loadingClassName = DEFAULT_LOADING_CLASS,
  emptyClassName = DEFAULT_EMPTY_CLASS,
  errorClassName = DEFAULT_ERROR_CLASS,
}: DesignerVizDataStateProps): React.ReactNode => {
  if (isLoading && loadingMessage && loadingMessage.trim().length > 0) {
    return <div className={loadingClassName}>{loadingMessage}</div>;
  }

  if (hasError && errorContent && errorContent.trim().length > 0) {
    return <div className={errorClassName}>{errorContent}</div>;
  }

  if (isEmpty && emptyContent && emptyContent.trim().length > 0) {
    return <div className={emptyClassName}>{emptyContent}</div>;
  }

  return children;
};

export const DEFAULT_TREE_EMPTY_MESSAGE = 'No data — check the connected field mapping.';
