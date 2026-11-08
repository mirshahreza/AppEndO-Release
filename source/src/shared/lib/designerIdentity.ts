const INVALID_COMPONENT_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const INVALID_FOLDER_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Matches designer draft filesystem base names (see sanitizeComponentFileBaseName). */
export const normalizeDesignerComponentName = (value: string): string => {
  const sanitized = value
    .trim()
    .replace(/\s+/g, '-')
    .replace(INVALID_COMPONENT_NAME_CHARS, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .toLowerCase();

  return sanitized.length > 0 ? sanitized : 'component';
};

/** Matches designer draft folder directory names (see sanitizeDraftFolderName). */
export const normalizeComponentFolder = (value: string): string => {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(INVALID_FOLDER_CHARS, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return sanitized.length > 0 ? sanitized : 'general';
};
