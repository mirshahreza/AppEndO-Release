import { Op, type ModelCtor } from 'sequelize';
import type { EdgeApiFieldEnrichment, EdgeApiLangSource } from '../../../shared/api/contracts/data-api';
import { listBaseInfoEnrichmentRowsByIds, listBaseInfoOptionsRows } from '../../domain/base-info/treeRepository';
import { resolveBaseInfoCultureId } from '../../../shared/lib/baseInfoCultureTranslations';

const resolveLangFromSource = (
  langSource: EdgeApiLangSource,
  queryLang: string,
): string => {
  if (langSource === 'query:lang') {
    return queryLang;
  }
  if (langSource === 'fixed:fa') {
    return 'fa';
  }
  if (langSource === 'fixed:ar') {
    return 'ar';
  }
  return 'en';
};

const resolveBaseInfoAttachedFields = (
  enrichment: Extract<EdgeApiFieldEnrichment, { kind: 'base_info_title' }>,
): Array<{ sourceColumn: string; outputField: string }> => {
  if (enrichment.attachedFields && enrichment.attachedFields.length > 0) {
    return enrichment.attachedFields;
  }

  if (!enrichment.outputField) {
    return [];
  }

  const fields = [{
    sourceColumn: 'title',
    outputField: enrichment.outputField,
  }];

  if (enrichment.includeUiMeta) {
    fields.push({
      sourceColumn: 'ui_html',
      outputField: `${enrichment.outputField}_uiHtml`,
    });
  }

  return fields;
};

const resolveCultureFromLangSource = (
  langSource: EdgeApiLangSource,
  queryLang: string,
): string => {
  const lang = resolveLangFromSource(langSource, queryLang);
  return resolveBaseInfoCultureId(lang);
};

const resolveBaseInfoColumnValue = (
  row: Record<string, unknown>,
  sourceColumn: string,
): unknown => {
  const normalized = sourceColumn.trim();
  if (normalized === 'title' || normalized === 'title_en') {
    return row.title ?? row.title_canonical ?? null;
  }
  if (normalized === 'note' || normalized === 'note_en') {
    return row.note ?? row.note_canonical ?? null;
  }
  if (normalized === 'title_path' || normalized === 'title_path_en') {
    return row.title_path ?? null;
  }
  return row[normalized] ?? row[sourceColumn] ?? null;
};

const buildBaseInfoRowMapsById = async (
  enrichments: EdgeApiFieldEnrichment[],
  rows: Record<string, unknown>[],
  queryLang: string,
): Promise<Map<string, Map<string, Record<string, unknown>>>> => {
  const mapsByEnrichmentId = new Map<string, Map<string, Record<string, unknown>>>();
  const baseInfoEnrichments = enrichments.filter((item) => (
    item.kind === 'base_info_title' && item.attachedFields && item.attachedFields.length > 0
  ));
  if (baseInfoEnrichments.length === 0) {
    return mapsByEnrichmentId;
  }

  const ids = new Set<string>();
  for (const enrichment of baseInfoEnrichments) {
    for (const row of rows) {
      const rawValue = readRowFieldValue(row, enrichment.sourceField);
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        continue;
      }
      ids.add(String(rawValue));
    }
  }

  const rowsByCulture = new Map<string, Map<string, Record<string, unknown>>>();
  const cultureIds = new Set(
    baseInfoEnrichments.map((enrichment) => resolveCultureFromLangSource(enrichment.langSource, queryLang)),
  );

  await Promise.all([...cultureIds].map(async (cultureId) => {
    const baseInfoRows = await listBaseInfoEnrichmentRowsByIds([...ids], cultureId);
    rowsByCulture.set(cultureId, new Map(baseInfoRows.map((row) => [String(row.id), row])));
  }));

  for (const enrichment of baseInfoEnrichments) {
    const attachedFields = resolveBaseInfoAttachedFields(enrichment);
    if (attachedFields.length === 0) {
      mapsByEnrichmentId.set(enrichment.id, new Map());
      continue;
    }

    const cultureId = resolveCultureFromLangSource(enrichment.langSource, queryLang);
    mapsByEnrichmentId.set(enrichment.id, rowsByCulture.get(cultureId) ?? new Map());
  }

  return mapsByEnrichmentId;
};

const buildLabelMapsByRoot = async (
  enrichments: EdgeApiFieldEnrichment[],
  queryLang: string,
): Promise<Map<string, Map<string, { label: string; uiHtml: string | null }>>> => {
  const rootsByLang = new Map<string, Set<string>>();

  for (const enrichment of enrichments) {
    if (enrichment.kind !== 'base_info_title') {
      continue;
    }
    if (enrichment.attachedFields && enrichment.attachedFields.length > 0) {
      continue;
    }
    const lang = resolveLangFromSource(enrichment.langSource, queryLang);
    const roots = rootsByLang.get(lang) ?? new Set<string>();
    roots.add(enrichment.rootId);
    rootsByLang.set(lang, roots);
  }

  const mapsByRoot = new Map<string, Map<string, { label: string; uiHtml: string | null }>>();

  await Promise.all(Array.from(rootsByLang.entries()).map(async ([lang, rootIds]) => {
    const cultureId = resolveBaseInfoCultureId(lang);

    await Promise.all(Array.from(rootIds).map(async (rootId) => {
      const rows = await listBaseInfoOptionsRows(
        cultureId,
        'AND i.is_active = TRUE',
        'AND (i.id = ? OR i.parent_id = ?)',
        [rootId, rootId],
      );

      const labelMap = new Map<string, { label: string; uiHtml: string | null }>();
      for (const row of rows) {
        const code = String(row.id ?? '').trim();
        if (!code) {
          continue;
        }
        labelMap.set(code, {
          label: String(row.label ?? row.title ?? code).trim() || code,
          uiHtml: row.ui_html ?? null,
        });
      }

      mapsByRoot.set(rootId, labelMap);
    }));
  }));

  return mapsByRoot;
};

