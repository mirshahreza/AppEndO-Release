import React, { useMemo } from 'react';
import { Check, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChatCodeBlock } from './ChatCodeBlock';
import {
  isMarkdownTextDir,
  type MarkdownTextDir,
} from './designerRichTextMarkdownDir';

type MarkdownBlock =
  | { type: 'paragraph'; text: string; dir?: MarkdownTextDir }
  | { type: 'heading'; level: number; text: string; dir?: MarkdownTextDir }
  | { type: 'code'; language: string; code: string }
  | { type: 'list'; items: MarkdownListItem[]; dir?: MarkdownTextDir };

type MarkdownListItem = {
  text: string;
  checked?: boolean;
  depth: number;
};

/** Matches serialized `<!-- @dir:rtl|ltr -->` markers from the WYSIWYG markdown store. */
const MARKDOWN_DIR_COMMENT_LINE = /^<!--\s*@dir:(rtl|ltr)\s*-->$/i;

export type ChatMarkdownTone = 'user' | 'assistant';

const INLINE_CODE_PATTERN = /`([^`]+)`/g;
const CHAT_INLINE_CODE_CLASS = 'inline-block rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-left font-mono text-[0.85em] text-slate-800';

const getMarkdownToneStyles = (tone: ChatMarkdownTone) => ({
  paragraph: tone === 'user' ? 'text-slate-800' : 'text-slate-700',
  list: tone === 'user' ? 'text-slate-800' : 'text-slate-700',
  heading1: tone === 'user' ? 'text-slate-900' : 'text-slate-900',
  heading2: tone === 'user' ? 'text-primary-800' : 'text-indigo-800',
  heading3: tone === 'user' ? 'text-primary-700' : 'text-violet-800',
  headingDefault: tone === 'user' ? 'text-slate-800' : 'text-slate-700',
  bold: tone === 'user' ? 'text-slate-900' : 'text-slate-900',
  link: tone === 'user'
    ? 'text-primary-600 underline decoration-primary-500/35 underline-offset-2 hover:text-primary-700'
    : 'text-cyan-700 underline decoration-cyan-300 underline-offset-2 hover:text-cyan-800',
  checkedText: tone === 'user' ? 'text-slate-500' : 'text-slate-500',
});

const parseListLine = (line: string): MarkdownListItem | null => {
  const checkboxMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/);
  if (checkboxMatch) {
    return {
      depth: Math.floor(checkboxMatch[1].replace(/\t/g, '  ').length / 2),
      checked: checkboxMatch[2].toLowerCase() === 'x',
      text: checkboxMatch[3].trim(),
    };
  }

  const listMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
  if (listMatch) {
    return {
      depth: Math.floor(listMatch[1].replace(/\t/g, '  ').length / 2),
      text: listMatch[2].trim(),
    };
  }

  return null;
};

const takePendingDir = (
  pendingDir: { current: MarkdownTextDir | undefined },
): MarkdownTextDir | undefined => {
  const dir = pendingDir.current;
  pendingDir.current = undefined;
  return dir;
};

const splitMarkdownBlocks = (content: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  const parts = content.split(/```/);
  const pendingDir: { current: MarkdownTextDir | undefined } = { current: undefined };

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part) continue;

    if (index % 2 === 1) {
      // Fenced code is always LTR in the renderer; drop a stray dir marker.
      pendingDir.current = undefined;
      const newlineIndex = part.indexOf('\n');
      const language = newlineIndex >= 0 ? part.slice(0, newlineIndex).trim() : '';
      const code = newlineIndex >= 0 ? part.slice(newlineIndex + 1) : part;
      blocks.push({ type: 'code', language, code: code.replace(/\n$/, '') });
      continue;
    }

    const lines = part.split('\n');
    let paragraphBuffer: string[] = [];
    let listBuffer: MarkdownListItem[] | null = null;
    let listDir: MarkdownTextDir | undefined;
    let paragraphDir: MarkdownTextDir | undefined;

    const flushParagraph = () => {
      const text = paragraphBuffer.join('\n').trim();
      if (text) {
        blocks.push({ type: 'paragraph', text, dir: paragraphDir });
      }
      paragraphBuffer = [];
      paragraphDir = undefined;
    };

    const flushList = () => {
      if (listBuffer?.length) {
        blocks.push({ type: 'list', items: listBuffer, dir: listDir });
      }
      listBuffer = null;
      listDir = undefined;
    };

    for (const line of lines) {
      const trimmed = line.trim();
      const dirMatch = trimmed.match(MARKDOWN_DIR_COMMENT_LINE);
      const capturedDir = dirMatch?.[1]?.toLowerCase();
      if (capturedDir && isMarkdownTextDir(capturedDir)) {
        pendingDir.current = capturedDir;
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      const listItem = parseListLine(line);

      if (headingMatch) {
        flushParagraph();
        flushList();
        blocks.push({
          type: 'heading',
          level: headingMatch[1].length,
          text: headingMatch[2].trim(),
          dir: takePendingDir(pendingDir),
        });
        continue;
      }

      if (listItem) {
        flushParagraph();
        if (!listBuffer) {
          listBuffer = [];
          listDir = takePendingDir(pendingDir);
        }
        listBuffer.push(listItem);
        continue;
      }

      flushList();
      if (!trimmed) {
        flushParagraph();
        continue;
      }

      if (!paragraphBuffer.length) {
        paragraphDir = takePendingDir(pendingDir);
      }
      paragraphBuffer.push(line);
    }

    flushParagraph();
    flushList();
  }

  return blocks;
};

