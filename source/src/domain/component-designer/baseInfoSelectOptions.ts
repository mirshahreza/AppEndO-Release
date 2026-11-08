import type { DesignerAutocompleteItem } from './designerAutocompleteItems';

const BASE_INFO_ROOT_IDS = new Set(['100', '100.1', '100.2', '100.3']);

export const parseBaseInfoOptionsRootFromEndpoint = (endpoint: string): string | null => {
  try {
    const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? new URL(endpoint)
      : new URL(endpoint, 'http://localhost');
    const root = url.searchParams.get('root')?.trim();
    return root || null;
  } catch {
    return null;
  }
};

export type MapBaseInfoOptionsConfig = {
  excludeRootId?: string | null;
};

export type BaseInfoRichSelectOption = DesignerAutocompleteItem & {
  uiColor?: string | null;
  uiHtml?: string | null;
  description?: string | null;
  shortName?: string | null;
};

const readBaseInfoOptionItems = (payload: unknown): unknown[] => {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
  if (Array.isArray(record?.items)) {
    return record.items;
  }
  return Array.isArray(payload) ? payload : [];
};

const readOptionalText = (raw: unknown): string | null => {
  if (raw == null || raw === '') {
    return null;
  }
  const text = String(raw).trim();
  return text || null;
};

export const mapBaseInfoApiItemsToRichSelectOptions = (
  payload: unknown,
  config?: MapBaseInfoOptionsConfig,
): BaseInfoRichSelectOption[] => {
  const excludeRootId = config?.excludeRootId?.trim() || null;

  return readBaseInfoOptionItems(payload)
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const item = entry as Record<string, unknown>;
      const id = String(item.id ?? '').trim();
      if (!id || BASE_INFO_ROOT_IDS.has(id) || (excludeRootId && id === excludeRootId)) {
        return null;
      }

      const label = String(item.label ?? item.title ?? item.title_en ?? id).trim();
      const uiColorRaw = item.ui_color ?? item.uiColor;
      const uiHtmlRaw = item.ui_html ?? item.uiHtml;
      const description = readOptionalText(
        item.note ?? item.note_en ?? item.noteEn ?? item.description,
      );
      const shortName = readOptionalText(item.short_name ?? item.shortName);

      return {
        id,
        textValue: label || id,
        uiColor: uiColorRaw == null || uiColorRaw === '' ? null : String(uiColorRaw),
        uiHtml: uiHtmlRaw == null || uiHtmlRaw === '' ? null : String(uiHtmlRaw),
        description,
        shortName,
      };
    })
    .filter((entry): entry is BaseInfoRichSelectOption => entry !== null);
};

export const mapBaseInfoApiItemsToSelectOptions = (
  payload: unknown,
  config?: MapBaseInfoOptionsConfig,
): DesignerAutocompleteItem[] => (
  mapBaseInfoApiItemsToRichSelectOptions(payload, config).map(({ id, textValue }) => ({ id, textValue }))
);
