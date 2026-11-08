import { MODELER_INSPECTOR_LIST_PREVIEW_COUNT } from './modelerChipStyles';

export { MODELER_INSPECTOR_LIST_PREVIEW_COUNT };

export function sliceModelerInspectorList<T>(
  items: readonly T[],
  expanded: boolean,
  previewCount: number = MODELER_INSPECTOR_LIST_PREVIEW_COUNT,
): { visible: readonly T[]; hiddenCount: number } {
  const hiddenCount = Math.max(0, items.length - previewCount);
  if (expanded || hiddenCount === 0) {
    return { visible: items, hiddenCount };
  }
  return { visible: items.slice(0, previewCount), hiddenCount };
}

export function modelerInspectorMoreLinkLabel(hiddenCount: number, expanded: boolean): string {
  return expanded ? 'Show less' : `and ${hiddenCount} more`;
}

export function modelerInspectorMoreLinkAriaLabel(hiddenCount: number, expanded: boolean): string {
  return expanded ? 'Show less' : `Show ${hiddenCount} more`;
}
