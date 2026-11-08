const BLOCK_TAGS = /<(script|style|noscript|svg|iframe|object|template)[\s\S]*?<\/\1>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export type FetchUrlFormat = 'markdown' | 'text' | 'html';

export const FETCH_URL_FORMATS: readonly FetchUrlFormat[] = ['markdown', 'text', 'html'];

export const resolveFetchUrlFormat = (raw: unknown): FetchUrlFormat => {
  if (typeof raw === 'string' && (FETCH_URL_FORMATS as readonly string[]).includes(raw.trim().toLowerCase())) {
    return raw.trim().toLowerCase() as FetchUrlFormat;
  }
  return 'markdown';
};

const decodeEntities = (value: string): string => (
  value
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, token: string) => {
      const named = NAMED_ENTITIES[token.toLowerCase()];
      if (named) return named;
      if (token.startsWith('#x') || token.startsWith('#X')) {
        const code = Number.parseInt(token.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (token.startsWith('#')) {
        const code = Number.parseInt(token.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return match;
    })
);

const stripTags = (value: string): string => decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const replaceTag = (html: string, tag: string, wrap: (inner: string) => string): string => {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  return html.replace(pattern, (_match, inner: string) => wrap(inner));
};

const replaceLinks = (html: string): string => (
  html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attrs: string, inner: string) => {
    const hrefMatch = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const href = hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? '';
    const label = stripTags(inner) || href;
    if (!href) return label;
    return `[${label}](${href})`;
  })
);

const collapseBlankLines = (value: string): string => (
  value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
);

/** Convert HTML into compact markdown suitable for an LLM tool observation. */
export const htmlToReadableMarkdown = (html: string): string => {
  let next = html.replace(HTML_COMMENT, '').replace(BLOCK_TAGS, ' ');
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(next);
  const title = titleMatch ? stripTags(titleMatch[1] ?? '') : '';
  next = next.replace(/<head[\s\S]*?<\/head>/gi, ' ');
  next = replaceLinks(next);
  next = replaceTag(next, 'h1', (inner) => `\n\n# ${stripTags(inner)}\n\n`);
  next = replaceTag(next, 'h2', (inner) => `\n\n## ${stripTags(inner)}\n\n`);
  next = replaceTag(next, 'h3', (inner) => `\n\n### ${stripTags(inner)}\n\n`);
  next = replaceTag(next, 'h4', (inner) => `\n\n#### ${stripTags(inner)}\n\n`);
  next = replaceTag(next, 'h5', (inner) => `\n\n##### ${stripTags(inner)}\n\n`);
  next = replaceTag(next, 'h6', (inner) => `\n\n###### ${stripTags(inner)}\n\n`);
  next = replaceTag(next, 'li', (inner) => `\n- ${stripTags(inner)}`);
  next = replaceTag(next, 'p', (inner) => `\n\n${stripTags(inner)}\n\n`);
  next = replaceTag(next, 'pre', (inner) => `\n\n\`\`\`\n${decodeEntities(inner.replace(/<[^>]+>/g, '')).trim()}\n\`\`\`\n\n`);
  next = replaceTag(next, 'blockquote', (inner) => `\n\n> ${stripTags(inner)}\n\n`);
  next = replaceTag(next, 'strong', (inner) => `**${stripTags(inner)}**`);
  next = replaceTag(next, 'b', (inner) => `**${stripTags(inner)}**`);
  next = replaceTag(next, 'em', (inner) => `*${stripTags(inner)}*`);
  next = replaceTag(next, 'i', (inner) => `*${stripTags(inner)}*`);
  next = replaceTag(next, 'code', (inner) => `\`${stripTags(inner)}\``);
  next = next.replace(/<br\s*\/?>/gi, '\n');
  next = next.replace(/<\/(div|section|article|header|footer|tr|table|ul|ol)>/gi, '\n');
  const body = collapseBlankLines(decodeEntities(next.replace(/<[^>]+>/g, ' ')));
  if (title && !body.toLowerCase().startsWith(`# ${title.toLowerCase()}`)) {
    return collapseBlankLines(`# ${title}\n\n${body}`);
  }
  return body;
};

export const htmlToReadableText = (html: string): string => (
  htmlToReadableMarkdown(html)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^>\s+/gm, '')
    .replace(/^-\s+/gm, '• ')
    .trim()
);

export const formatFetchedBody = (rawBody: string, contentType: string, format: FetchUrlFormat): string => {
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  const isHtml = mime.includes('html') || /^\s*</.test(rawBody);
  const isJson = mime.includes('json');

  if (format === 'html') return rawBody;

  if (isJson) {
    try {
      return JSON.stringify(JSON.parse(rawBody), null, 2);
    } catch {
      return rawBody;
    }
  }

  if (!isHtml) return rawBody;
  if (format === 'text') return htmlToReadableText(rawBody);
  return htmlToReadableMarkdown(rawBody);
};
