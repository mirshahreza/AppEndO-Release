import { Node, mergeAttributes } from '@tiptap/core';

/** Preserves Base Info-style `<i data-lucide="…">` markup in TipTap visual + getHTML(). */
export const DesignerLucideIcon = Node.create({
  name: 'designerLucideIcon',
  priority: 1000,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      icon: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-lucide'),
        renderHTML: (attributes) => (
          attributes.icon ? { 'data-lucide': attributes.icon } : {}
        ),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'i[data-lucide]',
        getAttrs: (element) => {
          const icon = element.getAttribute('data-lucide');
          return icon ? { icon } : false;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'i',
      mergeAttributes(HTMLAttributes, {
        class: 'designer-lucide-icon-chip',
        'data-lucide': node.attrs.icon,
      }),
    ];
  },
});
