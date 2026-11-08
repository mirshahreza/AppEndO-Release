/**
 * Marketplace plugins must not register culture-pack System Extensions.
 * Builtin culture packs ship in-tree under src/core/system-extensions/culture-packs/.
 */

const RESERVED_BUILTIN_CULTURE_PACK_IDS = new Set([
  'us',
  'ir',
  'iq',
]);

const assertMarketplaceCannotRegisterCulturePack = (extensionType: string): void => {
  if (extensionType === 'culture-pack') {
    throw new Error('Marketplace plugins cannot register culture-pack extensions.');
  }
};

export const appendMarketplaceCulturePackManifestErrors = (
  m: Record<string, unknown>,
  errors: string[],
): void => {
  for (const field of ['extensionType', 'systemExtensionType'] as const) {
    const value = m[field];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${field} must be a non-empty string when present.`);
      continue;
    }
    try {
      assertMarketplaceCannotRegisterCulturePack(value.trim());
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Invalid culture extension type.');
    }
  }

  if (typeof m.id === 'string' && RESERVED_BUILTIN_CULTURE_PACK_IDS.has(m.id)) {
    errors.push(`Package id "${m.id}" is reserved for builtin culture-pack System Extensions.`);
  }
};
