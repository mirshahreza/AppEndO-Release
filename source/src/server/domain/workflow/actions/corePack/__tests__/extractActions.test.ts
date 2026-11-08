import { describe, expect, it } from 'vitest';
import { stripHtmlToText, parseRssItems, dataHtmlToTextExecutor, dataRssParseExecutor } from '../extractActions';

const fakeContext = {
  workflowInstanceId: 'i1',
  nodeInstanceId: 'n1',
  logicalInvocationId: 'l1',
  idempotencyKey: 'k1',
  effectiveIdentity: { type: 'SYSTEM' as const, id: null },
  cancellationSignal: new AbortController().signal,
  resolveSecret: async () => 'secret',
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
};

describe('stripHtmlToText', () => {
  it('drops script/style blocks, comments-as-tags, and decodes common entities', () => {
    const html = `
      <html><head><style>.x{color:red}</style></head>
      <body>
        <script>alert(1)</script>
        <p>A&amp;B &lt;C&gt; &quot;D&quot;</p>
        <div>Hello&nbsp;world</div>
      </body></html>
    `;
    expect(stripHtmlToText(html)).toBe('A&B <C> "D" Hello world');
  });

  it('collapses whitespace across block boundaries', () => {
    expect(stripHtmlToText('<p>one</p>\n<p>two</p>')).toBe('one two');
  });
});

describe('parseRssItems', () => {
  it('parses RSS 2.0 items including guid fallback when link is missing', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title>Alpha</title><guid>https://ex.test/a</guid><description>First</description><pubDate>Mon, 01 Jan 2026</pubDate></item>
        <item><title>Beta</title><link>https://ex.test/b</link></item>
      </channel></rss>`;
    const items = parseRssItems(xml);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: 'Alpha', link: 'https://ex.test/a', description: 'First', pubDate: 'Mon, 01 Jan 2026' });
    expect(items[1]).toMatchObject({ title: 'Beta', link: 'https://ex.test/b' });
  });

  it('parses Atom entries (title, link href, summary, updated)', () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Atom one</title>
          <link href="https://ex.test/atom-1"/>
          <id>urn:uuid:1</id>
          <updated>2026-08-14T00:00:00Z</updated>
          <summary>Hello atom</summary>
        </entry>
      </feed>`;
    const items = parseRssItems(xml);
    expect(items).toEqual([{
      title: 'Atom one',
      link: 'https://ex.test/atom-1',
      description: 'Hello atom',
      pubDate: '2026-08-14T00:00:00Z',
    }]);
  });

  it('returns an empty list for XML with no item/entry blocks', () => {
    expect(parseRssItems('<rss><channel><title>Empty</title></channel></rss>')).toEqual([]);
  });
});

describe('data.html-to-text / data.rss-parse executors', () => {
  it('html-to-text fails when html is missing and includes length on success', async () => {
    const missing = await dataHtmlToTextExecutor.execute(fakeContext, {}, {});
    expect(missing).toMatchObject({ status: 'FAILED', errorCode: 'HTML_REQUIRED' });
    const ok = await dataHtmlToTextExecutor.execute(fakeContext, {}, { html: '<b>Hi</b>' });
    expect(ok).toMatchObject({ status: 'SUCCEEDED', output: { text: 'Hi', length: 2 } });
  });

  it('rss-parse fails when xml is missing', async () => {
    const missing = await dataRssParseExecutor.execute(fakeContext, {}, { xml: 12 });
    expect(missing).toMatchObject({ status: 'FAILED', errorCode: 'RSS_XML_REQUIRED' });
  });
});
