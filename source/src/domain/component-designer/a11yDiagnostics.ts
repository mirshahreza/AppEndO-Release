/**
 * Accessibility auditing rules for Component Designer diagnostics (Phase 50 / gap #19).
 * Parallel category: codes are `a11y-*` and must not change Errors/Warnings filter counts.
 */

import { getNodePaletteItemId } from './runtimeShared';
import type { DesignerDiagnostic, DesignerDocument, DesignerNode } from './types';

export const A11Y_DIAGNOSTIC_CODES = [
  'a11y-missing-alt',
  'a11y-low-contrast',
  'a11y-missing-aria-label',
  'a11y-heading-order',
] as const;

export type A11yDiagnosticCode = (typeof A11Y_DIAGNOSTIC_CODES)[number];

export const isA11yDiagnosticCode = (code: string): code is A11yDiagnosticCode =>
  (A11Y_DIAGNOSTIC_CODES as readonly string[]).includes(code);

export type DesignerDiagnosticCategory = 'errors' | 'warnings' | 'accessibility';

export const getDesignerDiagnosticCategory = (
  diagnostic: Pick<DesignerDiagnostic, 'code' | 'level'>,
): DesignerDiagnosticCategory => {
  if (isA11yDiagnosticCode(diagnostic.code)) {
    return 'accessibility';
  }
  if (diagnostic.level === 'error') {
    return 'errors';
  }
  return 'warnings';
};

export const filterDiagnosticsByCategory = (
  diagnostics: readonly DesignerDiagnostic[],
  category: DesignerDiagnosticCategory,
): DesignerDiagnostic[] =>
  diagnostics.filter((item) => getDesignerDiagnosticCategory(item) === category);

const isBlankString = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0);

const hasAccessibleText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const INTERACTIVE_NAME_PALETTE_IDS = new Set([
  'heroui.button-solid',
  'heroui.button-outline',
  'heroui.link',
  'heroui.chip',
  'html.link',
]);

const FORM_CONTROL_PALETTE_IDS = new Set([
  'heroui.input-text',
  'heroui.number-input',
  'heroui.select',
  'heroui.autocomplete',
  'heroui.textarea',
]);

const IMAGE_PALETTE_IDS = new Set(['html.image', 'heroui.avatar']);

const parseHeadingLevel = (node: DesignerNode): number | null => {
  const paletteItemId = getNodePaletteItemId(node);
  if (node.type !== 'heading' && paletteItemId !== 'html.heading') {
    return null;
  }
  const raw = typeof node.props.level === 'string' ? node.props.level.trim().toLowerCase() : 'h2';
  const match = /^h([1-6])$/.exec(raw);
  return match ? Number(match[1]) : 2;
};

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const expandShortHex = (hex: string): string => {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex.toLowerCase();
};

const parseHexColor = (raw: unknown): string | null => {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!HEX_COLOR_RE.test(trimmed)) {
    return null;
  }
  return expandShortHex(trimmed);
};

const parseRgbChannels = (hex: string): [number, number, number] | null => {
  const normalized = parseHexColor(hex);
  if (!normalized) {
    return null;
  }
  const value = normalized.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
};

