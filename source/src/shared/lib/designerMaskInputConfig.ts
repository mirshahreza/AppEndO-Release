import IMask from 'imask';
import type { FactoryArg } from 'imask';

export type DesignerMaskInputKind = 'pattern' | 'number' | 'date' | 'regexp' | 'enum' | 'dynamic' | 'custom';

export type DesignerMaskInputPresetId =
  | 'custom'
  | 'digits-only'
  | 'letters-only'
  | 'alphanumeric'
  | 'phone-intl'
  | 'phone-ir-mobile'
  | 'phone-ir-landline'
  | 'national-id-ir'
  | 'postal-code-ir'
  | 'credit-card'
  | 'cvv'
  | 'expiry-mm-yy'
  | 'date-iso'
  | 'date-eu'
  | 'date-us'
  | 'time-hm'
  | 'time-hms'
  | 'datetime-local'
  | 'ipv4'
  | 'mac-address'
  | 'currency'
  | 'percent'
  | 'slug'
  | 'hex-color'
  | 'uuid'
  | 'iban';

export type DesignerMaskInputConfigProps = {
  maskKind?: unknown;
  maskPreset?: unknown;
  maskPattern?: unknown;
  maskPlaceholderChar?: unknown;
  maskLazy?: unknown;
  maskEager?: unknown;
  maskOverwrite?: unknown;
  maskAutofix?: unknown;
  maskDefinitions?: unknown;
  maskBlocks?: unknown;
  maskEnum?: unknown;
  maskRegExp?: unknown;
  maskNumberScale?: unknown;
  maskNumberRadix?: unknown;
  maskNumberThousandsSeparator?: unknown;
  maskNumberPadFractionalZeros?: unknown;
  maskNumberNormalizeZeros?: unknown;
  maskNumberMin?: unknown;
  maskNumberMax?: unknown;
  maskDatePattern?: unknown;
  maskOptionsJson?: unknown;
  unmask?: unknown;
};

export type DesignerMaskInputInspectorOption = { value: string; label: string };

export const DESIGNER_MASK_INPUT_KIND_OPTIONS: DesignerMaskInputInspectorOption[] = [
  { value: 'pattern', label: 'Pattern (template)' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'regexp', label: 'RegExp' },
  { value: 'enum', label: 'Enum (fixed list)' },
  { value: 'dynamic', label: 'Dynamic (multiple masks)' },
  { value: 'custom', label: 'Custom JSON (full IMask config)' },
];

export const DESIGNER_MASK_INPUT_PRESET_OPTIONS: DesignerMaskInputInspectorOption[] = [
  { value: 'custom', label: 'Custom pattern' },
  { value: 'digits-only', label: 'Digits only' },
  { value: 'letters-only', label: 'Letters only' },
  { value: 'alphanumeric', label: 'Alphanumeric' },
  { value: 'phone-intl', label: 'Phone — international (+…)' },
  { value: 'phone-ir-mobile', label: 'Phone — Iran mobile (09…)' },
  { value: 'phone-ir-landline', label: 'Phone — Iran landline' },
  { value: 'national-id-ir', label: 'National ID — Iran (10 digits)' },
  { value: 'postal-code-ir', label: 'Postal code — Iran (10 digits)' },
  { value: 'credit-card', label: 'Credit card (16 digits)' },
  { value: 'cvv', label: 'CVV (3 digits)' },
  { value: 'expiry-mm-yy', label: 'Card expiry (MM/YY)' },
  { value: 'date-iso', label: 'Date — ISO (YYYY-MM-DD)' },
  { value: 'date-eu', label: 'Date — EU (DD/MM/YYYY)' },
  { value: 'date-us', label: 'Date — US (MM/DD/YYYY)' },
  { value: 'time-hm', label: 'Time — HH:mm' },
  { value: 'time-hms', label: 'Time — HH:mm:ss' },
  { value: 'datetime-local', label: 'Datetime — YYYY-MM-DDTHH:mm' },
  { value: 'ipv4', label: 'IPv4 address' },
  { value: 'mac-address', label: 'MAC address' },
  { value: 'currency', label: 'Currency (decimal)' },
  { value: 'percent', label: 'Percent (0–100)' },
  { value: 'slug', label: 'URL slug (a-z, 0-9, -)' },
  { value: 'hex-color', label: 'Hex color (#RRGGBB)' },
  { value: 'uuid', label: 'UUID' },
  { value: 'iban', label: 'IBAN (generic blocks)' },
];

