/**
 * Normalizes agent/user server function source for the AppEndO sandbox VM.
 * The worker runs compiled code in a vm context with global req/res/db — not CommonJS module.exports.
 */
export const normalizeSandboxSource = (source: string): string => {
  let normalized = source.trim();
  if (!normalized) return normalized;

  const hadExportDefault = /\bexport\s+default\b/.test(normalized);

  normalized = normalized.replace(/^export\s+default\s+/gm, '');
  normalized = normalized.replace(/^export\s+/gm, '');

  if (hadExportDefault && !/\bfunction\s+handler\b|\bconst\s+handler\b/.test(normalized)) {
    normalized = normalized.replace(
      /\basync\s+function\s+\w+\s*\([^)]*\)/,
      'async function handler()',
    );
    normalized = normalized.replace(
      /\bfunction\s+\w+\s*\([^)]*\)/,
      'function handler()',
    );
  }

  normalized = normalized.replace(
    /\b(async\s+)?function\s+handler\s*\([^)]*\)/g,
    '$1function handler()',
  );
  normalized = normalized.replace(
    /\bconst\s+handler\s*=\s*async\s*\([^)]*\)\s*=>/g,
    'const handler = async () =>',
  );

  // Worker pool wraps source and calls handler() — strip agent auto-invoke patterns that break cjs compile.
  normalized = normalized
    .replace(/\(async\s*\(\)\s*=>\s*\{\s*await\s+handler\s*\([^)]*\);\s*\}\)\(\);?/g, '')
    .replace(/^\s*await\s+handler\s*\([^)]*\);\s*$/gm, '')
    .replace(/^\s*void\s+handler\s*\([^)]*\);\s*$/gm, '');

  return normalized.trim();
};

export const sandboxSourceUsesUnsupportedModulePattern = (source: string): boolean => (
  /\bmodule\.exports\b/.test(source)
  || /\bexports\./.test(source)
  || /^import\s+/m.test(source)
  || /^export\s+/m.test(source)
);
