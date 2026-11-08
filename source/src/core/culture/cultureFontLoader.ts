import type { CultureFontDefinition, CultureTypography } from '../../shared/api/contracts/systemExtensions/types';
import { resolveCultureFontDefinition } from './cultureTypographyMerge';

const OPTIONAL_FONT_WEIGHTS = [500, 600, 700] as const;
const DEFAULT_BOOT_FONT_WEIGHT = 400;

type FontWeightImport = () => Promise<unknown>;
type FontWeightImports = Partial<Record<number, FontWeightImport>>;

const FONT_FACE_IMPORTS: Record<string, FontWeightImports> = {
  inter: {
    400: () => import('@fontsource/inter/400.css'),
    500: () => import('@fontsource/inter/500.css'),
    600: () => import('@fontsource/inter/600.css'),
    700: () => import('@fontsource/inter/700.css'),
  },
  'source-sans-3': {
    400: () => import('@fontsource/source-sans-3/400.css'),
    500: () => import('@fontsource/source-sans-3/500.css'),
    600: () => import('@fontsource/source-sans-3/600.css'),
    700: () => import('@fontsource/source-sans-3/700.css'),
  },
  'ibm-plex-sans': {
    400: () => import('@fontsource/ibm-plex-sans/400.css'),
    500: () => import('@fontsource/ibm-plex-sans/500.css'),
    600: () => import('@fontsource/ibm-plex-sans/600.css'),
    700: () => import('@fontsource/ibm-plex-sans/700.css'),
  },
  vazirmatn: {
    400: () => import('@fontsource/vazirmatn/400.css'),
    500: () => import('@fontsource/vazirmatn/500.css'),
    600: () => import('@fontsource/vazirmatn/600.css'),
    700: () => import('@fontsource/vazirmatn/700.css'),
  },
  parastoo: {
    400: () => import('@fontsource/parastoo/400.css'),
    500: () => import('@fontsource/parastoo/500.css'),
    600: () => import('@fontsource/parastoo/600.css'),
    700: () => import('@fontsource/parastoo/700.css'),
  },
  'noto-sans-arabic': {
    400: () => import('@fontsource/noto-sans-arabic/400.css'),
    500: () => import('@fontsource/noto-sans-arabic/500.css'),
    600: () => import('@fontsource/noto-sans-arabic/600.css'),
    700: () => import('@fontsource/noto-sans-arabic/700.css'),
  },
  'ibm-plex-sans-arabic': {
    400: () => import('@fontsource/ibm-plex-sans-arabic/400.css'),
    500: () => import('@fontsource/ibm-plex-sans-arabic/500.css'),
    600: () => import('@fontsource/ibm-plex-sans-arabic/600.css'),
    700: () => import('@fontsource/ibm-plex-sans-arabic/700.css'),
  },
  rubik: {
    400: () => import('@fontsource/rubik/400.css'),
    500: () => import('@fontsource/rubik/500.css'),
    600: () => import('@fontsource/rubik/600.css'),
    700: () => import('@fontsource/rubik/700.css'),
  },
};

const loadedCultureFontKeys = new Set<string>();

function resolveDefaultFont(typography: CultureTypography | undefined): CultureFontDefinition | undefined {
  if (!typography) {
    return undefined;
  }

  const fromTypography = typography.fonts.find((font) => font.id === typography.defaultFontId)
    ?? typography.fonts[0];
  if (fromTypography) {
    return fromTypography;
  }

  return resolveCultureFontDefinition(typography.defaultFontId);
}

export function resolveCultureFontFamily(typography: CultureTypography | undefined): string | undefined {
  const defaultFont = resolveDefaultFont(typography);
  if (!defaultFont) {
    return undefined;
  }

  return `"${defaultFont.family}", ui-sans-serif, system-ui, sans-serif`;
}

const cssFormatForFont = (format: CultureFontDefinition['format']): string => {
  switch (format) {
    case 'woff2':
      return 'woff2';
    case 'woff':
      return 'woff';
    case 'otf':
      return 'opentype';
    default:
      return 'truetype';
  }
};

const injectCustomFontFace = (font: CultureFontDefinition): void => {
  if (!font.url || !font.format || typeof document === 'undefined') {
    return;
  }

  const styleId = `platform-web-font-${font.id}`;
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
@font-face {
  font-family: "${font.family}";
  src: url("${font.url}") format("${cssFormatForFont(font.format)}");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
`.trim();
  document.head.appendChild(style);
};

const loadFontWeight = async (fontId: string, weight: number): Promise<void> => {
  const weightImports = FONT_FACE_IMPORTS[fontId];
  if (!weightImports) {
    return;
  }

  const cacheKey = `${fontId}:${weight}`;
  if (loadedCultureFontKeys.has(cacheKey)) {
    return;
  }

  const importFn = weightImports[weight];
  if (!importFn) {
    return;
  }

  await importFn();
  loadedCultureFontKeys.add(cacheKey);
};

const loadCustomFont = async (font: CultureFontDefinition): Promise<void> => {
  const cacheKey = `custom:${font.id}`;
  if (loadedCultureFontKeys.has(cacheKey)) {
    return;
  }

  injectCustomFontFace(font);
  loadedCultureFontKeys.add(cacheKey);

  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.load(`400 16px "${font.family}"`);
    } catch {
      // Best-effort preload — CSS @font-face still applies.
    }
  }
};

const loadDefaultFont = async (font: CultureFontDefinition): Promise<void> => {
  if (FONT_FACE_IMPORTS[font.id]) {
    await loadFontWeight(font.id, DEFAULT_BOOT_FONT_WEIGHT);
    return;
  }

  if (font.url) {
    await loadCustomFont(font);
  }
};

export async function loadCultureFonts(typography: CultureTypography | undefined): Promise<void> {
  const defaultFont = resolveDefaultFont(typography);
  if (!defaultFont) {
    return;
  }

  await loadDefaultFont(defaultFont);
}

export async function loadCultureFontWeights(
  typography: CultureTypography | undefined,
  weights: readonly number[] = OPTIONAL_FONT_WEIGHTS,
): Promise<void> {
  const defaultFont = resolveDefaultFont(typography);
  if (!defaultFont) {
    return;
  }

  if (FONT_FACE_IMPORTS[defaultFont.id]) {
    await Promise.all(weights.map((weight) => loadFontWeight(defaultFont.id, weight)));
    return;
  }

  await loadDefaultFont(defaultFont);
}

export function getKnownCultureFontIds(): readonly string[] {
  return Object.keys(FONT_FACE_IMPORTS);
}