const PRESET_DEFINITIONS: Record<DesignerMaskInputPresetId, FactoryArg | { kind: DesignerMaskInputKind; options: FactoryArg }> = {
  custom: { mask: '' },
  'digits-only': { mask: /^\d*$/ },
  'letters-only': { mask: /^[A-Za-z]*$/ },
  alphanumeric: { mask: /^[A-Za-z0-9]*$/ },
  'phone-intl': { mask: '+000000000000000' },
  'phone-ir-mobile': { mask: '00000000000', placeholderChar: '_' },
  'phone-ir-landline': { mask: '00000000000' },
  'national-id-ir': { mask: '0000000000' },
  'postal-code-ir': { mask: '0000000000' },
  'credit-card': { mask: '0000 0000 0000 0000' },
  cvv: { mask: '000' },
  'expiry-mm-yy': { mask: '00/00' },
  'date-iso': { kind: 'date', options: { mask: Date, pattern: 'Y-m-d' } },
  'date-eu': { kind: 'date', options: { mask: Date, pattern: 'd/m/Y' } },
  'date-us': { kind: 'date', options: { mask: Date, pattern: 'm/d/Y' } },
  'time-hm': { mask: '00:00' },
  'time-hms': { mask: '00:00:00' },
  'datetime-local': { mask: '0000-00-00T00:00' },
  ipv4: { mask: '000.000.000.000' },
  'mac-address': {
    mask: '**:**:**:**:**:**',
    definitions: { '*': /[0-9A-Fa-f]/ },
  },
  currency: {
    kind: 'number',
    options: {
      mask: Number,
      scale: 2,
      thousandsSeparator: ',',
      radix: '.',
      padFractionalZeros: false,
      normalizeZeros: true,
    },
  },
  percent: {
    kind: 'number',
    options: {
      mask: Number,
      scale: 0,
      min: 0,
      max: 100,
    },
  },
  slug: { mask: /^[a-z0-9-]*$/ },
  'hex-color': {
    mask: '#HHHHHH',
    definitions: { H: /[0-9A-Fa-f]/ },
  },
  uuid: {
    mask: '********-****-****-****-************',
    definitions: { '*': /[0-9A-Fa-f]/ },
  },
  iban: {
    mask: 'aa00 0000 0000 0000 0000 0000 0000',
    definitions: { a: /[A-Za-z]/, '0': /[0-9A-Za-z]/ },
  },
};

export const normalizeDesignerMaskInputKind = (value: unknown): DesignerMaskInputKind => {
  if (
    value === 'number'
    || value === 'date'
    || value === 'regexp'
    || value === 'enum'
    || value === 'dynamic'
    || value === 'custom'
  ) {
    return value;
  }
  return 'pattern';
};

export const normalizeDesignerMaskInputPreset = (value: unknown): DesignerMaskInputPresetId => {
  if (typeof value === 'string' && value in PRESET_DEFINITIONS) {
    return value as DesignerMaskInputPresetId;
  }
  return 'custom';
};

const readStringProp = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const readBooleanProp = (value: unknown, fallback = false): boolean =>
  value === true ? true : value === false ? false : fallback;

const readOptionalNumberProp = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const parseJsonObject = (raw: unknown): Record<string, unknown> | null => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
};

