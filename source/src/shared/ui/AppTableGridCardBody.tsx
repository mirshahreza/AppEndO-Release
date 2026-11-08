import React, { memo, useLayoutEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../../lib/utils';
import {
  partitionCardFields,
  sanitizeVisibleFieldCount,
} from '../lib/gridCompactViewport';
import {
  partitionStandardCardLayout,
  type ResolvedCardColumn,
  type ResolvedCardLayout,
} from '../lib/appTableGridCardLayout';
import {
  GRID_CARD_ROW_ESTIMATE_PX,
  GRID_VIRTUALIZE_ROW_THRESHOLD,
  GRID_VIRTUAL_OVERSCAN,
} from '../lib/gridVirtualizationConstants';
import {
  APP_TABLE_GRID_CARD_FIELD_LABEL_CLASS,
  APP_TABLE_GRID_CARD_FIELD_ROW_CLASS,
  APP_TABLE_GRID_CARD_FIELD_VALUE_CLASS,
  APP_TABLE_GRID_CARD_SHELL_CLASS,
  LIST_PAGE_CARD_GRID_GAP_PX,
  LIST_PAGE_CARD_GRID_INSET_CLASS,
  appTableGridCardListClass,
} from './surfaceClasses';
import type { GridRowActionItem } from './AppGridRowActions';
import {
  AppTableGridCardFooterActions,
} from './AppTableGridCardFooterActions';
import {
  type GridCompactCardsPerRow,
  type ResolvedGridCompactViewport,
} from '../lib/gridCompactViewport';
import { DEFAULT_GRID_MAX_VISIBLE_ACTIONS } from '../lib/gridRowActions';
import { AppButton } from './AppButton';

export type AppTableGridCardChrome = Pick<
  ResolvedGridCompactViewport,
  'collapseExtraFields' | 'visibleFieldCount' | 'showActions' | 'showMeta'
> & {
  cardsPerRow?: GridCompactCardsPerRow;
};

export const DEFAULT_APP_TABLE_GRID_CARD_CHROME: AppTableGridCardChrome = {
  cardsPerRow: 1,
  collapseExtraFields: false,
  visibleFieldCount: 3,
  showActions: true,
  showMeta: true,
};

const DEFAULT_CARD_CHROME: AppTableGridCardChrome = DEFAULT_APP_TABLE_GRID_CARD_CHROME;

type AppTableGridCardBodyProps<TRow> = {
  layout: ResolvedCardLayout<TRow>;
  rows: ReadonlyArray<TRow>;
  getRowKey: (row: TRow) => string | number;
  size?: 'xs' | 'sm';
  scrollRef: React.RefObject<HTMLDivElement | null>;
  chrome?: AppTableGridCardChrome;
  /** Overrides tier `cardsPerRow` grid classes (e.g. responsive member card grid). */
  cardListHostClassName?: string;
  getCardRowActions?: (row: TRow) => readonly GridRowActionItem[];
  cardActionsMaxVisible?: number;
};

const IMAGE_CARD_MEDIA_CHROME_CLASS =
  '[&_img]:h-full [&_img]:w-full [&_img]:object-cover [&_span]:!mx-0 [&_span]:!flex [&_span]:!h-full [&_span]:!w-full [&_span]:!max-w-none [&_span]:!items-stretch [&_span]:!justify-stretch';

const IMAGE_CARD_MEDIA_SOLO_CLASS = cn(
  'mx-auto h-28 w-28 overflow-hidden rounded-md bg-slate-100 sm:h-32 sm:w-32',
  IMAGE_CARD_MEDIA_CHROME_CLASS,
);

const IMAGE_CARD_MEDIA_SIDE_CLASS = cn(
  'h-full min-h-[4.5rem] w-[5.5rem] shrink-0 self-stretch overflow-hidden rounded-md bg-slate-100 sm:w-24',
  IMAGE_CARD_MEDIA_CHROME_CLASS,
);

function fieldLabelText(label: React.ReactNode): string | undefined {
  return typeof label === 'string' && label.trim() ? label : undefined;
}

function shouldShowCardFieldLabel<TRow>(
  entry: ResolvedCardColumn<TRow>,
): boolean {
  if (entry.role === 'media') {
    return false;
  }
  if (typeof entry.label === 'string') {
    return entry.label.trim().length > 0;
  }
  return Boolean(entry.label);
}

function renderCardMedia<TRow>(
  media: ResolvedCardColumn<TRow>,
  row: TRow,
  solo: boolean,
) {
  return (
    <div
      className={solo ? IMAGE_CARD_MEDIA_SOLO_CLASS : IMAGE_CARD_MEDIA_SIDE_CLASS}
      style={media.column.getCellStyle?.(row)}
    >
      {media.column.renderCell(row)}
    </div>
  );
}

function renderPrimaryField<TRow>(
  entry: ResolvedCardColumn<TRow>,
  row: TRow,
  options?: { prominent?: boolean },
) {
  return (
    <div
      key={entry.column.id}
      className={cn(
        'min-w-0 truncate',
        options?.prominent
          ? 'font-medium text-slate-800'
          : entry.role === 'subtitle'
            ? 'text-xs text-slate-600'
            : 'text-slate-700',
        entry.column.cellClassName,
        entry.column.getCellClassName?.(row),
      )}
      style={entry.column.getCellStyle?.(row)}
      aria-label={fieldLabelText(entry.label)}
    >
      {entry.column.renderCell(row)}
    </div>
  );
}

function renderLabeledField<TRow>(
  entry: ResolvedCardColumn<TRow>,
  row: TRow,
) {
  const showLabel = shouldShowCardFieldLabel(entry);
  return (
    <div
      key={entry.column.id}
      className={cn(APP_TABLE_GRID_CARD_FIELD_ROW_CLASS, 'py-0.5 first:pt-0 last:pb-0')}
    >
      {showLabel ? (
        <span className={APP_TABLE_GRID_CARD_FIELD_LABEL_CLASS}>
          {entry.label}
          :
        </span>
      ) : null}
      <div
        className={cn(
          APP_TABLE_GRID_CARD_FIELD_VALUE_CLASS,
          'truncate',
          entry.column.cellClassName,
          entry.column.getCellClassName?.(row),
        )}
        style={entry.column.getCellStyle?.(row)}
        aria-label={showLabel ? undefined : fieldLabelText(entry.label)}
      >
        {entry.column.renderCell(row)}
      </div>
    </div>
  );
}

type AppTableGridCardItemProps<TRow> = {
  layout: ResolvedCardLayout<TRow>;
  row: TRow;
  textSizeClass: string;
  chrome: AppTableGridCardChrome;
  getCardRowActions?: (row: TRow) => readonly GridRowActionItem[];
  cardActionsMaxVisible: number;
  /** Avatar + title row alignment when a media column is present. Default `stretch`. */
  primaryRowAlign?: 'center' | 'stretch';
};

function AppTableGridCardItemInner<TRow>({
  layout,
  row,
  textSizeClass,
  chrome,
  getCardRowActions,
  cardActionsMaxVisible,
  primaryRowAlign = 'stretch',
}: AppTableGridCardItemProps<TRow>) {
  const [labeledExpanded, setLabeledExpanded] = useState(false);
  const partition = partitionStandardCardLayout(layout);
  const primaryFields = partition.primaryFields;
  const labeledFieldsAll = chrome.showMeta === false
    ? partition.labeledFields.filter((entry) => entry.role !== 'meta')
    : partition.labeledFields;
  const visibleFieldCount = sanitizeVisibleFieldCount(chrome.visibleFieldCount);
  const shouldCollapseLabeled = chrome.collapseExtraFields === true && !labeledExpanded;
  const labeledPartition = partitionCardFields(
    labeledFieldsAll,
    shouldCollapseLabeled,
    visibleFieldCount,
  );
  const labeledFields = shouldCollapseLabeled
    ? labeledPartition.visible
    : labeledFieldsAll;
  const hiddenLabeledCount = shouldCollapseLabeled ? labeledPartition.extra.length : 0;
  const media = partition.media;
  const hasPrimaryRow = Boolean(media) || primaryFields.length > 0;
  const mediaSolo = Boolean(media) && primaryFields.length === 0;
  const actions = chrome.showActions === false
    ? []
    : (getCardRowActions?.(row) ?? []);

  return (
    <article className={cn(APP_TABLE_GRID_CARD_SHELL_CLASS, textSizeClass)}>
      {hasPrimaryRow ? (
        <div className={cn(
          'flex min-h-0 flex-1',
          mediaSolo ? 'items-center justify-center' : 'gap-3',
          media && !mediaSolo ? 'flex-row' : 'flex-col',
          mediaSolo ? null : (primaryRowAlign === 'center' ? 'items-center' : 'items-stretch'),
        )}>
          {media ? renderCardMedia(media, row, mediaSolo) : null}
          {primaryFields.length > 0 ? (
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              {primaryFields.map((entry, index) => renderPrimaryField(
                entry,
                row,
                { prominent: index === 0 },
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {labeledFields.length > 0 ? (
        <div className={cn(
          'flex flex-col gap-1',
          hasPrimaryRow ? 'mt-1 border-t border-slate-100 pt-1' : 'flex-1',
        )}>
          {labeledFields.map((entry) => renderLabeledField(entry, row))}
          {hiddenLabeledCount > 0 ? (
            <div className="pt-1.5">
              <AppButton
                type="button"
                size="sm"
                intent="utility"
                className="h-7 px-2 text-xs text-slate-600"
                onClick={() => setLabeledExpanded(true)}
                aria-label={`Show ${hiddenLabeledCount} more fields`}
              >
                More ({hiddenLabeledCount})
              </AppButton>
            </div>
          ) : null}
          {labeledExpanded && chrome.collapseExtraFields ? (
            <div className="pt-1.5">
              <AppButton
                type="button"
                size="sm"
                intent="utility"
                className="h-7 px-2 text-xs text-slate-600"
                onClick={() => setLabeledExpanded(false)}
                aria-label="Show fewer fields"
              >
                Less
              </AppButton>
            </div>
          ) : null}
        </div>
      ) : null}

      {actions.length > 0 ? (
        <AppTableGridCardFooterActions
          actions={actions}
          maxVisible={cardActionsMaxVisible}
        />
      ) : null}
    </article>
  );
}

export const AppTableGridCardItem = memo(AppTableGridCardItemInner) as typeof AppTableGridCardItemInner;

function AppTableGridCardList<TRow>({
  layout,
  rows,
  getRowKey,
  textSizeClass,
  chrome,
  getCardRowActions,
  cardActionsMaxVisible,
}: Omit<AppTableGridCardBodyProps<TRow>, 'scrollRef' | 'size'> & {
  textSizeClass: string;
}) {
  return (
    <>
      {rows.map((row) => {
        const rowKey = getRowKey(row);
        return (
          <div key={rowKey} className="h-full min-h-0">
            <AppTableGridCardItem
              layout={layout}
              row={row}
              textSizeClass={textSizeClass}
              chrome={chrome ?? DEFAULT_CARD_CHROME}
              getCardRowActions={getCardRowActions}
              cardActionsMaxVisible={cardActionsMaxVisible}
            />
          </div>
        );
      })}
    </>
  );
}

function AppTableGridVirtualCardList<TRow>({
  scrollRef,
  layout,
  rows,
  getRowKey,
  textSizeClass,
  chrome,
  getCardRowActions,
  cardActionsMaxVisible,
}: AppTableGridCardBodyProps<TRow> & {
  textSizeClass: string;
}) {
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => GRID_CARD_ROW_ESTIMATE_PX,
    overscan: GRID_VIRTUAL_OVERSCAN,
    gap: LIST_PAGE_CARD_GRID_GAP_PX,
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  useLayoutEffect(() => {
    rowVirtualizer.measure();
  }, [layout, rows, rowVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className={LIST_PAGE_CARD_GRID_INSET_CLASS}>
      <div
        className="relative w-full min-w-0"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        const rowKey = getRowKey(row);
        return (
          <div
            key={rowKey}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <AppTableGridCardItem
              layout={layout}
              row={row}
              textSizeClass={textSizeClass}
              chrome={chrome ?? DEFAULT_CARD_CHROME}
              getCardRowActions={getCardRowActions}
              cardActionsMaxVisible={cardActionsMaxVisible}
            />
          </div>
        );
      })}
      </div>
    </div>
  );
}

export function AppTableGridCardBody<TRow>({
  layout,
  rows,
  getRowKey,
  size = 'xs',
  scrollRef,
  chrome: chromeProp,
  cardListHostClassName,
  getCardRowActions,
  cardActionsMaxVisible = DEFAULT_GRID_MAX_VISIBLE_ACTIONS,
}: AppTableGridCardBodyProps<TRow>) {
  const chrome = chromeProp ?? DEFAULT_CARD_CHROME;
  const cardsPerRow = chrome.cardsPerRow ?? 1;
  const textSizeClass = size === 'xs' ? 'text-xs' : 'text-sm';
  const shouldVirtualize = !cardListHostClassName
    && cardsPerRow <= 1
    && rows.length >= GRID_VIRTUALIZE_ROW_THRESHOLD;
  const listHostClassName = cardListHostClassName ?? appTableGridCardListClass(cardsPerRow);

  const sharedProps = {
    layout,
    rows,
    getRowKey,
    textSizeClass,
    chrome,
    getCardRowActions,
    cardActionsMaxVisible,
  };

  if (shouldVirtualize) {
    return (
      <AppTableGridVirtualCardList
        scrollRef={scrollRef}
        size={size}
        {...sharedProps}
      />
    );
  }

  return (
    <div className={listHostClassName}>
      <AppTableGridCardList {...sharedProps} />
    </div>
  );
}
