import type { CSSProperties } from 'react';
import { resolveCustomSizeDomStyle } from './customSizeStyle';
import { resolveLayoutGridDomStyle } from './layoutGridColumnWidths';
import { isDesignerInternalPropKey } from './propRegistry';
import type { DesignerNode } from './types';
import { getNodePaletteItemId } from './runtimeShared';
import { TAILWIND_UI_BLOCK_STRUCTURAL_PROP_KEYS } from './tailwindUiBlocksExport';

export { isDesignerInternalPropKey } from './propRegistry';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const toCamelCaseCssProperty = (property: string): string => {
  const trimmed = property.trim();
  if (trimmed.startsWith('--')) {
    return trimmed;
  }

  return trimmed.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase());
};

export const parseInlineStyleValue = (value: unknown): Record<string, string | number> | null => {
  if (typeof value === 'string') {
    const styleText = value.trim();
    if (styleText.length === 0) {
      return null;
    }

    const styleObject: Record<string, string> = {};
    for (const declaration of styleText.split(';')) {
      const trimmedDeclaration = declaration.trim();
      if (trimmedDeclaration.length === 0) {
        continue;
      }

      const separatorIndex = trimmedDeclaration.indexOf(':');
      if (separatorIndex <= 0) {
        continue;
      }

      const rawProperty = trimmedDeclaration.slice(0, separatorIndex).trim();
      const rawValue = trimmedDeclaration.slice(separatorIndex + 1).trim();
      if (rawProperty.length === 0 || rawValue.length === 0) {
        continue;
      }

      styleObject[toCamelCaseCssProperty(rawProperty)] = rawValue;
    }

    return Object.keys(styleObject).length > 0 ? styleObject : null;
  }

  if (isRecord(value)) {
    const styleObject: Record<string, string | number> = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item))) {
        styleObject[toCamelCaseCssProperty(key)] = item;
      }
    }

    return Object.keys(styleObject).length > 0 ? styleObject : null;
  }

  return null;
};

export const parseHtmlExtraAttrs = (value: unknown): Record<string, string> => {
  if (typeof value !== 'string') {
    return {};
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) {
      return {};
    }

    const next: Record<string, string> = {};
    for (const [key, item] of Object.entries(parsed)) {
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        next[key] = String(item);
      }
    }

    return next;
  } catch {
    return {};
  }
};

export const mergeCssProperties = (...sources: Array<CSSProperties | null | undefined>): CSSProperties => {
  const merged: CSSProperties = {};

  for (const source of sources) {
    if (!source) {
      continue;
    }

    Object.assign(merged, source);
  }

  return merged;
};

export type DesignerDomProps = {
  id?: string;
  title?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  hidden?: boolean;
  tabIndex?: number;
  role?: string;
  'aria-label'?: string;
  'data-testid'?: string;
  style?: CSSProperties;
  className?: string;
  extraAttrs: Record<string, string>;
};

export const resolveDesignerDomProps = (node: DesignerNode): DesignerDomProps => {
  const extraAttrs = parseHtmlExtraAttrs(node.props.htmlExtraAttrs);
  const paletteItemId = getNodePaletteItemId(node);
  const structuralPropKeys = paletteItemId
    ? TAILWIND_UI_BLOCK_STRUCTURAL_PROP_KEYS[paletteItemId]
    : undefined;

  if (typeof node.props.dataTestId === 'string' && node.props.dataTestId.trim().length > 0) {
    extraAttrs['data-testid'] = node.props.dataTestId.trim();
  }

  const domProps: DesignerDomProps = {
    extraAttrs,
  };

  if (typeof node.props.id === 'string' && node.props.id.trim().length > 0) {
    domProps.id = node.props.id.trim();
  }

  if (typeof node.props.title === 'string' && node.props.title.trim().length > 0 && !structuralPropKeys?.has('title')) {
    domProps.title = node.props.title.trim();
  }

  if (typeof node.props.lang === 'string' && node.props.lang.trim().length > 0) {
    domProps.lang = node.props.lang.trim();
  }

  if (node.props.dir === 'ltr' || node.props.dir === 'rtl' || node.props.dir === 'auto') {
    domProps.dir = node.props.dir;
  }

  if (node.props.hidden === true) {
    domProps.hidden = true;
  }

  if (typeof node.props.tabIndex === 'number' && Number.isFinite(node.props.tabIndex)) {
    domProps.tabIndex = Math.trunc(node.props.tabIndex);
  }

  if (typeof node.props.role === 'string' && node.props.role.trim().length > 0) {
    domProps.role = node.props.role.trim();
  }

  if (typeof node.props.ariaLabel === 'string' && node.props.ariaLabel.trim().length > 0) {
    domProps['aria-label'] = node.props.ariaLabel.trim();
  }

  const styleObject = mergeCssProperties(
    resolveLayoutGridDomStyle(node),
    resolveCustomSizeDomStyle(node),
    parseInlineStyleValue(node.props.style) as CSSProperties | null,
  );
  if (Object.keys(styleObject).length > 0) {
    domProps.style = styleObject;
  }

  if (typeof node.props.className === 'string') {
    domProps.className = node.props.className;
  }

  return domProps;
};

export const spreadDesignerDomProps = (domProps: DesignerDomProps): Record<string, unknown> => {
  const spread: Record<string, unknown> = {
    ...domProps.extraAttrs,
  };

  if (domProps.id) spread.id = domProps.id;
  if (domProps.title) spread.title = domProps.title;
  if (domProps.lang) spread.lang = domProps.lang;
  if (domProps.dir) spread.dir = domProps.dir;
  if (domProps.hidden) spread.hidden = true;
  if (domProps.tabIndex !== undefined) spread.tabIndex = domProps.tabIndex;
  if (domProps.role) spread.role = domProps.role;
  if (domProps['aria-label']) spread['aria-label'] = domProps['aria-label'];
  if (domProps['data-testid']) spread['data-testid'] = domProps['data-testid'];
  if (domProps.style) spread.style = domProps.style;

  return spread;
};

export const PALETTE_HTML_TAG_BY_ID: Record<string, string> = {
  'tailwind.badge-pill': 'span',
  'html.section': 'section',
  'html.article': 'article',
  'html.figure': 'figure',
  'html.form': 'form',
  'heroui.input-text': 'input',
  'heroui.number-input': 'input',
  'heroui.textarea': 'textarea',
  'heroui.button-solid': 'button',
  'heroui.button-outline': 'button',
};

export const resolveDesignerHtmlTag = (node: DesignerNode, fallback: string): string => {
  const paletteItemId = node.props._designerPaletteItemId;
  if (typeof paletteItemId === 'string' && PALETTE_HTML_TAG_BY_ID[paletteItemId]) {
    return PALETTE_HTML_TAG_BY_ID[paletteItemId];
  }

  return fallback;
};
