import { hasRtlScriptChar, RTL_SCRIPT_CHAR_PATTERN } from './textDirection';

const LTR_CHAR_PATTERN = /[A-Za-z0-9]/;

/** @deprecated Prefer `hasRtlScriptChar` from `textDirection`. */
export const hasRtlScriptChars = hasRtlScriptChar;

/** Detect paragraph direction for chat bubbles (Persian, Arabic, Hebrew, etc.). */
export const getChatTextDirection = (value: string): 'ltr' | 'rtl' | 'auto' => {
  const trimmed = value.trim();
  if (!trimmed) return 'ltr';

  let rtlCount = 0;
  let ltrCount = 0;

  for (const char of trimmed) {
    if (RTL_SCRIPT_CHAR_PATTERN.test(char)) {
      rtlCount += 1;
    } else if (LTR_CHAR_PATTERN.test(char)) {
      ltrCount += 1;
    }
  }

  if (rtlCount === 0) return 'ltr';
  if (ltrCount === 0) return 'rtl';
  return 'auto';
};