const parseJsonValue = (raw: unknown): unknown => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const parseMaskDefinitions = (raw: unknown): Record<string, RegExp> | undefined => {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return undefined;
  }

  const definitions: Record<string, RegExp> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string' && value.length > 0) {
      try {
        definitions[key] = new RegExp(value);
      } catch {
        // ignore invalid regex fragments
      }
    }
  }

  return Object.keys(definitions).length > 0 ? definitions : undefined;
};

const parseMaskRegExp = (raw: unknown): RegExp | undefined => {
  const source = readStringProp(raw).trim();
  if (!source) {
    return undefined;
  }

  if (source.startsWith('/') && source.lastIndexOf('/') > 0) {
    const lastSlash = source.lastIndexOf('/');
    const pattern = source.slice(1, lastSlash);
    const flags = source.slice(lastSlash + 1);
    try {
      return new RegExp(pattern, flags);
    } catch {
      return undefined;
    }
  }

  try {
    return new RegExp(source);
  } catch {
    return undefined;
  }
};

const appendSharedMaskOptions = (
  options: Record<string, unknown>,
  props: DesignerMaskInputConfigProps,
): Record<string, unknown> => {
  const placeholderChar = readStringProp(props.maskPlaceholderChar, '_').slice(0, 1) || '_';
  const propDefinitions = parseMaskDefinitions(props.maskDefinitions);
  const existingDefinitions = options.definitions && typeof options.definitions === 'object'
    ? options.definitions as Record<string, RegExp>
    : undefined;
  const mergedDefinitions = propDefinitions || existingDefinitions
    ? { ...existingDefinitions, ...propDefinitions }
    : undefined;

  return {
    ...options,
    placeholderChar,
    lazy: readBooleanProp(props.maskLazy, true),
    eager: readBooleanProp(props.maskEager, false),
    overwrite: readBooleanProp(props.maskOverwrite, true),
    autofix: readBooleanProp(props.maskAutofix, true),
    ...(mergedDefinitions ? { definitions: mergedDefinitions } : {}),
  };
};

const buildNumberMaskOptions = (props: DesignerMaskInputConfigProps): Record<string, unknown> => {
  const scale = readOptionalNumberProp(props.maskNumberScale);
  const min = readOptionalNumberProp(props.maskNumberMin);
  const max = readOptionalNumberProp(props.maskNumberMax);
  const radix = readStringProp(props.maskNumberRadix, '.');
  const thousandsSeparator = readStringProp(props.maskNumberThousandsSeparator, ',');

  return appendSharedMaskOptions({
    mask: Number,
    ...(scale !== undefined ? { scale } : {}),
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    radix,
    thousandsSeparator,
    padFractionalZeros: readBooleanProp(props.maskNumberPadFractionalZeros, false),
    normalizeZeros: readBooleanProp(props.maskNumberNormalizeZeros, true),
  }, props);
};

const resolvePresetDatePattern = (preset: DesignerMaskInputPresetId): string => {
  const entry = PRESET_DEFINITIONS[preset];
  if ('kind' in entry && entry.kind === 'date') {
    return readStringProp((entry.options as { pattern?: unknown }).pattern, 'Y-m-d');
  }
  return '';
};

const buildDateMaskOptions = (props: DesignerMaskInputConfigProps): Record<string, unknown> => {
  const preset = normalizeDesignerMaskInputPreset(props.maskPreset);
  const presetPattern = resolvePresetDatePattern(preset);
  const pattern = readStringProp(props.maskDatePattern, presetPattern || 'Y-m-d').trim() || 'Y-m-d';

  return appendSharedMaskOptions({
    mask: Date,
    pattern,
  }, props);
};

const buildEnumMaskOptions = (props: DesignerMaskInputConfigProps): Record<string, unknown> => {
  const values = readStringProp(props.maskEnum)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return appendSharedMaskOptions({
    mask: IMask.MaskedEnum,
    enum: values.length > 0 ? values : [''],
  }, props);
};

