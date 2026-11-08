export type HtmlEditorStats = {
  characters: number;
  charactersNoTags: number;
  words: number;
};

/** Rough plaintext stats for the mode-bar footer (not a full HTML parser). */
export const computeHtmlEditorStats = (html: string): HtmlEditorStats => {
  const source = typeof html === 'string' ? html : '';
  const text = source
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    characters: source.length,
    charactersNoTags: text.length,
    words: text.length === 0 ? 0 : text.split(' ').length,
  };
};
