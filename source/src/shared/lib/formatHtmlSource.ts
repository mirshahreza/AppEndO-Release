/**
 * Browser-safe HTML formatting via Prettier standalone + HTML plugin.
 * Lazy-loads plugins so the main bundle stays light until Format is used.
 */
export const formatHtmlSource = async (html: string): Promise<string> => {
  const source = typeof html === 'string' ? html : '';
  if (!source.trim()) {
    return source;
  }

  const prettier = await import('prettier/standalone');
  const htmlPlugin = await import('prettier/plugins/html');

  return prettier.format(source, {
    parser: 'html',
    plugins: [htmlPlugin],
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    htmlWhitespaceSensitivity: 'css',
    endOfLine: 'lf',
  });
};