const buildDynamicMaskOptions = (props: DesignerMaskInputConfigProps): Record<string, unknown> => {
  const revivedBlocks = reviveDesignerMaskJsonBlocks(props.maskBlocks);
  const revivedOptions = reviveDesignerMaskJsonBlocks(props.maskOptionsJson);

  const mask = revivedBlocks && revivedBlocks.length > 0
    ? revivedBlocks
    : revivedOptions && revivedOptions.length > 0
      ? revivedOptions
      : [{ mask: readStringProp(props.maskPattern, '0000000000') }];

  return appendSharedMaskOptions({ mask }, props);
};

const buildCustomMaskOptions = (props: DesignerMaskInputConfigProps): FactoryArg => {
  const revived = reviveDesignerMaskJsonObject(props.maskOptionsJson);
  if (revived) {
    return appendSharedMaskOptions(revived, props) as FactoryArg;
  }
  return appendSharedMaskOptions({ mask: readStringProp(props.maskPattern) || '0000' }, props) as FactoryArg;
};

const resolvePresetOptions = (
  presetId: DesignerMaskInputPresetId,
  props: DesignerMaskInputConfigProps,
): FactoryArg => {
  const preset = PRESET_DEFINITIONS[presetId];
  if ('kind' in preset && preset.kind === 'date') {
    return appendSharedMaskOptions(preset.options as Record<string, unknown>, props) as FactoryArg;
  }
  if ('kind' in preset && preset.kind === 'number') {
    return appendSharedMaskOptions(preset.options as Record<string, unknown>, props) as FactoryArg;
  }
  return appendSharedMaskOptions(preset as Record<string, unknown>, props) as FactoryArg;
};

export const buildDesignerImaskOptions = (props: DesignerMaskInputConfigProps): FactoryArg => {
  const kind = normalizeDesignerMaskInputKind(props.maskKind);
  const preset = normalizeDesignerMaskInputPreset(props.maskPreset);
  const customPattern = readStringProp(props.maskPattern).trim();

  if (kind === 'custom') {
    return buildCustomMaskOptions(props);
  }

  if (kind === 'number') {
    const preset = normalizeDesignerMaskInputPreset(props.maskPreset);
    if (preset === 'currency' || preset === 'percent') {
      return resolvePresetOptions(preset, props);
    }
    return buildNumberMaskOptions(props) as FactoryArg;
  }

  if (kind === 'date') {
    return buildDateMaskOptions(props) as FactoryArg;
  }

  if (kind === 'regexp') {
    const expression = parseMaskRegExp(props.maskRegExp) ?? /^.*$/;
    return appendSharedMaskOptions({ mask: expression }, props) as FactoryArg;
  }

  if (kind === 'enum') {
    return buildEnumMaskOptions(props) as FactoryArg;
  }

  if (kind === 'dynamic') {
    return buildDynamicMaskOptions(props) as FactoryArg;
  }

  if (preset !== 'custom') {
    return resolvePresetOptions(preset, props);
  }

  return appendSharedMaskOptions({
    mask: customPattern || '0000000000',
  }, props) as FactoryArg;
};

export const shouldDesignerMaskInputUnmask = (props: DesignerMaskInputConfigProps): boolean =>
  readBooleanProp(props.unmask, false);

export const designerMaskInputPlaceholderHint = (
  presetInput: unknown,
  patternInput: unknown,
): string => {
  const preset = normalizeDesignerMaskInputPreset(presetInput);
  if (preset === 'phone-ir-mobile') {
    return '09123456789';
  }
  if (preset === 'credit-card') {
    return '1234 5678 9012 3456';
  }
  if (preset === 'date-iso') {
    return '2024-03-07';
  }
  const pattern = readStringProp(patternInput).trim();
  return pattern || '0000-0000';
};

