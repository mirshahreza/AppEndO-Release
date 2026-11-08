import * as React from 'react';
import { cn } from '../../lib/utils';
import {
  APP_TABLE_GRID_CARD_ACTIONS_CLASS,
  APP_TABLE_GRID_CARD_CLASS,
  LIST_PAGE_CARD_GRID_GAP_CLASS,
  LIST_PAGE_CARD_GRID_GUTTER_CLASS,
  GRID_ACTION_ACCESS_CLASS,
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_DELETE_CLASS,
  ICON_ACTION_DUPLICATE_CLASS,
  ICON_ACTION_EDIT_CLASS,
} from './surfaceClasses';
import { TYPE_CAPTION_CLASS, TYPE_IDENTIFIER_CLASS, TYPE_SECTION_TITLE_CLASS } from './typographyRoles';

/** Dense inventory grid — 5 cols at xl, 6 at 2xl so schema objects stay scannable. */
export const DEVELOPMENT_CATALOG_CARD_GRID_CLASS =
  `grid grid-cols-1 items-stretch ${LIST_PAGE_CARD_GRID_GAP_CLASS} sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6`;

export type DevelopmentCatalogCardGridProps = {
  children: React.ReactNode;
  className?: string;
};

export const DevelopmentCatalogCardGrid: React.FC<DevelopmentCatalogCardGridProps> = ({
  children,
  className,
}) => (
  <div className={cn(DEVELOPMENT_CATALOG_CARD_GRID_CLASS, LIST_PAGE_CARD_GRID_GUTTER_CLASS, className)}>
    {children}
  </div>
);

export type DevelopmentCatalogCardProps = {
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
  isLoading?: boolean;
} & Omit<React.ComponentPropsWithoutRef<'article'>, 'children' | 'className'>;

export const DevelopmentCatalogCard: React.FC<DevelopmentCatalogCardProps> = ({
  children,
  className,
  isActive = false,
  isLoading = false,
  ...articleProps
}) => (
  <article
    {...articleProps}
    className={cn(
      APP_TABLE_GRID_CARD_CLASS,
      'group flex h-full min-w-0 flex-col',
      isActive && 'border-primary-500/35 bg-primary-subtle/25 shadow-md shadow-primary-500/20',
      isLoading && 'opacity-70',
      className,
    )}
  >
    {children}
  </article>
);

export type DevelopmentCatalogCardTitleTone = 'label' | 'identifier';

export type DevelopmentCatalogCardHeaderProps = {
  title: string;
  /** `identifier` for table/function/slug names; `label` for human titles. */
  titleTone?: DevelopmentCatalogCardTitleTone;
  onTitleClick?: () => void;
  titleAction?: React.ReactNode;
  /** Optional always-visible markers on the title row end. Type badges belong in the footer. */
  trailing?: React.ReactNode;
};

const catalogCardTitleClass = (titleTone: DevelopmentCatalogCardTitleTone) =>
  cn(
    'min-w-0 flex-1 truncate text-start leading-snug text-slate-900',
    titleTone === 'identifier' ? TYPE_IDENTIFIER_CLASS : TYPE_SECTION_TITLE_CLASS,
  );

export const DevelopmentCatalogCardHeader: React.FC<DevelopmentCatalogCardHeaderProps> = ({
  title,
  titleTone = 'label',
  onTitleClick,
  titleAction,
  trailing,
}) => (
  <div className="flex min-w-0 items-center justify-between gap-1">
    {onTitleClick ? (
      <button
        type="button"
        className={cn(catalogCardTitleClass(titleTone), 'hover:text-primary-700')}
        title={title}
        onClick={onTitleClick}
      >
        {title}
      </button>
    ) : (
      <span className={catalogCardTitleClass(titleTone)} title={title}>
        {title}
      </span>
    )}
    {titleAction || trailing ? (
      <div className="flex shrink-0 items-center gap-1">
        {titleAction ? (
          <div className="pointer-events-none flex shrink-0 items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            {titleAction}
          </div>
        ) : null}
        {trailing}
      </div>
    ) : null}
  </div>
);

export type DevelopmentCatalogCardBadgeProps = {
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<'span'>, 'children' | 'className'>;

export const DevelopmentCatalogCardBadge: React.FC<DevelopmentCatalogCardBadgeProps> = ({
  children,
  className,
  ...spanProps
}) => (
  <span
    {...spanProps}
    className={cn(
      'inline-flex h-5 shrink-0 items-center justify-center rounded px-1.5 text-[10px] font-bold uppercase tracking-wide border leading-none',
      className,
    )}
  >
    {children}
  </span>
);

export type DevelopmentCatalogCardPathProps = {
  children: React.ReactNode;
};

export const DevelopmentCatalogCardPath: React.FC<DevelopmentCatalogCardPathProps> = ({ children }) => (
  <p className="mt-0.5 truncate font-mono text-xs leading-snug text-slate-600" title={typeof children === 'string' ? children : undefined}>
    {children}
  </p>
);

export type DevelopmentCatalogCardFooterProps = {
  date: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
};

export const DevelopmentCatalogCardFooter: React.FC<DevelopmentCatalogCardFooterProps> = ({
  date,
  badge,
  children,
}) => (
  <div className={cn(APP_TABLE_GRID_CARD_ACTIONS_CLASS, 'justify-between')}>
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className={cn('min-w-0 truncate leading-none text-slate-600', TYPE_CAPTION_CLASS)} title={date}>
        {date}
      </span>
      {badge ? (
        <span className="inline-flex h-5 min-w-[4.5rem] shrink-0 items-center justify-start">
          {badge}
        </span>
      ) : null}
    </div>
    {children ? (
      <div className="pointer-events-none flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        {children}
      </div>
    ) : null}
  </div>
);

export type DevelopmentCatalogIconActionProps = {
  'aria-label': string;
  title?: string;
  disabled?: boolean;
  intent: 'duplicate' | 'delete' | 'access' | 'settings';
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
};

export const DevelopmentCatalogIconAction: React.FC<DevelopmentCatalogIconActionProps> = ({
  'aria-label': ariaLabel,
  title,
  disabled = false,
  intent,
  onClick,
  children,
}) => (
  <button
    type="button"
    className={cn(
      ICON_ACTION_BUTTON_SM_CLASS,
      intent === 'delete'
        ? ICON_ACTION_DELETE_CLASS
        : intent === 'access'
          ? GRID_ACTION_ACCESS_CLASS
          : intent === 'settings'
            ? ICON_ACTION_EDIT_CLASS
            : ICON_ACTION_DUPLICATE_CLASS,
    )}
    aria-label={ariaLabel}
    title={title ?? ariaLabel}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);
