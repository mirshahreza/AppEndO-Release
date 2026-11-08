import { resolveLucideIconNameFromUiHtml } from '../../lib/baseInfoUiIcon';

/** True when `uiHtml` is a single Lucide `<i data-lucide="…">` snippet (TipTap cannot render it). */
export const isLucideOnlyUiHtml = (html: string): boolean => {
  const trimmed = html.trim();
  const lucideName = resolveLucideIconNameFromUiHtml(trimmed);
  if (!lucideName) {
    return false;
  }
  const withoutWhitespace = trimmed.replace(/\s+/g, '');
  return /^<i[^>]*data-lucide=["'][^"']+["'][^>]*(\/>|><\/i>)$/i.test(withoutWhitespace);
};
