import type { CSSProperties } from 'react';
import { clamp, colorToHex, colorToRgba, rgbaToCss } from './colorMath';

export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double' | 'none';

export type BorderSideWidths = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type BorderCornerRadii = {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
};

export type BorderDefinition = {
  style: BorderStyle;
  color: string;
  uniformWidth: boolean;
  width: number;
  sides: BorderSideWidths;
  uniformRadius: boolean;
  radius: number;
  corners: BorderCornerRadii;
};

export type ShadowLayer = {
  id: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
};

export type ShadowDefinition = {
  layers: ShadowLayer[];
};

export type BorderShadowDefinition = {
  border: BorderDefinition;
  shadow: ShadowDefinition;
};

export type BorderShadowCssOutput = {
  border: string;
  shadow: string;
  combined: string;
};

const BORDER_STYLES: BorderStyle[] = ['solid', 'dashed', 'dotted', 'double', 'none'];

const BORDER_STYLE_OPTIONS = BORDER_STYLES;

let shadowLayerIdCounter = 0;

const createShadowLayer = (
  patch: Partial<Omit<ShadowLayer, 'id'>> = {},
): ShadowLayer => ({
  id: `shadow-${++shadowLayerIdCounter}`,
  offsetX: patch.offsetX ?? 0,
  offsetY: patch.offsetY ?? 4,
  blur: patch.blur ?? 6,
  spread: patch.spread ?? 0,
  color: patch.color ?? 'rgba(0, 0, 0, 0.1)',
  inset: patch.inset ?? false,
});

