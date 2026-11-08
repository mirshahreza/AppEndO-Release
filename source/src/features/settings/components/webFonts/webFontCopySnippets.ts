import type { PlatformWebFont, WebFontFileFormat } from '../../../../shared/api/contracts/platform/webFonts';

function cssFormatForFont(format: WebFontFileFormat): string {
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
}

export function buildWebFontFaceCss(
  font: Pick<PlatformWebFont, 'family' | 'url' | 'format'>,
): string {
  return `@font-face {
  font-family: "${font.family}";
  src: url("${font.url}") format("${cssFormatForFont(font.format)}");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}`;
}

export function buildWebFontFamilyStyle(
  font: Pick<PlatformWebFont, 'family'>,
): string {
  return `font-family: "${font.family}", ui-sans-serif, system-ui, sans-serif;`;
}
