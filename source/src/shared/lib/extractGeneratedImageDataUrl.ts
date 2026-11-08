const GENERATED_IMAGE_MARKDOWN_PATTERN = /!\[[^\]]*\]\(([^)]+)\)/;

export const extractGeneratedImageReference = (content: string): string | null => {
  const match = content.match(GENERATED_IMAGE_MARKDOWN_PATTERN);
  return match?.[1]?.trim() ?? null;
};

export const extractGeneratedImageDataUrl = (content: string): string | null => {
  const reference = extractGeneratedImageReference(content);
  if (!reference?.startsWith('data:image/')) return null;
  return reference;
};

export const stripGeneratedImageMarkdown = (content: string): string => (
  content.replace(GENERATED_IMAGE_MARKDOWN_PATTERN, '').trim()
);

export const resolveGeneratedImageDataUrl = async (
  content: string,
  fetchImageBytes: (url: string) => Promise<Buffer>,
): Promise<string | null> => {
  const inlineDataUrl = extractGeneratedImageDataUrl(content);
  if (inlineDataUrl) return inlineDataUrl;

  const reference = extractGeneratedImageReference(content);
  if (!reference || !/^https?:\/\//i.test(reference)) return null;

  const bytes = await fetchImageBytes(reference);
  if (!bytes.length) return null;

  return `data:image/png;base64,${bytes.toString('base64')}`;
};
