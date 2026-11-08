export type DesignerAutocompleteItem = {
  id: string;
  textValue: string;
};

export const DEFAULT_DESIGNER_AUTOCOMPLETE_ITEMS: DesignerAutocompleteItem[] = [
  { id: 'option-1', textValue: 'Option 1' },
  { id: 'option-2', textValue: 'Option 2' },
  { id: 'option-3', textValue: 'Option 3' },
];

export const parseDesignerAutocompleteItems = (value: unknown): DesignerAutocompleteItem[] => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return DEFAULT_DESIGNER_AUTOCOMPLETE_ITEMS;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_DESIGNER_AUTOCOMPLETE_ITEMS;
    }

    const items = parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const id = typeof record.id === 'string' ? record.id.trim() : '';
        const textValue = typeof record.textValue === 'string'
          ? record.textValue.trim()
          : typeof record.label === 'string'
            ? record.label.trim()
            : '';

        if (!id || !textValue) {
          return null;
        }

        return { id, textValue };
      })
      .filter((entry): entry is DesignerAutocompleteItem => entry !== null);

    return items.length > 0 ? items : DEFAULT_DESIGNER_AUTOCOMPLETE_ITEMS;
  } catch {
    return DEFAULT_DESIGNER_AUTOCOMPLETE_ITEMS;
  }
};

export const serializeDesignerAutocompleteItems = (items: DesignerAutocompleteItem[]): string =>
  JSON.stringify(items);

export const normalizeDesignerOptionItems = (value: unknown): DesignerAutocompleteItem[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const id = String(record.id ?? '').trim();
        const textValue = String(record.textValue ?? record.label ?? record.title ?? id).trim();
        if (!id || !textValue) {
          return null;
        }

        return { id, textValue };
      })
      .filter((entry): entry is DesignerAutocompleteItem => entry !== null);
  }

  return parseDesignerAutocompleteItems(value);
};

export const resolveDesignerNodeStaticOptionItems = (node: { props: Record<string, unknown> }): DesignerAutocompleteItem[] =>
  normalizeDesignerOptionItems(node.props.items);