const renderTextSegment = (
  text: string,
  keyPrefix: string,
  tone: ChatMarkdownTone,
): React.ReactNode[] => {
  const styles = getMarkdownToneStyles(tone);
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match = pattern.exec(text);
  let index = 0;

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-text-${index}`;
    const boldMatch = token.match(/^\*\*([^*]+)\*\*$/);
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (boldMatch) {
      nodes.push(<strong key={key} className={cn('font-semibold', styles.bold)}>{boldMatch[1]}</strong>);
    } else if (linkMatch) {
      nodes.push(
        <a
          key={key}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className={styles.link}
        >
          {linkMatch[1]}
        </a>,
      );
    } else {
      nodes.push(token);
    }

    lastIndex = match.index + token.length;
    index += 1;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length ? nodes : [text];
};

const renderInlineMarkdown = (
  text: string,
  keyPrefix: string,
  tone: ChatMarkdownTone,
): React.ReactNode[] => {
  const parts = text.split(INLINE_CODE_PATTERN);
  if (parts.length === 1) {
    return renderTextSegment(text, keyPrefix, tone);
  }

  const nodes: React.ReactNode[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part) continue;
    if (index % 2 === 1) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${index}`}
          dir="ltr"
          className={CHAT_INLINE_CODE_CLASS}
        >
          {part}
        </code>,
      );
      continue;
    }
    nodes.push(...renderTextSegment(part, `${keyPrefix}-text-${index}`, tone));
  }
  return nodes;
};

const renderParagraph = (
  text: string,
  key: string,
  tone: ChatMarkdownTone,
  dir?: MarkdownTextDir,
) => {
  const styles = getMarkdownToneStyles(tone);
  return (
    <p
      key={key}
      dir={dir}
      className={cn('whitespace-pre-wrap break-words text-xs leading-relaxed', styles.paragraph)}
    >
      {renderInlineMarkdown(text, key, tone)}
    </p>
  );
};

const renderListItem = (item: MarkdownListItem, key: string, tone: ChatMarkdownTone) => {
  const styles = getMarkdownToneStyles(tone);
  const paddingClass = item.depth > 0 ? `ps-${Math.min(item.depth * 4, 12)}` : '';

  if (item.checked !== undefined) {
    return (
      <li
        key={key}
        className={cn('flex items-start gap-2 leading-relaxed', paddingClass)}
        style={item.depth > 0 ? { marginInlineStart: `${item.depth * 16}px` } : undefined}
      >
        <span className="mt-0.5 shrink-0" aria-hidden="true">
          {item.checked ? (
            <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
          ) : (
            <Square className="h-4 w-4 text-slate-400" strokeWidth={2} />
          )}
        </span>
        <span className={cn(item.checked && cn(styles.checkedText, 'line-through'))}>
          {renderInlineMarkdown(item.text, key, tone)}
        </span>
      </li>
    );
  }

  return (
    <li
      key={key}
      className="leading-relaxed"
      style={item.depth > 0 ? { marginInlineStart: `${item.depth * 16}px` } : undefined}
    >
      {renderInlineMarkdown(item.text, key, tone)}
    </li>
  );
};

type ChatMarkdownProps = {
  content: string;
  className?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  tone?: ChatMarkdownTone;
  /** Current editor source — full handler dumps render as a changed-line diff. */
  diffAgainst?: string;
};

export const ChatMarkdown: React.FC<ChatMarkdownProps> = ({
  content,
  className,
  dir,
  tone = 'assistant',
  diffAgainst,
}) => {
  const blocks = useMemo(() => splitMarkdownBlocks(content), [content]);
  const styles = getMarkdownToneStyles(tone);

  if (!blocks.length) {
    return null;
  }

  return (
    <div dir={dir} className={cn('flex min-w-0 max-w-full flex-col gap-3 select-text', className)}>
      {blocks.map((block, index) => {
        const key = `md-block-${index}`;
        if (block.type === 'heading') {
          const headingClass = block.level === 1
            ? cn('text-sm font-bold', styles.heading1)
            : block.level === 2
              ? cn('mt-1 text-xs font-bold uppercase tracking-wide', styles.heading2)
              : block.level === 3
                ? cn('mt-1 text-xs font-semibold', styles.heading3)
                : cn('text-xs font-medium', styles.headingDefault);
          return (
            <div key={key} dir={block.dir} className={headingClass}>
              {renderInlineMarkdown(block.text, key, tone)}
            </div>
          );
        }
        if (block.type === 'code') {
          return (
            <ChatCodeBlock
              key={key}
              code={block.code}
              language={block.language}
              diffAgainst={diffAgainst}
            />
          );
        }
        if (block.type === 'list') {
          const hasCheckboxes = block.items.some((item) => item.checked !== undefined);
          return (
            <ul
              key={key}
              dir={block.dir}
              className={cn(
                'space-y-1.5 text-xs',
                styles.list,
                !hasCheckboxes && 'list-disc ps-5',
              )}
            >
              {block.items.map((item, itemIndex) => renderListItem(item, `${key}-item-${itemIndex}`, tone))}
            </ul>
          );
        }
        return renderParagraph(block.text, key, tone, block.dir);
      })}
    </div>
  );
};
