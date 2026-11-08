import React from 'react';
import { cn } from '../../lib/utils';
import { ChatMarkdown, type ChatMarkdownTone } from './ChatMarkdown';
import { resolveMarkdownEditorTextDirection, unwrapMarkdownDirComments } from './designerRichTextMarkdownDir';

export type MarkdownPreviewProps = {
  content: string;
  className?: string;
  contentClassName?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  tone?: ChatMarkdownTone;
  emptyFallback?: React.ReactNode;
};

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className,
  contentClassName,
  dir,
  tone = 'assistant',
  emptyFallback = null,
}) => {
  const trimmed = content.trim();
  if (!trimmed) {
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  // Emptiness ignores direction markers; rendering keeps them so ChatMarkdown can
  // apply per-block `dir` (mixed LTR/RTL) instead of one document-level direction.
  const unwrapped = unwrapMarkdownDirComments(trimmed);
  if (!unwrapped.content.trim()) {
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  const resolvedDir = dir === 'auto'
    ? resolveMarkdownEditorTextDirection('auto', trimmed)
    : (dir ?? unwrapped.dir);

  return (
    <div className={cn('markdown-preview', className)}>
      <ChatMarkdown
        content={trimmed}
        tone={tone}
        dir={resolvedDir}
        className={cn('gap-2 text-[12px] leading-relaxed text-slate-700', contentClassName)}
      />
    </div>
  );
};
