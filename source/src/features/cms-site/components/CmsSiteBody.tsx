import React from 'react';
import { sanitizeDesignerHtml } from '../../../domain/component-designer/sanitizeDesignerHtml';
import type { CmsPublicContent } from '../../../shared/api/contracts/cms-site/types';
import { formatDisplayDateYmd } from '../../../shared/lib/gridDateFormat';

export function formatSiteDate(value: string | null | undefined): string {
  return formatDisplayDateYmd(value?.trim() ?? null, '');
}

export function storyKicker(contentType: string): string {
  const type = contentType.trim().toLowerCase();
  if (type === 'news') {
    return 'News';
  }
  if (type === 'howto') {
    return 'How to';
  }
  if (type === 'article') {
    return 'Guide';
  }
  if (type === 'page') {
    return 'Page';
  }
  if (type === 'gallery') {
    return 'Gallery';
  }
  if (type === 'announcement') {
    return 'Announcement';
  }
  return contentType.trim() || 'Note';
}

export function languageLabel(code: string): string {
  const normalized = code.trim().toLowerCase();
  if (normalized === 'en') {
    return 'English';
  }
  if (normalized === 'fa') {
    return 'Persian';
  }
  if (normalized === 'ar') {
    return 'Arabic';
  }
  return code.trim() || 'English';
}

const escapeHtml = (value: string): string => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
);

const markdownHref = (href: string): string | null => {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('//')) {
    return null;
  }
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) {
    return escapeHtml(trimmed);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return escapeHtml(trimmed);
  }
  return null;
};

const inlineMarkdown = (value: string): string => (
  escapeHtml(value)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_full, label: string, href: string) => {
      const safe = markdownHref(href);
      if (!safe) {
        return escapeHtml(label);
      }
      return `<a href="${safe}">${label}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
);

export function markdownToSafeHtml(source: string): string {
  const blocks = source.trim().split(/\n{2,}/);
  return blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) {
      return '';
    }
    if (/^###\s+/.test(trimmed)) {
      return `<h3>${inlineMarkdown(trimmed.replace(/^###\s+/, ''))}</h3>`;
    }
    if (/^##\s+/.test(trimmed)) {
      return `<h3>${inlineMarkdown(trimmed.replace(/^##\s+/, ''))}</h3>`;
    }
    if (/^#\s+/.test(trimmed)) {
      return `<h3>${inlineMarkdown(trimmed.replace(/^#\s+/, ''))}</h3>`;
    }
    if (/^[-*]\s+/m.test(trimmed)) {
      const items = trimmed.split('\n').filter((line) => /^[-*]\s+/.test(line.trim()));
      return `<ul>${items.map((item) => `<li>${inlineMarkdown(item.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    }
    if (/^\d+\.\s+/m.test(trimmed)) {
      const items = trimmed.split('\n').filter((line) => /^\d+\.\s+/.test(line.trim()));
      return `<ol>${items.map((item) => `<li>${inlineMarkdown(item.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`;
    }
    return `<p>${inlineMarkdown(trimmed).replace(/\n/g, '<br />')}</p>`;
  }).join('');
}

export const CmsSiteBody: React.FC<{ content: Pick<CmsPublicContent, 'body' | 'bodyFormat'> }> = ({
  content,
}) => {
  const body = content.body.trim();
  if (!body) {
    return null;
  }
  if (content.bodyFormat === 'html') {
    return <div className="site-prose" dangerouslySetInnerHTML={{ __html: sanitizeDesignerHtml(body) }} />;
  }
  if (content.bodyFormat === 'markdown') {
    return <div className="site-prose" dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(body) }} />;
  }
  return (
    <div className="site-prose" style={{ whiteSpace: 'pre-wrap' }}>
      {body}
    </div>
  );
};
