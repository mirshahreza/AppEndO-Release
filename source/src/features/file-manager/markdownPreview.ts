import DOMPurify from 'isomorphic-dompurify';

const MARKDOWN_PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr', 'ul', 'ol', 'li',
    'blockquote', 'pre', 'code', 'strong', 'em', 'a',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
};

const escapeHtml = (value: string): string => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
);

const formatInlineMarkdown = (value: string): string => (
  escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
);

const renderMarkdownBlocks = (source: string): string => {
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/);
  const htmlBlocks: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) {
      continue;
    }

    const codeMatch = trimmed.match(/^```(?:[\w-]+)?\n([\s\S]*?)```$/);
    if (codeMatch) {
      htmlBlocks.push(`<pre><code>${escapeHtml(codeMatch[1].trimEnd())}</code></pre>`);
      continue;
    }

    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      htmlBlocks.push('<hr />');
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      htmlBlocks.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = trimmed.split('\n').map((line) => line.replace(/^>\s?/, ''));
      htmlBlocks.push(`<blockquote><p>${quoteLines.map((line) => formatInlineMarkdown(line)).join('<br />')}</p></blockquote>`);
      continue;
    }

    const lines = trimmed.split('\n');
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      htmlBlocks.push(`<ul>${lines.map((line) => `<li>${formatInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`);
      continue;
    }

    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      htmlBlocks.push(`<ol>${lines.map((line) => `<li>${formatInlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`);
      continue;
    }

    htmlBlocks.push(`<p>${lines.map((line) => formatInlineMarkdown(line)).join('<br />')}</p>`);
  }

  return htmlBlocks.join('');
};

export const isFileManagerMarkdownLanguage = (language: string | null | undefined): boolean => (
  language === 'markdown'
);

export const renderFileManagerMarkdownHtml = (source: string): string => {
  const html = renderMarkdownBlocks(source.trim() ? source : '');
  return DOMPurify.sanitize(html, MARKDOWN_PURIFY_CONFIG);
};
