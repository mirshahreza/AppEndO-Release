import { describe, expect, it } from 'vitest';
import { APP_TABLE_GRID_STANDARD_CARD_VARIANT } from '../appTableGridCardView';
import {
  DEFAULT_GRID_MAX_VISIBLE_ACTIONS,
  gridActionsColumnWidth,
  gridActionsColumnWidthForOverlayLastColumn,
  isColumnHiddenAtViewport,
  resolveCardActionsChrome,
  resolveGridActionSlotCount,
  orderCardFooterGridRowActions,
  resolveGridCardActionsMaxVisible,
  splitGridRowActions,
} from '../gridRowActions';

describe('orderCardFooterGridRowActions', () => {
  it('promotes cardLabeled to the first enabled action when the primary is disabled', () => {
    const ordered = orderCardFooterGridRowActions([
      { id: 'edit', cardLabeled: true, disabled: true },
      { id: 'history', disabled: false },
      { id: 'delete', disabled: false },
    ]);
    expect(ordered[0]).toMatchObject({ id: 'history', cardLabeled: true });
    expect(ordered.find((a) => a.id === 'edit')?.cardLabeled).toBe(false);
  });

  it('keeps cardLabeled on the primary when it is enabled', () => {
    const ordered = orderCardFooterGridRowActions([
      { id: 'edit', cardLabeled: true, disabled: false },
      { id: 'history', disabled: false },
    ]);
    expect(ordered[0]).toMatchObject({ id: 'edit', cardLabeled: true });
  });
});

describe('splitGridRowActions', () => {
  it('keeps all actions inline when they fit', () => {
    expect(splitGridRowActions(['a', 'b', 'c'], 3)).toEqual({
      inline: ['a', 'b', 'c'],
      overflow: [],
    });
  });

  it('reserves one slot for overflow when actions exceed the budget', () => {
    expect(splitGridRowActions(['a', 'b', 'c', 'd', 'e'], 3)).toEqual({
      inline: ['a', 'b'],
      overflow: ['c', 'd', 'e'],
    });
  });

  it('keeps one inline action when maxVisible is 1 and overflow is needed', () => {
    expect(splitGridRowActions(['a', 'b', 'c'], 1)).toEqual({
      inline: ['a'],
      overflow: ['b', 'c'],
    });
  });

  it('defaults to three visible slots', () => {
    expect(splitGridRowActions(['a', 'b', 'c', 'd']).inline).toHaveLength(DEFAULT_GRID_MAX_VISIBLE_ACTIONS - 1);
  });
});

describe('gridActionsColumnWidth', () => {
  it('matches the 20px-per-tool plus 7px-gap formula', () => {
    expect(gridActionsColumnWidth(1)).toBe(30);
    expect(gridActionsColumnWidth(3)).toBe(84);
    expect(gridActionsColumnWidth(5)).toBe(138);
  });

  it('uses overflow slot count, not raw action count', () => {
    expect(gridActionsColumnWidth(resolveGridActionSlotCount(5, 3))).toBe(84);
    expect(resolveGridActionSlotCount(3, 3)).toBe(3);
  });

  it('adds last-column overlay scroll inset for AppTableGrid actions columns', () => {
    expect(gridActionsColumnWidthForOverlayLastColumn(3)).toBe(110);
  });
});

describe('isColumnHiddenAtViewport', () => {
  it('hides md columns only on phone', () => {
    expect(isColumnHiddenAtViewport('md', 'phone')).toBe(true);
    expect(isColumnHiddenAtViewport('md', 'tablet')).toBe(false);
    expect(isColumnHiddenAtViewport('md', 'desktop')).toBe(false);
  });

  it('hides lg columns on phone and tablet', () => {
    expect(isColumnHiddenAtViewport('lg', 'phone')).toBe(true);
    expect(isColumnHiddenAtViewport('lg', 'tablet')).toBe(true);
    expect(isColumnHiddenAtViewport('lg', 'desktop')).toBe(false);
    expect(isColumnHiddenAtViewport('lg', 'wide')).toBe(false);
  });
});

describe('resolveCardActionsChrome', () => {
  const variant = APP_TABLE_GRID_STANDARD_CARD_VARIANT;

  it('honors explicit placement including none', () => {
    expect(resolveCardActionsChrome('none', variant)).toBe('none');
    expect(resolveCardActionsChrome('footer', variant)).toBe('footer');
    expect(resolveCardActionsChrome('header', variant)).toBe('header');
  });

  it('defaults standard cards to footer chrome', () => {
    expect(resolveCardActionsChrome(undefined, variant)).toBe('footer');
    expect(resolveCardActionsChrome(undefined)).toBe('footer');
  });
});

describe('resolveGridCardActionsMaxVisible', () => {
  it('defaults by viewport tier when override is omitted', () => {
    expect(resolveGridCardActionsMaxVisible('phone')).toBe(1);
    expect(resolveGridCardActionsMaxVisible('tablet')).toBe(2);
    expect(resolveGridCardActionsMaxVisible('desktop')).toBe(DEFAULT_GRID_MAX_VISIBLE_ACTIONS);
  });

  it('honors explicit override', () => {
    expect(resolveGridCardActionsMaxVisible('phone', 4)).toBe(4);
  });
});