export const toDesignerMaskInputSelectOptions = (
  options: DesignerMaskInputInspectorOption[],
): Array<{ value: string; label: string }> => options.map((option) => ({ ...option }));

export type DesignerMaskInputPreview = {
  template: string;
  example: string;
  legend: string;
  inputPlaceholder: string;
};

const PATTERN_MASK_LEGEND = 'Pattern: 0 = digit · a = letter · * = any · fixed chars stay as typed';

const PRESET_PREVIEW: Partial<Record<DesignerMaskInputPresetId, {
  example: string;
  legend?: string;
  inputPlaceholder?: string;
}>> = {
  'phone-ir-mobile': {
    example: '09123456789',
    legend: '11 digits · Iranian mobile',
    inputPlaceholder: '09_________',
  },
  'phone-ir-landline': { example: '02112345678', legend: '11 digits · Iranian landline' },
  'phone-intl': { example: '+989123456789', legend: 'International phone with +' },
  'national-id-ir': { example: '0012345678', legend: '10 digits · Iranian national ID' },
  'postal-code-ir': { example: '1234567890', legend: '10 digits · Iranian postal code' },
  'credit-card': { example: '1234 5678 9012 3456' },
  cvv: { example: '123' },
  'expiry-mm-yy': { example: '12/28' },
  'date-iso': { example: '2024-03-07', legend: 'Date · Y-m-d' },
  'date-eu': { example: '07/03/2024', legend: 'Date · d/m/Y' },
  'date-us': { example: '03/07/2024', legend: 'Date · m/d/Y' },
  'time-hm': { example: '14:30' },
  'time-hms': { example: '14:30:45' },
  'datetime-local': { example: '2024-03-07T14:30' },
  ipv4: { example: '192.168.0.1' },
  'mac-address': { example: 'AA:BB:CC:DD:EE:FF' },
  currency: { example: '1,234.56', legend: 'Decimal number with separators' },
  percent: { example: '75', legend: 'Integer 0–100' },
  slug: { example: 'my-page-title', legend: 'Lowercase letters, digits, hyphen' },
  'hex-color': { example: '#3B82F6' },
  uuid: { example: '550e8400-e29b-41d4-a716-446655440000' },
  iban: { example: 'DE89 3704 0044 0532 0130 00' },
  'digits-only': { example: '123456', legend: 'Digits only (free length)' },
  'letters-only': { example: 'AppEndO', legend: 'Letters only (free length)' },
  alphanumeric: { example: 'App123', legend: 'Letters and digits (free length)' },
};

const patternToTemplate = (
  pattern: string,
  placeholderChar: string,
  definitions?: Record<string, RegExp>,
): string => pattern.split('').map((character) => {
  if (character === '0') {
    return placeholderChar;
  }
  if (character === 'a') {
    return 'a';
  }
  if (character === '*') {
    return placeholderChar;
  }
  if (definitions?.[character]) {
    return placeholderChar;
  }
  return character;
}).join('');

const datePatternToTemplate = (pattern: string, placeholderChar: string): string => {
  let template = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === 'Y') {
      template += placeholderChar.repeat(4);
      continue;
    }
    if (character === 'm' || character === 'd' || character === 'H' || character === 'M' || character === 'S') {
      template += placeholderChar.repeat(2);
      continue;
    }
    template += character;
  }
  return template;
};

const datePatternToExample = (pattern: string): string => {
  const now = new Date(2024, 2, 7, 14, 30, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return pattern
    .replace(/Y+/g, String(now.getFullYear()))
    .replace(/m+/g, pad(now.getMonth() + 1))
    .replace(/d+/g, pad(now.getDate()))
    .replace(/H+/g, pad(now.getHours()))
    .replace(/M+/g, pad(now.getMinutes()))
    .replace(/S+/g, pad(now.getSeconds()));
};

const reviveMaskJsonValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    if (value === 'Number') {
      return Number;
    }
    if (value === 'Date') {
      return Date;
    }
    if (value.startsWith('/') && value.lastIndexOf('/') > 0) {
      const revived = parseMaskRegExp(value);
      if (revived) {
        return revived;
      }
    }
    if (/^\[.*\]$/.test(value)) {
      try {
        return new RegExp(value.slice(1, -1));
      } catch {
        return value;
      }
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => reviveMaskJsonValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, reviveMaskJsonValue(entry)]),
    );
  }

  return value;
};

