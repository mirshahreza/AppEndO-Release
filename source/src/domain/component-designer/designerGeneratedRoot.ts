/**
 * Generated document root wrapper. `h-full` / `h-[100%]` on child nodes is a percentage of
 * this box — without an explicit height here (legacy `space-y-3` only) those utilities
 * resolve to auto and the Style panel Height control looks dead.
 */
export const DESIGNER_GENERATED_ROOT_CLASS = 'h-full min-h-0 w-full min-w-0 space-y-3';
export const DESIGNER_GENERATED_ROOT_CLASS_LEGACY = 'space-y-3';

/** Live/classic preview host — same height chain, scroll when content overflows the canvas. */
export const DESIGNER_PREVIEW_DOCUMENT_CLASS = `${DESIGNER_GENERATED_ROOT_CLASS} overflow-y-auto`;

const tokenizeClassName = (className: string): string[] =>
  className.trim().split(/\s+/).filter(Boolean);

/** Tokens the codegen / preview wrappers may put on the GeneratedComponent return root. */
const DESIGNER_GENERATED_ROOT_ALLOWED_TOKENS = new Set([
  'h-full',
  'min-h-0',
  'w-full',
  'min-w-0',
  'space-y-3',
  'overflow-y-auto',
  'flex',
  'flex-col',
]);

export const isDesignerGeneratedRootClass = (className: unknown): boolean => {
  if (typeof className !== 'string') {
    return false;
  }
  const tokens = tokenizeClassName(className);
  if (tokens.length === 0 || !tokens.includes('space-y-3')) {
    return false;
  }
  return tokens.every((token) => DESIGNER_GENERATED_ROOT_ALLOWED_TOKENS.has(token));
};
