import { normalizeHexColor } from './uiColorUtils';

export type RgbColor = { r: number; g: number; b: number };
export type HslColor = { h: number; s: number; l: number };
export type RgbaColor = RgbColor & { a: number };

export const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

export const hexToRgb = (hex: string): RgbColor | null => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return null;
  }
  const raw = normalized.slice(1);
  if (raw.length === 3) {
    return {
      r: Number.parseInt(raw[0] + raw[0], 16),
      g: Number.parseInt(raw[1] + raw[1], 16),
      b: Number.parseInt(raw[2] + raw[2], 16),
    };
  }
  if (raw.length !== 6) {
    return null;
  }
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (channel: number) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

export const rgbToHsl = ({ r, g, b }: RgbColor): HslColor => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

export const hslToRgb = ({ h, s, l }: HslColor): RgbColor => {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (h < 60) {
    rn = c; gn = x;
  } else if (h < 120) {
    rn = x; gn = c;
  } else if (h < 180) {
    gn = c; bn = x;
  } else if (h < 240) {
    gn = x; bn = c;
  } else if (h < 300) {
    rn = x; bn = c;
  } else {
    rn = c; bn = x;
  }

  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255),
  };
};

export const hexToHsl = (hex: string): HslColor | null => {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb) : null;
};

export const hslToHex = (hsl: HslColor): string => rgbToHex(...Object.values(hslToRgb(hsl)) as [number, number, number]);

export const parseRgba = (value: string): RgbaColor | null => {
  const trimmed = value.trim();
  const match = trimmed.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (!match) {
    return null;
  }
  const [, r, g, b, a] = match;
  return {
    r: clamp(Number(r), 0, 255),
    g: clamp(Number(g), 0, 255),
    b: clamp(Number(b), 0, 255),
    a: a == null ? 1 : clamp(Number(a), 0, 1),
  };
};

/** Parse hex, transparent, comma-rgb, and modern space-separated `rgb(r g b / a)`. */
export const parseCssColor = (value: string): RgbaColor | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.toLowerCase() === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const normalized = normalizeHexColor(trimmed);
  if (normalized) {
    const rgb = hexToRgb(normalized);
    return rgb ? { ...rgb, a: 1 } : null;
  }

  const modernRgb = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/i,
  );
  if (modernRgb) {
    return {
      r: clamp(Number(modernRgb[1]), 0, 255),
      g: clamp(Number(modernRgb[2]), 0, 255),
      b: clamp(Number(modernRgb[3]), 0, 255),
      a: modernRgb[4] == null ? 1 : clamp(Number(modernRgb[4]), 0, 1),
    };
  }

  return parseRgba(trimmed);
};

export const rgbaToCss = ({ r, g, b, a }: RgbaColor): string => (
  a >= 1 ? rgbToHex(r, g, b) : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(2))})`
);

export const colorToHex = (value: string, fallback = '#000000'): string => {
  const parsed = parseCssColor(value);
  if (parsed) {
    return rgbToHex(parsed.r, parsed.g, parsed.b);
  }
  const normalized = normalizeHexColor(value);
  if (normalized) {
    return normalized.toUpperCase();
  }
  return fallback;
};

export const interpolateColor = (from: string, to: string, t: number): string => {
  const start = colorToRgba(from);
  const end = colorToRgba(to);
  const ratio = clamp(t, 0, 1);
  return rgbToHex(
    start.r + (end.r - start.r) * ratio,
    start.g + (end.g - start.g) * ratio,
    start.b + (end.b - start.b) * ratio,
  );
};

export const colorToRgba = (value: string, alpha = 1): RgbaColor => {
  const parsed = parseCssColor(value);
  if (parsed) {
    return parsed;
  }
  const rgb = hexToRgb(colorToHex(value, '#000000')) ?? { r: 0, g: 0, b: 0 };
  return { ...rgb, a: alpha };
};

export type ColorFormat = 'hex' | 'rgb' | 'hsl';

export const formatColorValue = (
  value: string,
  format: ColorFormat,
  alpha = 1,
): string => {
  const rgba = colorToRgba(value, alpha);
  if (format === 'rgb') {
    return alpha < 1
      ? `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${Number(alpha.toFixed(2))})`
      : `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`;
  }
  if (format === 'hsl') {
    const hsl = rgbToHsl(rgba);
    return alpha < 1
      ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${Number(alpha.toFixed(2))})`
      : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  }
  return alpha < 1 ? rgbaToCss(rgba) : rgbToHex(rgba.r, rgba.g, rgba.b);
};

export const parseColorInput = (raw: string): { hex: string; alpha: number } | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = normalizeHexColor(trimmed);
  if (normalized) {
    return { hex: normalized.toUpperCase(), alpha: 1 };
  }
  const rgba = parseRgba(trimmed);
  if (rgba) {
    return { hex: rgbToHex(rgba.r, rgba.g, rgba.b), alpha: rgba.a };
  }
  const hslMatch = trimmed.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (hslMatch) {
    const [, h, s, l, a] = hslMatch;
    const hex = hslToHex({
      h: Number(h),
      s: Number(s),
      l: Number(l),
    });
    return { hex, alpha: a == null ? 1 : clamp(Number(a), 0, 1) };
  }
  const rgbMatch = trimmed.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgbMatch) {
    const [, r, g, b, a] = rgbMatch;
    return {
      hex: rgbToHex(Number(r), Number(g), Number(b)),
      alpha: a == null ? 1 : clamp(Number(a), 0, 1),
    };
  }
  return null;
};

export const DEFAULT_COLOR_PRESETS = [
  '#0F172A', '#334155', '#64748B', '#94A3B8', '#E2E8F0', '#FFFFFF',
  '#7C3AED', '#6366F1', '#2563EB', '#0891B2', '#059669', '#CA8A04',
  '#EA580C', '#DC2626', '#DB2777', '#C026D3', '#00A28A', '#14B8A6',
] as const;
