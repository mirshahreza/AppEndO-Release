import type { MarkdownSerializerState } from 'prosemirror-markdown';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import Blockquote from '@tiptap/extension-blockquote';
import ListItem from '@tiptap/extension-list-item';
import { defaultMarkdownSerializer } from 'prosemirror-markdown';
import type { Extensions } from '@tiptap/react';
import { getContentTextDirection } from '../lib/textDirection';

export type MarkdownTextDir = 'ltr' | 'rtl';

/** Persisted immediately above a directed block so markdown round-trips keep `dir`. */
export const MARKDOWN_DIR_COMMENT_PATTERN = /<!--\s*@dir:(rtl|ltr)\s*-->/gi;

const DIR_COMMENT_BODY_PATTERN = /^@dir:(rtl|ltr)$/;

export const isMarkdownTextDir = (value: unknown): value is MarkdownTextDir =>
  value === 'rtl' || value === 'ltr';

export const markdownDirComment = (dir: MarkdownTextDir): string => `<!-- @dir:${dir} -->`;

/**
 * Apply `<!-- @dir:rtl|ltr -->` comments in parsed HTML to the following element,
 * then remove the comments. Used by tiptap-markdown `parse.updateDOM`.
 */
export const applyMarkdownDirCommentsToDom = (root: HTMLElement): void => {
  const visit = (node: ParentNode): void => {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType === Node.COMMENT_NODE) {
        const match = (child.textContent ?? '').trim().match(DIR_COMMENT_BODY_PATTERN);
        if (!match || !isMarkdownTextDir(match[1])) {
          continue;
        }
        let next: ChildNode | null = child.nextSibling;
        while (
          next
          && next.nodeType === Node.TEXT_NODE
          && !(next.textContent ?? '').trim()
        ) {
          next = next.nextSibling;
        }
        if (next && next.nodeType === Node.ELEMENT_NODE) {
          (next as Element).setAttribute('dir', match[1]);
        }
        child.parentNode?.removeChild(child);
        continue;
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        visit(child as ParentNode);
      }
    }
  };
  visit(root);
};

type DefaultSerialize = (
  state: MarkdownSerializerState,
  node: ProseMirrorNode,
  parent: ProseMirrorNode,
  index: number,
) => void;

const serializeWithDirComment = (defaultSerialize: DefaultSerialize) =>
  function serialize(
    this: { editor?: { storage?: { markdown?: { options?: { html?: boolean } } } } },
    state: MarkdownSerializerState,
    node: ProseMirrorNode,
    parent: ProseMirrorNode,
    index: number,
  ): void {
    const dir = node.attrs.dir;
    if (isMarkdownTextDir(dir) && this.editor?.storage?.markdown?.options?.html !== false) {
      state.write(`${markdownDirComment(dir)}\n`);
    }
    defaultSerialize(state, node, parent, index);
  };

/**
 * Node extensions that emit `<!-- @dir:… -->` markers above directed blocks.
 * Pair with `html: true` on `tiptap-markdown` so comments survive parse.
 */
export const buildMarkdownDirNodeExtensions = (options: {
  heading: boolean;
  blockquote: boolean;
}): Extensions => {
  const extensions: Extensions = [
    Paragraph.extend({
      addStorage() {
        return {
          markdown: {
            serialize: serializeWithDirComment(defaultMarkdownSerializer.nodes.paragraph),
            parse: {},
          },
        };
      },
    }),
    ListItem.extend({
      addStorage() {
        return {
          markdown: {
            serialize: serializeWithDirComment(defaultMarkdownSerializer.nodes.list_item),
            parse: {},
          },
        };
      },
    }),
  ];

  if (options.heading) {
    extensions.push(Heading.extend({
      addStorage() {
        return {
          markdown: {
            serialize: serializeWithDirComment(defaultMarkdownSerializer.nodes.heading),
            parse: {},
          },
        };
      },
    }).configure({ levels: [1, 2, 3] }));
  }

  if (options.blockquote) {
    extensions.push(Blockquote.extend({
      addStorage() {
        return {
          markdown: {
            serialize: serializeWithDirComment(defaultMarkdownSerializer.nodes.blockquote),
            parse: {},
          },
        };
      },
    }));
  }

  return extensions;
};

/**
 * Strip dir comments and return the first explicit dir if any.
 * Prefer keeping comments in ChatMarkdown/MarkdownPreview so each block can keep its own `dir`.
 */
export const unwrapMarkdownDirComments = (
  content: string,
): { content: string; dir?: MarkdownTextDir } => {
  let dir: MarkdownTextDir | undefined;
  const next = content
    .replace(MARKDOWN_DIR_COMMENT_PATTERN, (_full, captured: string) => {
      if (!dir && isMarkdownTextDir(captured)) {
        dir = captured;
      }
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*\n/, '')
    .replace(/\n\s*$/, '');
  return { content: next, dir };
};

/**
 * Editor chrome direction: explicit `ltr`/`rtl` wins; otherwise first meaningful
 * character of the markdown body (dir comments stripped so they cannot fake LTR).
 */
export type ResolveMarkdownEditorTextDirectionOptions = {
  /** Placeholder copy — when the body is empty, RTL-dominant placeholder implies RTL chrome. */
  placeholder?: string;
  /** Active culture direction — empty `auto` fields inherit culture (same as UiInput / UiTextarea). */
  cultureDirection?: 'ltr' | 'rtl';
};

export const resolveMarkdownEditorTextDirection = (
  dir: MarkdownTextDir | 'auto' | undefined,
  markdown: string,
  options?: ResolveMarkdownEditorTextDirectionOptions,
): MarkdownTextDir => {
  if (isMarkdownTextDir(dir)) {
    return dir;
  }
  const body = unwrapMarkdownDirComments(markdown).content.trim();
  if (body) {
    return getContentTextDirection(body);
  }
  const placeholder = (options?.placeholder ?? '').trim();
  if (placeholder) {
    return getContentTextDirection(placeholder);
  }
  if (options?.cultureDirection === 'rtl' || options?.cultureDirection === 'ltr') {
    return options.cultureDirection;
  }
  return 'ltr';
};
