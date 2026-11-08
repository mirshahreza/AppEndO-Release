import { GRID_COLUMN_MIN_WIDTH } from './appTableGridColumnLayout';

let measureSandbox: HTMLDivElement | null = null;

function readBoxInset(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMeasureSandbox(): HTMLDivElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  if (!measureSandbox) {
    measureSandbox = document.createElement('div');
    measureSandbox.setAttribute('aria-hidden', 'true');
    measureSandbox.style.cssText =
      'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;width:max-content;max-width:none;';
    document.body.appendChild(measureSandbox);
  }
  return measureSandbox;
}

function measureUnconstrainedContentWidth(element: HTMLElement): number {
  const sandbox = getMeasureSandbox();
  if (!sandbox) {
    return element.getBoundingClientRect().width;
  }

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.maxWidth = 'none';
  clone.style.width = 'max-content';
  clone.style.whiteSpace = 'nowrap';
  clone.classList.remove('truncate', 'min-w-0', 'max-w-full');

  const style = getComputedStyle(element);
  sandbox.style.font = style.font;
  sandbox.style.letterSpacing = style.letterSpacing;
  sandbox.style.textTransform = style.textTransform;
  sandbox.replaceChildren(clone);

  return sandbox.getBoundingClientRect().width;
}

function measureHeaderCellAutoWidth(cell: HTMLTableCellElement): number {
  const style = getComputedStyle(cell);
  const boxPadding =
    readBoxInset(style.paddingInlineStart) + readBoxInset(style.paddingInlineEnd);
  const boxBorder =
    readBoxInset(style.borderInlineStartWidth) + readBoxInset(style.borderInlineEndWidth);

  const flexRow = cell.querySelector(':scope > div.flex');
  let contentWidth = flexRow instanceof HTMLElement
    ? measureUnconstrainedContentWidth(flexRow)
    : 0;

  if (contentWidth === 0) {
    const label = cell.querySelector(':scope > div.flex span');
    contentWidth = label instanceof HTMLElement
      ? measureUnconstrainedContentWidth(label)
      : 0;
  }

  const endBands = cell.querySelectorAll(':scope > div.absolute.inset-y-0');
  endBands.forEach((band) => {
    if (band instanceof HTMLElement && band.offsetWidth > 0) {
      contentWidth += band.offsetWidth;
    }
  });

  return contentWidth + boxPadding + boxBorder;
}

function measureBodyCellAutoWidth(cell: HTMLTableCellElement): number {
  const style = getComputedStyle(cell);
  const boxPadding =
    readBoxInset(style.paddingInlineStart) + readBoxInset(style.paddingInlineEnd);
  const boxBorder =
    readBoxInset(style.borderInlineStartWidth) + readBoxInset(style.borderInlineEndWidth);

  const inner = cell.querySelector(':scope > div');
  const target = inner instanceof HTMLElement ? inner : cell;

  return measureUnconstrainedContentWidth(target) + boxPadding + boxBorder;
}

function measureTableCellAutoWidth(cell: HTMLTableCellElement): number {
  if (cell.tagName === 'TH') {
    return measureHeaderCellAutoWidth(cell);
  }
  return measureBodyCellAutoWidth(cell);
}

/**
 * Excel-style auto-fit: measure header label + end chrome and visible body cells for one column.
 */
export function measureAppTableGridColumnAutoWidth(
  root: HTMLElement | null | undefined,
  columnId: string,
  minWidthPx = GRID_COLUMN_MIN_WIDTH,
): number | null {
  if (!root || !columnId) {
    return null;
  }

  const escapedId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(columnId)
    : columnId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const cells = root.querySelectorAll<HTMLTableCellElement>(`[data-column-id="${escapedId}"]`);
  if (cells.length === 0) {
    return null;
  }

  let maxWidth = minWidthPx;
  cells.forEach((cell) => {
    maxWidth = Math.max(maxWidth, measureTableCellAutoWidth(cell));
  });

  return Math.max(minWidthPx, Math.ceil(maxWidth));
}
