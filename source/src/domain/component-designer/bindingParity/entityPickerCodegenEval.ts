import { renderEntityPickerRuntimeHelper } from '../bindingEntityPickerCodegen';

export type EntityPickerOption = { id: string; textValue: string };

const stripTypeScriptFromHelperSource = (source: string): string =>
  source
    .replace(/^type EntityPickerOption = [^;]+;\s*/m, '')
    .replace(/^type EntityPickerFieldMapping = [^;]+;\s*/m, '')
    .replace(/, mapping\?: EntityPickerFieldMapping/g, ', mapping')
    .replace(/\): entry is EntityPickerOption =>/g, ') =>')
    .replace(/: EntityPickerOption\[\]/g, '')
    .replace(/: unknown/g, '')
    .replace(/\s+as\s+Record<string,\s*unknown>/g, '');

const extractNormalizerFunctionSource = (source: string): string => {
  const start = source.indexOf('function normalizeEntityPickerItems');
  const end = source.indexOf('function useEntityPickerOptions', start);
  if (start < 0) {
    return '';
  }
  const block = end > start ? source.slice(start, end) : source.slice(start);
  return stripTypeScriptFromHelperSource(block.trim());
};

const ENGINE_NORMALIZER_SOURCE = extractNormalizerFunctionSource(
  renderEntityPickerRuntimeHelper().join('\n'),
);

const createNormalizerEvaluator = (source: string): ((payload: unknown) => EntityPickerOption[]) => {
  const sanitized = extractNormalizerFunctionSource(source);
  if (!sanitized) {
    throw new Error('normalizeEntityPickerItems function source is missing.');
  }

  // eslint-disable-next-line no-new-func
  const evaluator = new Function(
    'payload',
    `${sanitized}
     return normalizeEntityPickerItems(payload);
    `,
  ) as (payload: unknown) => EntityPickerOption[];

  return evaluator;
};

let engineNormalizer: ((payload: unknown) => EntityPickerOption[]) | null = null;

export const evaluateEngineEntityPickerNormalizer = (payload: unknown): EntityPickerOption[] => {
  engineNormalizer ??= createNormalizerEvaluator(ENGINE_NORMALIZER_SOURCE);
  return engineNormalizer(payload);
};

export const extractEntityPickerNormalizerSourceFromExportTsx = (tsx: string): string => {
  const typeMarker = 'type EntityPickerOption';
  const hookMarker = 'function useEntityPickerOptions';
  const typeIndex = tsx.indexOf(typeMarker);
  const hookIndex = tsx.indexOf(hookMarker);

  if (typeIndex < 0 || hookIndex < 0 || hookIndex <= typeIndex) {
    return '';
  }

  return tsx.slice(typeIndex, hookIndex).trim();
};

export const evaluateExportEntityPickerNormalizer = (
  tsx: string,
  payload: unknown,
): EntityPickerOption[] => {
  const source = extractEntityPickerNormalizerSourceFromExportTsx(tsx);
  if (!source) {
    throw new Error('Export TSX is missing normalizeEntityPickerItems runtime helper block.');
  }

  return createNormalizerEvaluator(source)(payload);
};

export const exportTsxIncludesEntityPickerRuntimeHelpers = (tsx: string): boolean =>
  tsx.includes('function useEntityPickerOptions')
  && tsx.includes('function normalizeEntityPickerItems');