const channelToLinear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2 relative luminance for an #rrggbb color. */
export const relativeLuminance = (hex: string): number | null => {
  const rgb = parseRgbChannels(hex);
  if (!rgb) {
    return null;
  }
  const [r, g, b] = rgb.map(channelToLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two hex colors (1–21). */
export const contrastRatio = (foregroundHex: string, backgroundHex: string): number | null => {
  const fg = relativeLuminance(foregroundHex);
  const bg = relativeLuminance(backgroundHex);
  if (fg === null || bg === null) {
    return null;
  }
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
};

const extractHexFromClassName = (className: string, kind: 'text' | 'bg'): string | null => {
  const pattern = kind === 'text'
    ? /(?:^|\s)(?:[a-z0-9-]+:)*text-\[(#(?:[0-9a-f]{3}|[0-9a-f]{6}))\](?:\s|$)/i
    : /(?:^|\s)(?:[a-z0-9-]+:)*bg-\[(#(?:[0-9a-f]{3}|[0-9a-f]{6}))\](?:\s|$)/i;
  const match = pattern.exec(className);
  return match ? parseHexColor(match[1]) : null;
};

const resolveNodeForegroundBackground = (node: DesignerNode): { fg: string | null; bg: string | null } => {
  const className = typeof node.props.className === 'string' ? node.props.className : '';
  let fg = extractHexFromClassName(className, 'text');
  let bg = extractHexFromClassName(className, 'bg');

  const style = node.props.style;
  if (style && typeof style === 'object' && !Array.isArray(style)) {
    const styleRecord = style as Record<string, unknown>;
    fg = parseHexColor(styleRecord.color) ?? fg;
    bg = parseHexColor(styleRecord.backgroundColor) ?? bg;
  }

  return { fg, bg };
};

const pushMissingAlt = (diagnostics: DesignerDiagnostic[], node: DesignerNode) => {
  const paletteItemId = getNodePaletteItemId(node);
  const isImage = node.type === 'image' || (paletteItemId !== null && IMAGE_PALETTE_IDS.has(paletteItemId));
  if (!isImage) {
    return;
  }

  // Empty string is valid WCAG decorative alt; only missing/undefined/null is flagged.
  if (node.props.alt === undefined || node.props.alt === null) {
    diagnostics.push({
      id: `a11y-missing-alt:${node.id}`,
      code: 'a11y-missing-alt',
      level: 'warning',
      nodeId: node.id,
      field: 'alt',
      message: `Image is missing 'alt' text for screen readers.`,
    });
  }
};

const pushMissingAccessibleName = (diagnostics: DesignerDiagnostic[], node: DesignerNode) => {
  const paletteItemId = getNodePaletteItemId(node) ?? '';
  const ariaLabel = node.props.ariaLabel;

  if (FORM_CONTROL_PALETTE_IDS.has(paletteItemId)) {
    if (
      isBlankString(node.props.label)
      && isBlankString(ariaLabel)
      && isBlankString(node.props.placeholder)
    ) {
      diagnostics.push({
        id: `a11y-missing-aria-label:${node.id}`,
        code: 'a11y-missing-aria-label',
        level: 'warning',
        nodeId: node.id,
        field: 'ariaLabel',
        message: `Form input field has no visible label, placeholder, or ariaLabel.`,
      });
    }
    return;
  }

  const isInteractive =
    node.type === 'button'
    || node.type === 'link'
    || INTERACTIVE_NAME_PALETTE_IDS.has(paletteItemId);

  if (!isInteractive) {
    return;
  }

  const hasName =
    hasAccessibleText(node.props.text)
    || hasAccessibleText(node.props.label)
    || hasAccessibleText(node.props.title)
    || hasAccessibleText(ariaLabel);

  if (!hasName) {
    const kind = node.type === 'link' || paletteItemId === 'heroui.link' || paletteItemId === 'html.link'
      ? 'Link'
      : 'Button';
    diagnostics.push({
      id: `a11y-missing-aria-label:${node.id}`,
      code: 'a11y-missing-aria-label',
      level: 'warning',
      nodeId: node.id,
      field: 'ariaLabel',
      message: `${kind} has no text content or ariaLabel.`,
    });
  }
};

const pushLowContrast = (diagnostics: DesignerDiagnostic[], node: DesignerNode) => {
  const { fg, bg } = resolveNodeForegroundBackground(node);
  if (!fg || !bg) {
    return;
  }
  const ratio = contrastRatio(fg, bg);
  if (ratio === null || ratio >= 4.5) {
    return;
  }
  diagnostics.push({
    id: `a11y-low-contrast:${node.id}`,
    code: 'a11y-low-contrast',
    level: 'warning',
    nodeId: node.id,
    field: 'className',
    message: `Text/background contrast ratio ${ratio.toFixed(2)}:1 is below WCAG AA 4.5:1.`,
  });
};

const pushHeadingOrderDiagnostics = (
  diagnostics: DesignerDiagnostic[],
  document: DesignerDocument,
) => {
  let previousLevel: number | null = null;

  const visit = (nodeId: string) => {
    const node = document.nodes[nodeId];
    if (!node) {
      return;
    }

    const level = parseHeadingLevel(node);
    if (level !== null) {
      if (previousLevel !== null && level > previousLevel + 1) {
        diagnostics.push({
          id: `a11y-heading-order:${node.id}`,
          code: 'a11y-heading-order',
          level: 'warning',
          nodeId: node.id,
          field: 'level',
          message: `Heading level skips from h${previousLevel} to h${level}. Use sequential heading levels.`,
        });
      }
      previousLevel = level;
    }

    const orderedChildren = [...node.children].sort((leftId, rightId) => {
      const left = document.nodes[leftId]?.order ?? 0;
      const right = document.nodes[rightId]?.order ?? 0;
      return left - right;
    });
    for (const childId of orderedChildren) {
      visit(childId);
    }
  };

  visit(document.rootNodeId);
};

/** Collect accessibility diagnostics for a designer document (also used by Preview panel). */
export const collectAccessibilityDiagnostics = (document: DesignerDocument): DesignerDiagnostic[] => {
  const diagnostics: DesignerDiagnostic[] = [];
  const root = document.nodes[document.rootNodeId];
  if (!root) {
    return diagnostics;
  }

  for (const node of Object.values(document.nodes)) {
    if (node.type === 'root') {
      continue;
    }
    pushMissingAlt(diagnostics, node);
    pushMissingAccessibleName(diagnostics, node);
    pushLowContrast(diagnostics, node);
  }

  pushHeadingOrderDiagnostics(diagnostics, document);
  return diagnostics;
};
