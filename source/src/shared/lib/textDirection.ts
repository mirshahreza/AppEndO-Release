/** Arabic, Hebrew, Syriac, Thaana, N'Ko, and related RTL scripts. */
export const RTL_SCRIPT_CHAR_PATTERN =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u08A0-\u08FF\uFB1D-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Latin letters used to detect an explicit LTR start. */
const LTR_LETTER_CHAR_PATTERN = /[A-Za-z\u00C0-\u024F]/;

export const hasRtlScriptChar = (value: string): boolean => {
  for (const char of value) {
    if (RTL_SCRIPT_CHAR_PATTERN.test(char)) {
      return true;
    }
  }
  return false;
};

/**
 * True when the first meaningful character is RTL script (Persian, Arabic, Hebrew, etc.).
 * Neutral leading whitespace, punctuation, and digits are skipped.
 */
export const isRtlDominantText = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  for (const char of trimmed) {
    if (RTL_SCRIPT_CHAR_PATTERN.test(char)) {
      return true;
    }
    if (LTR_LETTER_CHAR_PATTERN.test(char)) {
      return false;
    }
  }

  return false;
};

export const getContentTextDirection = (value: string): 'ltr' | 'rtl' =>
  isRtlDominantText(value) ? 'rtl' : 'ltr';

export type DirectionalTextProps = {
  dir: 'ltr' | 'rtl';
  className: string;
};

/** Props for aligning user-authored text blocks inside an LTR shell. */
export const getDirectionalTextProps = (value: string): DirectionalTextProps => {
  const dir = getContentTextDirection(value);
  return {
    dir,
    className: dir === 'rtl' ? 'block w-full text-right' : 'block w-full text-left',
  };
};
