const RTL_SCRIPT_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export type FileManagerPreviewDirectionOverride = 'auto' | 'ltr' | 'rtl';

export const isFileManagerPlainTextLanguage = (language: string | null | undefined): boolean => (
  !language || language === 'plaintext'
);

export const resolvePlainTextPreviewDirection = (content: string): 'rtl' | 'ltr' => {
  const normalized = content.replace(/^\uFEFF/, '');
  const firstLetterMatch = normalized.match(/\p{L}/u);

  if (!firstLetterMatch) {
    return 'ltr';
  }

  return RTL_SCRIPT_PATTERN.test(firstLetterMatch[0]) ? 'rtl' : 'ltr';
};

export const resolveFileManagerPreviewDirection = (
  content: string,
  override: FileManagerPreviewDirectionOverride,
): 'ltr' | 'rtl' => {
  if (override === 'ltr' || override === 'rtl') {
    return override;
  }

  return resolvePlainTextPreviewDirection(content);
};
