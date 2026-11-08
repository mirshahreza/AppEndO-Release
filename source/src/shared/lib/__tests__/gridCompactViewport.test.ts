import { describe, expect, it } from 'vitest';
import {
  freezeLeadingDataColumn,
  parseGridCompactFromProps,
  partitionCardFields,
  resolveGridCompactViewport,
  serializeGridCompactJsx,
} from '../gridCompactViewport';
import type { AppTableGridColumnDef } from '../appTableGridQuery';

describe('resolveGridCompactViewport', () => {
  it('keeps the table on every viewport when presentation is table', () => {
    expect(resolveGridCompactViewport({ presentation: 'table', viewportTier: 'phone' }).layout).toBe('table');
    expect(resolveGridCompactViewport({ presentation: 'table', viewportTier: 'tablet' }).layout).toBe('table');
  });

  it('uses auto mapping: phone and tablet cards, desktop table', () => {
    expect(resolveGridCompactViewport({ presentation: 'auto', viewportTier: 'phone' }).layout).toBe('cards');
    expect(resolveGridCompactViewport({ presentation: 'auto', viewportTier: 'tablet' }).layout).toBe('cards');
    expect(resolveGridCompactViewport({ presentation: 'auto', viewportTier: 'desktop' }).layout).toBe('table');
  });

  it('locks presentation cards on every viewport', () => {
    expect(resolveGridCompactViewport({ presentation: 'cards', viewportTier: 'desktop' }).layout).toBe('cards');
    expect(resolveGridCompactViewport({ presentation: 'cards', viewportTier: 'wide' }).layout).toBe('cards');
  });

  it('uses compact phone cards even when presentation is table', () => {
    expect(resolveGridCompactViewport({
      presentation: 'table',
      viewportTier: 'phone',
      compact: { phone: { layout: 'cards' } },
    }).layout).toBe('cards');
    expect(resolveGridCompactViewport({
      presentation: 'table',
      viewportTier: 'desktop',
      compact: { phone: { layout: 'cards' } },
    }).layout).toBe('table');
  });

  it('locks phone cards to one per row and defaults tablet cards to two', () => {
    const phone = resolveGridCompactViewport({
      presentation: 'cards',
      viewportTier: 'phone',
      compact: { phone: { cardsPerRow: 3 } },
    });
    expect(phone.cardsPerRow).toBe(1);

    const tablet = resolveGridCompactViewport({
      presentation: 'cards',
      viewportTier: 'tablet',
    });
    expect(tablet.cardsPerRow).toBe(2);

    const desktop = resolveGridCompactViewport({
      presentation: 'cards',
      viewportTier: 'desktop',
    });
    expect(desktop.cardsPerRow).toBe(2);

    const tabletThree = resolveGridCompactViewport({
      presentation: 'auto',
      viewportTier: 'tablet',
      compact: { tablet: { layout: 'cards', cardsPerRow: 3 } },
    });
    expect(tabletThree.layout).toBe('cards');
    expect(tabletThree.cardsPerRow).toBe(3);

    const tabletThreeInheritLayout = resolveGridCompactViewport({
      presentation: 'auto',
      cardBelow: 'tablet',
      viewportTier: 'tablet',
      compact: { tablet: { cardsPerRow: 3 } },
    });
    expect(tabletThreeInheritLayout.layout).toBe('cards');
    expect(tabletThreeInheritLayout.cardsPerRow).toBe(3);
  });

  it('honors keep-table on phone', () => {
    const resolved = resolveGridCompactViewport({
      presentation: 'auto',
      viewportTier: 'phone',
      compact: { phone: { layout: 'keep-table' } },
    });
    expect(resolved.layout).toBe('table');
  });

  it('freezes the first column by default only for table-scroll', () => {
    expect(resolveGridCompactViewport({
      presentation: 'auto',
      cardBelow: 'phone',
      viewportTier: 'tablet',
    }).freezeFirstColumn).toBe(true);

    expect(resolveGridCompactViewport({
      presentation: 'auto',
      viewportTier: 'tablet',
    }).freezeFirstColumn).toBe(false);

    expect(resolveGridCompactViewport({
      presentation: 'table',
      viewportTier: 'phone',
    }).freezeFirstColumn).toBe(false);
  });
});

describe('partitionCardFields', () => {
  it('hides extra fields when collapse is on', () => {
    expect(partitionCardFields(['a', 'b', 'c', 'd'], true, 2)).toEqual({
      visible: ['a', 'b'],
      extra: ['c', 'd'],
    });
    expect(partitionCardFields(['a', 'b'], true, 3).extra).toEqual([]);
  });
});

describe('freezeLeadingDataColumn', () => {
  it('pins the first data column and skips the selection column', () => {
    const columns: AppTableGridColumnDef<{ id: string }>[] = [
      { id: '__selection__', label: '', renderCell: () => null, layout: { pinned: 'left' } },
      { id: 'name', label: 'Name', renderCell: () => null },
      { id: 'status', label: 'Status', renderCell: () => null },
    ];
    const frozen = freezeLeadingDataColumn(columns, true, '__selection__');
    expect(frozen[1]?.layout && frozen[1].layout !== false && frozen[1].layout.pinned).toBe('left');
    expect(frozen[2]?.layout && frozen[2].layout !== false ? frozen[2].layout.pinned : undefined).toBeUndefined();
  });
});

describe('parseGridCompactFromProps', () => {
  it('ignores inherit tokens and serializes only set options', () => {
    expect(parseGridCompactFromProps({
      compactPhoneLayout: 'inherit',
      compactTabletLayout: 'cards',
      compactTabletCardsPerRow: 2,
    })).toEqual({
      tablet: { layout: 'cards', cardsPerRow: 2 },
    });

    expect(serializeGridCompactJsx(parseGridCompactFromProps({
      compactPhoneLayout: 'keep-table',
    }))).toBe('{ phone: { layout: "keep-table" } }');
  });
});