const reviveDesignerMaskJsonObject = (raw: unknown): Record<string, unknown> | null => {
  const parsed = typeof raw === 'string' ? parseJsonValue(raw) : raw;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  return reviveMaskJsonValue(parsed) as Record<string, unknown>;
};

const reviveDesignerMaskJsonBlocks = (raw: unknown): unknown[] | null => {
  const parsed = typeof raw === 'string' ? parseJsonValue(raw) : raw;
  if (Array.isArray(parsed)) {
    return reviveMaskJsonValue(parsed) as unknown[];
  }
  if (parsed && typeof parsed === 'object') {
    return [reviveMaskJsonValue(parsed)];
  }
  return null;
};

const extractPatternFromOptions = (options: Record<string, unknown>): string => {
  const mask = options.mask;
  if (typeof mask === 'string') {
    return mask;
  }
  if (mask === Number) {
    return '# number #';
  }
  if (mask === Date) {
    return readStringProp(options.pattern, 'Y-m-d');
  }
  return '';
};

export const resolveDesignerMaskInputMaxLength = (
  props: DesignerMaskInputConfigProps,
): number | undefined => {
  const preview = resolveDesignerMaskInputPreview(props);
  const { template } = preview;
  if (!template || template.startsWith('#') || template === 'Dynamic mask' || template === 'Custom JSON mask') {
    return undefined;
  }
  return template.length;
};

export const resolveDesignerMaskInputInputMode = (
  props: DesignerMaskInputConfigProps,
): 'decimal' | 'numeric' | 'text' | undefined => {
  const kind = normalizeDesignerMaskInputKind(props.maskKind);
  const preset = normalizeDesignerMaskInputPreset(props.maskPreset);

  if (kind === 'number' || preset === 'currency' || preset === 'percent') {
    return 'decimal';
  }
  if (kind === 'date') {
    return 'numeric';
  }
  if (
    preset === 'phone-ir-mobile'
    || preset === 'phone-ir-landline'
    || preset === 'phone-intl'
    || preset === 'national-id-ir'
    || preset === 'postal-code-ir'
    || preset === 'credit-card'
    || preset === 'cvv'
    || preset === 'digits-only'
  ) {
    return 'numeric';
  }
  if (preset === 'hex-color' || preset === 'mac-address' || preset === 'uuid') {
    return 'text';
  }
  return undefined;
};