const readRowFieldValue = (
  row: Record<string, unknown>,
  fieldName: string,
): unknown => {
  if (fieldName in row) {
    return row[fieldName];
  }

  const camelCase = fieldName.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
  if (camelCase in row) {
    return row[camelCase];
  }

  const snakeCase = fieldName.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
  if (snakeCase in row) {
    return row[snakeCase];
  }

  return undefined;
};

export type FieldEnrichmentDeps = {
  getTargetModelById: (modelId: string) => ModelCtor | undefined;
};

const buildJoinLookupMaps = async (
  enrichments: EdgeApiFieldEnrichment[],
  rows: Record<string, unknown>[],
  deps?: FieldEnrichmentDeps,
): Promise<Map<string, Map<string, Record<string, unknown>>>> => {
  const mapsByEnrichmentId = new Map<string, Map<string, Record<string, unknown>>>();
  if (!deps?.getTargetModelById) {
    return mapsByEnrichmentId;
  }

  const joinLookups = enrichments.filter((item): item is Extract<EdgeApiFieldEnrichment, { kind: 'join_lookup' }> => (
    item.kind === 'join_lookup'
  ));

  await Promise.all(joinLookups.map(async (enrichment) => {
    const TargetModel = deps.getTargetModelById(enrichment.targetModelId);
    if (!TargetModel) {
      mapsByEnrichmentId.set(enrichment.id, new Map());
      return;
    }

    const matchValues = new Set<string>();
    for (const row of rows) {
      const rawValue = readRowFieldValue(row, enrichment.sourceField);
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        continue;
      }
      matchValues.add(String(rawValue));
    }

    if (matchValues.size === 0) {
      mapsByEnrichmentId.set(enrichment.id, new Map());
      return;
    }

    const sourceColumns = enrichment.attachedFields.map((item) => item.sourceColumn);
    const attributes = [...new Set([enrichment.targetMatchColumn, ...sourceColumns])];
    const targetRows = await TargetModel.findAll({
      where: {
        [enrichment.targetMatchColumn]: {
          [Op.in]: Array.from(matchValues),
        },
      },
      attributes,
    });

    const lookupMap = new Map<string, Record<string, unknown>>();
    for (const targetRow of targetRows) {
      const plain = targetRow.get({ plain: true }) as Record<string, unknown>;
      const key = String(plain[enrichment.targetMatchColumn] ?? '');
      if (key) {
        lookupMap.set(key, plain);
      }
    }

    mapsByEnrichmentId.set(enrichment.id, lookupMap);
  }));

  return mapsByEnrichmentId;
};

export const resolveDataApiLang = (query: Record<string, unknown>): string => {
  const raw = typeof query.lang === 'string' ? query.lang.trim() : '';
  return raw || 'en';
};

export async function applyFieldEnrichments(
  rows: Record<string, unknown>[],
  enrichments: EdgeApiFieldEnrichment[] | undefined,
  queryLang: string,
  deps?: FieldEnrichmentDeps,
): Promise<Record<string, unknown>[]> {
  if (!enrichments || enrichments.length === 0 || rows.length === 0) {
    return rows;
  }

  const labelMapsByRoot = await buildLabelMapsByRoot(enrichments, queryLang);
  const baseInfoRowMaps = await buildBaseInfoRowMapsById(enrichments, rows, queryLang);
  const joinLookupMaps = await buildJoinLookupMaps(enrichments, rows, deps);

  return rows.map((row) => {
    const next = { ...row };

    for (const enrichment of enrichments) {
      if (enrichment.kind === 'base_info_title') {
        const attachedFields = resolveBaseInfoAttachedFields(enrichment);
        const rawValue = readRowFieldValue(row, enrichment.sourceField);

        if (attachedFields.length > 0 && enrichment.attachedFields?.length) {
          const lookupMap = baseInfoRowMaps.get(enrichment.id);
          const targetRow = rawValue === null || rawValue === undefined || rawValue === ''
            ? null
            : lookupMap?.get(String(rawValue)) ?? null;

          for (const attachedField of attachedFields) {
            next[attachedField.outputField] = targetRow
              ? resolveBaseInfoColumnValue(targetRow, attachedField.sourceColumn)
              : null;
          }
          continue;
        }

        const labelMap = labelMapsByRoot.get(enrichment.rootId);
        if (rawValue === null || rawValue === undefined || rawValue === '') {
          if (enrichment.outputField) {
            next[enrichment.outputField] = null;
          }
          continue;
        }

        const code = String(rawValue);
        const resolved = labelMap?.get(code);
        if (enrichment.outputField) {
          next[enrichment.outputField] = resolved?.label ?? code;
        }

        if (enrichment.includeUiMeta && enrichment.outputField) {
          next[`${enrichment.outputField}_uiHtml`] = resolved?.uiHtml ?? null;
        }
        continue;
      }

      if (enrichment.kind !== 'join_lookup') {
        continue;
      }

      const lookupMap = joinLookupMaps.get(enrichment.id);
      const rawValue = readRowFieldValue(row, enrichment.sourceField);
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        for (const attachedField of enrichment.attachedFields) {
          next[attachedField.outputField] = null;
        }
        continue;
      }

      const targetRow = lookupMap?.get(String(rawValue));
      for (const attachedField of enrichment.attachedFields) {
        next[attachedField.outputField] = targetRow?.[attachedField.sourceColumn] ?? null;
      }
    }

    return next;
  });
}
