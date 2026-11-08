import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import type { Extensions } from '@tiptap/react';
import type { DesignerRichTextToolbarConfig } from '../lib/designerRichTextConfig';
import { buildMarkdownDirNodeExtensions } from './designerRichTextMarkdownDir';
import { DesignerTextDirection } from './designerRichTextTextDirection';
import { DesignerLucideIcon } from './designerRichTextLucideIcon';
import { DesignerItalicLucideSafe } from './designerRichTextItalicLucideSafe';

export const buildDesignerRichTextExtensions = (
  toolbar: DesignerRichTextToolbarConfig,
  placeholder: string,
  readOnly: boolean,
  options?: { autoDir?: boolean },
): Extensions => {
  const persistTextDirection = toolbar.textDirection;
  const extensions: Extensions = [
    DesignerLucideIcon,
    StarterKit.configure({
      bold: toolbar.bold ? {} : false,
      italic: false,
      strike: toolbar.strike ? {} : false,
      code: toolbar.inlineCode ? {} : false,
      // When direction persists via markdown comments, replace these StarterKit nodes
      // with serializers that emit `<!-- @dir:… -->` markers.
      paragraph: persistTextDirection ? false : {},
      heading: toolbar.heading
        ? (persistTextDirection ? false : { levels: [1, 2, 3] })
        : false,
      bulletList: toolbar.bulletList ? {} : false,
      orderedList: toolbar.orderedList ? {} : false,
      listItem: persistTextDirection ? false : {},
      blockquote: toolbar.blockquote
        ? (persistTextDirection ? false : {})
        : false,
      codeBlock: toolbar.codeBlock ? {} : false,
      horizontalRule: toolbar.horizontalRule ? {} : false,
    }),
  ];

  if (persistTextDirection) {
    extensions.push(...buildMarkdownDirNodeExtensions({
      heading: toolbar.heading,
      blockquote: toolbar.blockquote,
    }));
  }

  if (toolbar.italic) {
    extensions.push(DesignerItalicLucideSafe);
  }

  if (toolbar.underline) {
    extensions.push(Underline);
  }

  if (toolbar.subscript) {
    extensions.push(Subscript);
  }

  if (toolbar.superscript) {
    extensions.push(Superscript);
  }

  if (toolbar.textColor) {
    extensions.push(TextStyle, Color);
  }

  if (toolbar.link) {
    extensions.push(Link.configure({
      openOnClick: !readOnly,
      autolink: true,
      defaultProtocol: 'https',
      HTMLAttributes: {
        rel: 'noopener noreferrer nofollow',
        target: '_blank',
      },
    }));
  }

  if (toolbar.textAlign) {
    extensions.push(TextAlign.configure({
      types: ['heading', 'paragraph'],
    }));
  }

  if (toolbar.textDirection) {
    extensions.push(DesignerTextDirection.configure({
      autoDir: options?.autoDir === true,
    }));
  }

  if (toolbar.highlight) {
    extensions.push(Highlight.configure({
      multicolor: false,
    }));
  }

  if (toolbar.image) {
    extensions.push(Image.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: {
        class: 'designer-rich-text-image',
      },
    }));
  }

  if (toolbar.table) {
    extensions.push(
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
    );
  }

  if (toolbar.taskList) {
    extensions.push(
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    );
  }

  extensions.push(Placeholder.configure({
    placeholder,
  }));

  return extensions;
};
