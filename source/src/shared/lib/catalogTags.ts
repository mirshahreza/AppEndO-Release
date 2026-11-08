/** Normalize freeform catalog tags for APIs and client components. */
export function normalizeCatalogTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }
    const trimmed = entry.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
    if (result.length >= 24) {
      break;
    }
  }

  return result;
}

export function catalogTagsSearchHaystack(tags: readonly string[] | undefined): string {
  return (tags ?? []).join(' ').toLowerCase();
}

export function parseCatalogTagInput(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
  return trimmed || null;
}

/** Unique tags already used on catalog records, for typeahead suggestions. */
export function collectCatalogTagSuggestions(
  records: readonly { tags?: readonly string[] | undefined }[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of records) {
    for (const tag of normalizeCatalogTags(item.tags ?? [])) {
      const key = tag.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(tag);
    }
  }

  return result.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}
