import type { PlatformWebFont } from '../../shared/api/contracts/platform/webFonts';
import { WEB_FONT_ID_PREFIX } from '../../shared/api/contracts/platform/webFonts';
import type { CultureFontDefinition } from '../../shared/api/contracts/systemExtensions/types';

let registeredFonts: PlatformWebFont[] = [];

export function setPlatformWebFonts(fonts: PlatformWebFont[]): void {
  registeredFonts = fonts.map((font) => ({ ...font }));
}

export function getPlatformWebFonts(): readonly PlatformWebFont[] {
  return registeredFonts;
}

export function isWebFontId(fontId: string): boolean {
  return fontId.trim().startsWith(WEB_FONT_ID_PREFIX);
}

export function resolveWebFontById(fontId: string): PlatformWebFont | undefined {
  const normalized = fontId.trim();
  return registeredFonts.find((font) => font.id === normalized);
}

export function webFontToCultureFontDefinition(font: PlatformWebFont): CultureFontDefinition {
  return {
    id: font.id,
    label: font.label,
    family: font.family,
    url: font.url,
    format: font.format,
  };
}

export function listWebFontCultureDefinitions(): CultureFontDefinition[] {
  return registeredFonts.map(webFontToCultureFontDefinition);
}
