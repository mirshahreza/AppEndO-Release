import type { CSSProperties } from 'react';
import type { DesignerNode } from './types';

const HEIGHT_UTILITY_PATTERN = /(?:^|\s)(?:[a-z0-9-]+:)?(?:min-h-|h-|max-h-|size-)/;

export const isBuiltInStructuralPaletteItemId = (paletteItemId: string | null | undefined): boolean =>
  typeof paletteItemId === 'string'
  && (paletteItemId.startsWith('html.') || paletteItemId.startsWith('layout.') || paletteItemId.startsWith('tailwind.'));

export const hasExplicitHeightConstraint = (
  className: string,
  style?: CSSProperties | null,
): boolean => {
  if (HEIGHT_UTILITY_PATTERN.test(className.trim())) {
    return true;
  }

  if (!style) {
    return false;
  }

  return (['height', 'minHeight', 'maxHeight'] as const).some((key) => {
    const value = style[key];
    return value !== undefined && value !== null && String(value).trim().length > 0;
  });
};

/** Empty structural containers rely on drag-time drop zones instead of persistent design chrome. */
export const resolveDesignerEmptyStructuralShellClass = (
  _node: DesignerNode,
  options: { isEmpty: boolean; className?: string; style?: CSSProperties | null },
): string | null => {
  if (!options.isEmpty) {
    return null;
  }

  return null;
};
