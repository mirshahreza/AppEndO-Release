import { describe, expect, it } from 'vitest';
import { formatFetchedBody, htmlToReadableMarkdown, htmlToReadableText } from '../htmlToReadableMarkdown';

describe('htmlToReadableMarkdown', () => {
  it('strips scripts and turns structure into markdown', () => {
    const markdown = htmlToReadableMarkdown(`
      <html><head><title>Docs</title><script>alert(1)</script></head>
      <body>
        <h1>Hello</h1>
        <p>Read the <a href="https://example.com/guide">guide</a>.</p>
        <ul><li>One</li><li>Two</li></ul>
      </body></html>
    `);

    expect(markdown).toContain('# Docs');
    expect(markdown).toContain('# Hello');
    expect(markdown).toContain('[guide](https://example.com/guide)');
    expect(markdown).toContain('- One');
    expect(markdown).not.toContain('alert(1)');
    expect(markdown).not.toContain('<script');
  });

  it('formats HTML as markdown by default and keeps raw HTML when requested', () => {
    const html = '<html><body><h2>Title</h2><p>Body &amp; more</p></body></html>';
    expect(formatFetchedBody(html, 'text/html', 'markdown')).toContain('## Title');
    expect(formatFetchedBody(html, 'text/html', 'markdown')).toContain('Body & more');
    expect(formatFetchedBody(html, 'text/html', 'html')).toBe(html);
    expect(htmlToReadableText(html)).toContain('Title');
    expect(htmlToReadableText(html)).not.toContain('##');
  });

  it('pretty-prints JSON regardless of markdown format', () => {
    const pretty = formatFetchedBody('{"a":1}', 'application/json', 'markdown');
    expect(pretty).toContain('"a": 1');
  });
});
