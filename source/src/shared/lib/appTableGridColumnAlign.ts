export function resolveAppTableGridHeaderFlexJustify(headerClassName?: string): string {
  if (!headerClassName) {
    return 'justify-start';
  }
  if (headerClassName.includes('text-end') || headerClassName.includes('text-right')) {
    return 'justify-end';
  }
  if (headerClassName.includes('text-center')) {
    return 'justify-center';
  }
  if (headerClassName.includes('text-start') || headerClassName.includes('text-left')) {
    return 'justify-start';
  }
  return 'justify-start';
}

/** Header label span — avoid flex-1 on centered columns so text-align center is visible in RTL grids. */
export function resolveAppTableGridHeaderLabelClassName(headerClassName?: string): string {
  if (headerClassName?.includes('text-center')) {
    return 'min-w-0 w-full truncate text-center';
  }
  if (headerClassName?.includes('text-end') || headerClassName?.includes('text-right')) {
    return 'min-w-0 flex-1 truncate text-end';
  }
  return 'min-w-0 flex-1 truncate';
}

export function resolveAppTableGridCellClipAlign(cellClassName?: string): string {
  if (!cellClassName) {
    return '';
  }
  if (cellClassName.includes('nakhebin-voted-grid-cell')) {
    return 'flex w-full min-w-0 items-center justify-center text-center';
  }
  if (cellClassName.includes('hwy-electoral-division-grid-cell')) {
    return 'flex w-full min-w-0 min-h-full flex-col justify-center text-start';
  }
  if (cellClassName.includes('text-center')) {
    return 'flex w-full min-w-0 items-center justify-center text-center';
  }
  if (cellClassName.includes('text-right')) {
    return 'text-right';
  }
  if (cellClassName.includes('text-end')) {
    return 'text-end';
  }
  if (cellClassName.includes('text-left')) {
    return 'text-left';
  }
  if (cellClassName.includes('text-start')) {
    return 'w-full min-w-0 text-start';
  }
  return '';
}
