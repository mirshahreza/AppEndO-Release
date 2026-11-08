import React, { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { sanitizeDesignerHtml } from '../../../domain/component-designer/sanitizeDesignerHtml';
import {
  HTML_EDITOR_PREVIEW_DEVICE_WIDTH,
  type HtmlEditorPreviewDevice,
} from './types';

export type HtmlPreviewProps = {
  html: string;
  className?: string;
  contentClassName?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  device?: HtmlEditorPreviewDevice;
  emptyFallback?: React.ReactNode;
  title?: string;
};

const buildPreviewDocument = (bodyHtml: string, dir: 'ltr' | 'rtl' | 'auto'): string => {
  const dirAttr = dir === 'auto' ? '' : ` dir="${dir}"`;
  return `<!DOCTYPE html>
<html${dirAttr}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #0f172a;
    font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  }
  body { padding: 12px 14px; word-wrap: break-word; overflow-wrap: anywhere; }
  img, video, iframe { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; }
  pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  pre { overflow: auto; padding: 10px; background: #f8fafc; border-radius: 6px; }
  blockquote {
    margin: 0.75em 0;
    padding: 0.25em 0 0.25em 0.85em;
    border-inline-start: 3px solid #cbd5e1;
    color: #475569;
  }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
};

export const HtmlPreview: React.FC<HtmlPreviewProps> = ({
  html,
  className,
  contentClassName,
  dir = 'ltr',
  device = 'fluid',
  emptyFallback = null,
  title = 'HTML preview',
}) => {
  const sanitized = useMemo(() => sanitizeDesignerHtml(html ?? ''), [html]);
  const isEmpty = sanitized.replace(/<[^>]*>/g, '').trim().length === 0
    && !/<img\b|<table\b|<hr\b|<video\b|<iframe\b/i.test(sanitized);

  const srcDoc = useMemo(
    () => buildPreviewDocument(sanitized, dir),
    [sanitized, dir],
  );

  if (isEmpty) {
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  const maxWidth = device === 'fluid'
    ? undefined
    : HTML_EDITOR_PREVIEW_DEVICE_WIDTH[device];

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 justify-center overflow-auto bg-slate-50',
        className,
      )}
      data-html-preview="true"
    >
      <div
        className={cn(
          'min-h-0 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm',
          contentClassName,
        )}
        style={maxWidth ? { maxWidth, width: '100%' } : { width: '100%' }}
      >
        <iframe
          title={title}
          srcDoc={srcDoc}
          sandbox=""
          className="block h-full min-h-[200px] w-full border-0 bg-white"
          style={{ minHeight: '100%' }}
        />
      </div>
    </div>
  );
};
