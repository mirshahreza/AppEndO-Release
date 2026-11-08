import { Extension } from '@tiptap/core';
import { applyMarkdownDirCommentsToDom } from './designerRichTextMarkdownDir';

export type DesignerTextDirectionValue = 'ltr' | 'rtl';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    designerTextDirection: {
      setTextDirection: (direction: DesignerTextDirectionValue) => ReturnType;
      unsetTextDirection: () => ReturnType;
    };
  }
}

/** Block-level `dir` attribute for RTL/LTR paragraphs, headings, and list items. */
export const DesignerTextDirection = Extension.create({
  name: 'designerTextDirection',

  addOptions() {
    return {
      types: ['heading', 'paragraph', 'blockquote', 'listItem'],
      /** When true, blocks without an explicit ltr/rtl attr render `dir="auto"` (first strong character). */
      autoDir: false,
    };
  },

  addStorage() {
    return {
      markdown: {
        parse: {
          updateDOM: (element: HTMLElement) => {
            applyMarkdownDirCommentsToDom(element);
          },
        },
      },
    };
  },

  addGlobalAttributes() {
    const autoDir = this.options.autoDir === true;
    return [
      {
        types: this.options.types,
        attributes: {
          dir: {
            default: null,
            parseHTML: (element) => {
              const dir = element.getAttribute('dir');
              return dir === 'rtl' || dir === 'ltr' ? dir : null;
            },
            renderHTML: (attributes) => {
              if (attributes.dir === 'rtl' || attributes.dir === 'ltr') {
                return { dir: attributes.dir };
              }
              if (autoDir) {
                return { dir: 'auto' };
              }
              return {};
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextDirection:
        (direction: DesignerTextDirectionValue) =>
          ({ commands }) =>
            this.options.types
              .map((type: string) => commands.updateAttributes(type, { dir: direction }))
              .some(Boolean),

      unsetTextDirection:
        () =>
          ({ commands }) =>
            this.options.types
              .map((type: string) => commands.resetAttributes(type, 'dir'))
              .some(Boolean),
    };
  },
});
