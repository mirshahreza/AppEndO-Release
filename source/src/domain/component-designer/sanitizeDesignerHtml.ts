import DOMPurify from 'isomorphic-dompurify';

const DESIGNER_HTML_PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['style', 'target', 'rel', 'colspan', 'rowspan', 'data-type', 'data-checked', 'dir'],
  ALLOWED_STYLES: {
    '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^rgba\(/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^rgba\(/i],
      'text-align': [/^(left|right|center|justify)$/],
    },
  },
} as const;

/**
 * Sanitize HTML from the designer rich text editor before canvas preview, runtime, or TSX export.
 * Strips script tags, event handlers, and other XSS vectors while preserving safe markup.
 */
export const sanitizeDesignerHtml = (html: string): string => {
  if (typeof html !== 'string' || html.length === 0) {
    return '';
  }

  return DOMPurify.sanitize(html, DESIGNER_HTML_PURIFY_CONFIG);
};
