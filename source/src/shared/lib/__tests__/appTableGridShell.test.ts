import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_TABLE_GRID_BORDER_WIDTH_PX,
  DEFAULT_APP_TABLE_GRID_CELL_PADDING_X_PX,
  DEFAULT_APP_TABLE_GRID_HERO_BORDER_WIDTH_PX,
  DEFAULT_APP_TABLE_GRID_HERO_MARGIN_PX,
  DEFAULT_APP_TABLE_GRID_MARGIN_PX,
  isAppTableGridHeroChrome,
  resolveAppTableGridBorderWidthPx,
  resolveAppTableGridCellPaddingXPx,
  resolveAppTableGridChrome,
  resolveAppTableGridChromeBorderWidthPx,
  resolveAppTableGridChromeMarginPx,
  resolveAppTableGridFillHost,
  resolveAppTableGridHeaderQueryControlsVisibility,
  resolveAppTableGridMarginPx,
  resolveGridPagingFooterChrome,
} from '../appTableGridShell';

describe('appTableGridShell', () => {
  it('keeps page-list defaults at 0 so CRUD grids stay flush', () => {
    expect(DEFAULT_APP_TABLE_GRID_MARGIN_PX).toBe(0);
    expect(DEFAULT_APP_TABLE_GRID_BORDER_WIDTH_PX).toBe(0);
    expect(resolveAppTableGridMarginPx(undefined)).toBe(0);
    expect(resolveAppTableGridBorderWidthPx(undefined)).toBe(0);
  });

  it('keeps hero chrome defaults at 4px inset and 5px outline', () => {
    expect(DEFAULT_APP_TABLE_GRID_HERO_MARGIN_PX).toBe(4);
    expect(DEFAULT_APP_TABLE_GRID_HERO_BORDER_WIDTH_PX).toBe(5);
  });

  it('treats omitted chrome as classic and maps hero onto the joined-card defaults', () => {
    expect(resolveAppTableGridChrome(undefined)).toBe('classic');
    expect(isAppTableGridHeroChrome(undefined)).toBe(false);
    expect(isAppTableGridHeroChrome('hero')).toBe(true);
    expect(resolveAppTableGridChromeMarginPx('classic')).toBe(0);
    expect(resolveAppTableGridChromeBorderWidthPx('classic')).toBe(0);
    expect(resolveAppTableGridChromeMarginPx('hero')).toBe(DEFAULT_APP_TABLE_GRID_HERO_MARGIN_PX);
    expect(resolveAppTableGridChromeBorderWidthPx('hero')).toBe(DEFAULT_APP_TABLE_GRID_HERO_BORDER_WIDTH_PX);
    expect(resolveAppTableGridChromeMarginPx('hero', 0)).toBe(0);
    expect(resolveAppTableGridChromeBorderWidthPx('hero', 2)).toBe(2);
    expect(resolveGridPagingFooterChrome('classic')).toBe('page');
    expect(resolveGridPagingFooterChrome('hero')).toBe('hero');
  });

  it('clamps border width to the shared 0–5px scale', () => {
    expect(resolveAppTableGridBorderWidthPx(9, 0)).toBe(5);
  });

  it('fills the host only when this grid owns vertical scroll', () => {
    expect(resolveAppTableGridFillHost('self', true)).toBe(true);
    expect(resolveAppTableGridFillHost('self', false)).toBe(false);
    expect(resolveAppTableGridFillHost('panel', true)).toBe(false);
  });

  it('defaults cell padding to 5px on every column', () => {
    expect(DEFAULT_APP_TABLE_GRID_CELL_PADDING_X_PX).toBe(5);
    expect(resolveAppTableGridCellPaddingXPx(undefined)).toBe(5);
    expect(resolveAppTableGridCellPaddingXPx(8)).toBe(8);
    expect(resolveAppTableGridCellPaddingXPx(-1)).toBe(5);
  });

  it('defaults header query controls to hover overlay', () => {
    expect(resolveAppTableGridHeaderQueryControlsVisibility(undefined)).toBe('hover');
    expect(resolveAppTableGridHeaderQueryControlsVisibility('hover')).toBe('hover');
    expect(resolveAppTableGridHeaderQueryControlsVisibility('always')).toBe('always');
  });
});