export const resolveDesignerMaskInputPreview = (
  props: DesignerMaskInputConfigProps,
): DesignerMaskInputPreview => {
  const kind = normalizeDesignerMaskInputKind(props.maskKind);
  const preset = normalizeDesignerMaskInputPreset(props.maskPreset);
  const placeholderChar = readStringProp(props.maskPlaceholderChar, '_').slice(0, 1) || '_';
  const customPattern = readStringProp(props.maskPattern).trim();
  const options = buildDesignerImaskOptions(props) as Record<string, unknown>;

  if (kind === 'number') {
    const scale = readOptionalNumberProp(props.maskNumberScale) ?? readOptionalNumberProp(
      (options as { scale?: unknown }).scale,
    ) ?? 0;
    const thousandsSeparator = readStringProp(props.maskNumberThousandsSeparator, ',');
    const radix = readStringProp(props.maskNumberRadix, '.');
    const example = scale > 0
      ? `1${thousandsSeparator}234${radix}${'0'.repeat(scale)}`
      : `1${thousandsSeparator}234`;
    const template = scale > 0
      ? `#${thousandsSeparator}###${radix}${'#'.repeat(scale)}`
      : `#${thousandsSeparator}###`;

    return {
      template,
      example,
      legend: 'Number mask · optional min/max from properties',
      inputPlaceholder: template,
    };
  }

  if (kind === 'date') {
    const pattern = readStringProp(props.maskDatePattern, readStringProp(options.pattern, 'Y-m-d'));
    const template = datePatternToTemplate(pattern, placeholderChar);
    const example = datePatternToExample(pattern);
    return {
      template,
      example,
      legend: 'Date mask · Y = year · m = month · d = day · H/M/S = time',
      inputPlaceholder: template,
    };
  }

  if (kind === 'regexp') {
    const source = readStringProp(props.maskRegExp, '/.*/');
    return {
      template: source,
      example: 'abc_123',
      legend: 'RegExp mask · only matching text is accepted',
      inputPlaceholder: '…',
    };
  }

  if (kind === 'enum') {
    const values = readStringProp(props.maskEnum)
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return {
      template: values.join(' | ') || '(add enum values)',
      example: values[0] ?? 'option-a',
      legend: 'Enum mask · choose one listed value',
      inputPlaceholder: values[0] ?? 'option-a',
    };
  }

  if (kind === 'dynamic') {
    const blocks = reviveDesignerMaskJsonBlocks(props.maskBlocks);
    const blockPatterns = (blocks ?? [])
      .map((block) => {
        if (block && typeof block === 'object' && 'mask' in block) {
          const mask = (block as { mask?: unknown }).mask;
          if (typeof mask === 'string') {
            return mask;
          }
        }
        return null;
      })
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    const template = blockPatterns.length > 0
      ? blockPatterns.map((pattern) => patternToTemplate(pattern, placeholderChar)).join(' · ')
      : 'Dynamic mask';
    const example = blockPatterns[0] ?? readStringProp(props.maskPattern, '000-0000');

    return {
      template,
      example,
      legend: 'Dynamic mask · first matching block wins',
      inputPlaceholder: blockPatterns[0]
        ? patternToTemplate(blockPatterns[0], placeholderChar)
        : '…',
    };
  }

  if (kind === 'custom') {
    const revived = reviveDesignerMaskJsonObject(props.maskOptionsJson);
    const pattern = revived ? extractPatternFromOptions(revived) : customPattern;
    const template = typeof pattern === 'string' && pattern.length > 0
      ? patternToTemplate(pattern, placeholderChar, parseMaskDefinitions(props.maskDefinitions))
      : 'Custom JSON mask';
    return {
      template,
      example: customPattern || 'sample',
      legend: 'Custom IMask JSON · use /pattern/flags or [pattern] for RegExp',
      inputPlaceholder: template,
    };
  }

  if (preset !== 'custom') {
    const presetMeta = PRESET_PREVIEW[preset];
    const pattern = extractPatternFromOptions(options as Record<string, unknown>);
    const template = pattern && !pattern.startsWith('#')
      ? patternToTemplate(pattern, placeholderChar, (options as { definitions?: Record<string, RegExp> }).definitions)
      : presetMeta?.example ?? pattern;
    return {
      template,
      example: presetMeta?.example ?? designerMaskInputPlaceholderHint(preset, pattern),
      legend: presetMeta?.legend ?? PATTERN_MASK_LEGEND,
      inputPlaceholder: presetMeta?.inputPlaceholder ?? template,
    };
  }

  const pattern = customPattern || '0000000000';
  const template = patternToTemplate(pattern, placeholderChar, parseMaskDefinitions(props.maskDefinitions));
  return {
    template,
    example: designerMaskInputPlaceholderHint('custom', pattern),
    legend: PATTERN_MASK_LEGEND,
    inputPlaceholder: template,
  };
};

