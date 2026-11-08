import type { JsonValue } from '../../awm/types';
import type { ActionDefinition, ActionExecutor } from '../types';

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

export const stripHtmlToText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();

const tagContent = (block: string, tag: string): string => {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? stripHtmlToText(match[1]) : '';
};

export const parseRssItems = (xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> => {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  const re = /<item[\s\S]*?<\/item>/gi;
  let match: RegExpExecArray | null = re.exec(xml);
  while (match) {
    const block = match[0];
    items.push({
      title: tagContent(block, 'title'),
      link: tagContent(block, 'link') || tagContent(block, 'guid'),
      description: tagContent(block, 'description') || tagContent(block, 'content:encoded'),
      pubDate: tagContent(block, 'pubDate') || tagContent(block, 'updated'),
    });
    match = re.exec(xml);
  }
  const entryRe = /<entry[\s\S]*?<\/entry>/gi;
  let entry = entryRe.exec(xml);
  while (entry) {
    const block = entry[0];
    const linkHref = block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '';
    items.push({
      title: tagContent(block, 'title'),
      link: linkHref || tagContent(block, 'id'),
      description: tagContent(block, 'summary') || tagContent(block, 'content'),
      pubDate: tagContent(block, 'updated') || tagContent(block, 'published'),
    });
    entry = entryRe.exec(xml);
  }
  return items;
};

export const dataHtmlToTextDefinition: ActionDefinition = {
  key: 'data.html-to-text',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: { html: { type: 'string', title: 'HTML' } },
    required: ['html'],
  }),
  outputSchema: inlineSchema({ type: 'object', properties: { text: { type: 'string' }, length: { type: 'integer' } } }),
  executionTimeoutMs: 5000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'PURE',
  riskClass: 'LOW',
  requiredCapabilities: [],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['data', 'html'],
};

export const dataHtmlToTextExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const html = (input as { html?: unknown })?.html;
    if (typeof html !== 'string') {
      return { status: 'FAILED', errorCode: 'HTML_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.html is required.' };
    }
    const text = stripHtmlToText(html);
    return { status: 'SUCCEEDED', output: { text, length: text.length } };
  },
};

export const dataRssParseDefinition: ActionDefinition = {
  key: 'data.rss-parse',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: { xml: { type: 'string', title: 'RSS or Atom XML' } },
    required: ['xml'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      count: { type: 'integer' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            link: { type: 'string' },
            description: { type: 'string' },
            pubDate: { type: 'string' },
          },
        },
      },
    },
  }),
  executionTimeoutMs: 5000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'PURE',
  riskClass: 'LOW',
  requiredCapabilities: [],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['data', 'rss'],
};

export const dataRssParseExecutor: ActionExecutor = {
  async execute(_context, _config, input) {
    const xml = (input as { xml?: unknown })?.xml;
    if (typeof xml !== 'string') {
      return { status: 'FAILED', errorCode: 'RSS_XML_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.xml is required.' };
    }
    const items = parseRssItems(xml);
    return { status: 'SUCCEEDED', output: { count: items.length, items } };
  },
};