export const createDefaultBorder = (): BorderDefinition => ({
  style: 'solid',
  color: '#e2e8f0',
  uniformWidth: true,
  width: 1,
  sides: { top: 1, right: 1, bottom: 1, left: 1 },
  uniformRadius: true,
  radius: 8,
  corners: { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
});

const createDefaultShadow = (): ShadowDefinition => ({
  layers: [
    createShadowLayer({ offsetX: 0, offsetY: 4, blur: 6, spread: -1, color: 'rgba(0, 0, 0, 0.1)' }),
    createShadowLayer({ offsetX: 0, offsetY: 2, blur: 4, spread: -2, color: 'rgba(0, 0, 0, 0.1)' }),
  ],
});

export const createDefaultBorderShadow = (): BorderShadowDefinition => ({
  border: createDefaultBorder(),
  shadow: createDefaultShadow(),
});

const formatColor = (color: string): string => {
  const rgba = colorToRgba(color);
  return rgba.a < 1 ? rgbaToCss(rgba) : colorToHex(color);
};

const formatPx = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}px`;
};

export const clampBorderValue = (value: number, max = 48): number => (
  clamp(Math.round(value), 0, max)
);

export const clampShadowOffset = (value: number, max = 60): number => (
  clamp(Math.round(value), -max, max)
);

export const clampShadowRadius = (value: number, max = 120): number => (
  clamp(Math.round(value), 0, max)
);

export const updateBorder = (
  border: BorderDefinition,
  patch: Partial<BorderDefinition>,
): BorderDefinition => {
  const next = { ...border, ...patch };
  if (patch.width !== undefined && next.uniformWidth) {
    next.sides = { top: patch.width, right: patch.width, bottom: patch.width, left: patch.width };
  }
  if (patch.radius !== undefined && next.uniformRadius) {
    next.corners = {
      topLeft: patch.radius,
      topRight: patch.radius,
      bottomRight: patch.radius,
      bottomLeft: patch.radius,
    };
  }
  return next;
};

export const buildBorderCss = (border: BorderDefinition): string => {
  if (border.style === 'none') {
    return 'border: none';
  }

  const color = formatColor(border.color);
  const parts: string[] = [];

  if (border.uniformWidth) {
    parts.push(`border: ${formatPx(border.width)} ${border.style} ${color}`);
  } else {
    parts.push(
      `border-width: ${formatPx(border.sides.top)} ${formatPx(border.sides.right)} ${formatPx(border.sides.bottom)} ${formatPx(border.sides.left)}`,
      `border-style: ${border.style}`,
      `border-color: ${color}`,
    );
  }

  if (border.uniformRadius) {
    if (border.radius > 0) {
      parts.push(`border-radius: ${formatPx(border.radius)}`);
    }
  } else {
    parts.push(
      `border-radius: ${formatPx(border.corners.topLeft)} ${formatPx(border.corners.topRight)} ${formatPx(border.corners.bottomRight)} ${formatPx(border.corners.bottomLeft)}`,
    );
  }

  return parts.join('; ');
};

const buildShadowLayerCss = (layer: ShadowLayer): string => {
  const inset = layer.inset ? 'inset ' : '';
  const spreadPart = layer.spread !== 0 ? ` ${formatPx(layer.spread)}` : '';
  return `${inset}${formatPx(layer.offsetX)} ${formatPx(layer.offsetY)} ${formatPx(layer.blur)}${spreadPart} ${formatColor(layer.color)}`;
};

const buildShadowCss = (definition: ShadowDefinition): string => (
  definition.layers.map((layer) => buildShadowLayerCss(layer)).join(', ')
);

export const buildBorderShadowCssOutput = (definition: BorderShadowDefinition): BorderShadowCssOutput => {
  const border = buildBorderCss(definition.border);
  const shadow = buildShadowCss(definition.shadow);
  const combined = shadow ? `${border}; box-shadow: ${shadow}` : border;
  return { border, shadow, combined };
};

export const buildBorderShadowPreviewStyle = (definition: BorderShadowDefinition): CSSProperties => {
  const border = definition.border;
  const style: CSSProperties = {
    boxShadow: buildShadowCss(definition.shadow),
  };

  if (border.style === 'none') {
    style.borderStyle = 'none';
    style.borderWidth = 0;
  } else {
    style.borderStyle = border.style;
    style.borderColor = border.color;
    if (border.uniformWidth) {
      style.borderWidth = border.width;
    } else {
      style.borderTopWidth = border.sides.top;
      style.borderRightWidth = border.sides.right;
      style.borderBottomWidth = border.sides.bottom;
      style.borderLeftWidth = border.sides.left;
    }
    if (border.uniformRadius) {
      style.borderRadius = border.radius;
    } else {
      style.borderTopLeftRadius = border.corners.topLeft;
      style.borderTopRightRadius = border.corners.topRight;
      style.borderBottomRightRadius = border.corners.bottomRight;
      style.borderBottomLeftRadius = border.corners.bottomLeft;
    }
  }

  return style;
};

const splitShadowLayers = (raw: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of raw) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    }
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
};

const parseLength = (raw: string): number => Number(raw.replace(/px$/i, ''));

const parseSingleShadowLayer = (part: string): ShadowLayer | null => {
  let inset = false;
  let remaining = part.trim();
  if (remaining.toLowerCase().startsWith('inset')) {
    inset = true;
    remaining = remaining.slice(5).trim();
  }

  const match = remaining.match(
    /^([-\d.]+)(?:px)?\s+([-\d.]+)(?:px)?\s+([-\d.]+)(?:px)?(?:\s+([-\d.]+)(?:px)?)?\s+(.+)$/i,
  );
  if (!match) {
    return null;
  }

  return createShadowLayer({
    offsetX: parseLength(match[1]),
    offsetY: parseLength(match[2]),
    blur: parseLength(match[3]),
    spread: match[4] ? parseLength(match[4]) : 0,
    color: match[5].trim(),
    inset,
  });
};

export const parseShadowCss = (css: string): ShadowDefinition | null => {
  const trimmed = css.trim();
  if (!trimmed) {
    return null;
  }

  const layers = splitShadowLayers(trimmed)
    .map((part) => parseSingleShadowLayer(part))
    .filter((layer): layer is ShadowLayer => layer !== null);

  if (layers.length === 0) {
    return null;
  }

  return { layers };
};

export const addShadowLayer = (definition: ShadowDefinition): ShadowDefinition => {
  const last = definition.layers[definition.layers.length - 1];
  const nextLayer = createShadowLayer({
    offsetX: last?.offsetX ?? 0,
    offsetY: (last?.offsetY ?? 0) + 4,
    blur: last?.blur ?? 6,
    spread: last?.spread ?? 0,
    color: last?.color ?? 'rgba(0, 0, 0, 0.1)',
    inset: last?.inset ?? false,
  });
  return {
    ...definition,
    layers: [...definition.layers, nextLayer],
  };
};

export const removeShadowLayer = (
  definition: ShadowDefinition,
  layerId: string,
): ShadowDefinition => {
  if (definition.layers.length <= 1) {
    return definition;
  }
  return {
    ...definition,
    layers: definition.layers.filter((layer) => layer.id !== layerId),
  };
};

export const updateShadowLayer = (
  definition: ShadowDefinition,
  layerId: string,
  patch: Partial<Omit<ShadowLayer, 'id'>>,
): ShadowDefinition => ({
  ...definition,
  layers: definition.layers.map((layer) => (
    layer.id === layerId ? { ...layer, ...patch } : layer
  )),
});

export const reverseShadowLayers = (layers: ShadowLayer[]): ShadowLayer[] => [...layers].reverse();

const cloneShadowDefinition = (definition: ShadowDefinition): ShadowDefinition => ({
  layers: definition.layers.map((layer) => createShadowLayer({
    offsetX: layer.offsetX,
    offsetY: layer.offsetY,
    blur: layer.blur,
    spread: layer.spread,
    color: layer.color,
    inset: layer.inset,
  })),
});

const applyShadowCssToDefinition = (css: string): ShadowDefinition | null => {
  const parsed = parseShadowCss(css);
  if (!parsed) {
    return null;
  }
  return cloneShadowDefinition(parsed);
};

const cloneBorderDefinition = (border: BorderDefinition): BorderDefinition => ({
  ...border,
  sides: { ...border.sides },
  corners: { ...border.corners },
});

export const cloneBorderShadowDefinition = (definition: BorderShadowDefinition): BorderShadowDefinition => ({
  border: cloneBorderDefinition(definition.border),
  shadow: cloneShadowDefinition(definition.shadow),
});

export const applyBorderShadowPreset = (definition: BorderShadowDefinition): BorderShadowDefinition => (
  cloneBorderShadowDefinition(definition)
);

const resolveBorderShadowDefinitionFromCss = (
  borderCss: string,
  shadowCss: string,
): BorderShadowDefinition => {
  const base = createDefaultBorderShadow();
  const shadow = applyShadowCssToDefinition(shadowCss);
  return {
    border: base.border,
    shadow: shadow ?? base.shadow,
  };
};

export const isCssShadowValue = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return /^-?\d/.test(trimmed) || trimmed.toLowerCase().startsWith('inset');
};

const resolveShadowDefinitionFromCss = (css: string): ShadowDefinition => (
  applyShadowCssToDefinition(css) ?? createDefaultShadow()
);

export const createBorderShadowDefinitionFromShadowCss = (shadowCss: string): BorderShadowDefinition => {
  const base = createDefaultBorderShadow();
  return {
    ...base,
    shadow: resolveShadowDefinitionFromCss(shadowCss),
  };
};

export const buildShadowPreviewStyle = (shadowCss: string): CSSProperties => {
  const trimmed = shadowCss.trim();
  return trimmed ? { boxShadow: trimmed } : {};
};
