import Italic from '@tiptap/extension-italic';

/** Italic that does not swallow Base Info / catalog `<i data-lucide="…">` icon markup. */
export const DesignerItalicLucideSafe = Italic.extend({
  parseHTML() {
    return [
      { tag: 'em' },
      {
        tag: 'i',
        getAttrs: (node) => {
          if (typeof node === 'object' && node !== null && 'getAttribute' in node) {
            const element = node as HTMLElement;
            if (element.getAttribute('data-lucide')) {
              return false;
            }
          }
          return null;
        },
      },
    ];
  },
});
