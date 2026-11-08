import { isLucideOnlyUiHtml } from '../ui/html-editor/uiHtmlLucide';

export const isVisuallyEmptyRichTextHtml = (html: string): boolean => {
  const trimmed = html.trim();
  if (!trimmed) {
    return true;
  }
  if (trimmed === '<p></p>') {
    return true;
  }
  if (/^<p><(?:em|i|strong|u|s)(?:\s[^>]*)?><\/(?:em|i|strong|u|s)><\/p>$/i.test(trimmed)) {
    return true;
  }
  return /^<p><br[^>]*\/?><\/p>$/i.test(trimmed);
};

/**
 * TipTap cannot represent some trusted HTML (e.g. Lucide `<i>`). Do not push an empty
 * visual document upstream or the stored HTML is wiped and Source/Monaco go blank.
 */
export const shouldPreserveExternalHtmlOnVisualUpdate = (
  externalHtml: string,
  visualHtml: string,
): boolean => {
  const external = externalHtml.trim();
  if (!external) {
    return false;
  }
  if (!isVisuallyEmptyRichTextHtml(visualHtml)) {
    return false;
  }
  if (isLucideOnlyUiHtml(external)) {
    return true;
  }
  if (/<[a-z][\s/>]/i.test(external) && !/<p[\s>]/i.test(external) && !/<h[1-6][\s>]/i.test(external)) {
    return true;
  }
  return false;
};
