import { z } from 'zod';
import type { ColumnFormWidget } from './columnFormWidgets';

/** Optional widget-specific settings stored on column studio-meta. */
export const columnFormWidgetPropsSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  currencyCode: z.string().optional(),
  language: z.string().optional(),
  maxLength: z.number().int().nonnegative().optional(),
  placeholder: z.string().optional(),
  rows: z.number().int().positive().optional(),
  /** Static choices for select/dropdown/tags — one per line or comma-separated. */
  optionsText: z.string().optional(),
  maxTags: z.number().int().positive().optional(),
  accept: z.string().optional(),
  maxSizeMb: z.number().positive().optional(),
}).strict();

export type ColumnFormWidgetProps = z.infer<typeof columnFormWidgetPropsSchema>;

export const COLUMN_CODE_LANGUAGE_OPTIONS = [
  { value: 'plaintext', label: 'Plain text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'python', label: 'Python' },
  { value: 'csharp', label: 'C#' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
] as const;

/** Placeholder is always edited opposite Form Widget; allowed on every widget. */
const PROPS_BY_WIDGET: Record<ColumnFormWidget, ReadonlyArray<keyof ColumnFormWidgetProps>> = {
  text: ['placeholder', 'maxLength'],
  multiline: ['placeholder', 'rows', 'maxLength'],
  html: ['placeholder', 'rows'],
  code: ['placeholder', 'language', 'rows'],
  markdown: ['placeholder', 'rows'],
  json: ['placeholder', 'rows'],
  number: ['placeholder', 'min', 'max', 'step'],
  currency: ['placeholder', 'min', 'max', 'step', 'currencyCode'],
  checkbox: ['placeholder'],
  switch: ['placeholder'],
  select: ['placeholder', 'optionsText'],
  dropdown: ['placeholder', 'optionsText'],
  tags: ['placeholder', 'optionsText', 'maxTags'],
  date: ['placeholder'],
  datetime: ['placeholder'],
  time: ['placeholder'],
  password: ['placeholder', 'maxLength'],
  email: ['placeholder', 'maxLength'],
  url: ['placeholder', 'maxLength'],
  phone: ['placeholder', 'maxLength'],
  color: ['placeholder'],
  image: ['placeholder', 'accept', 'maxSizeMb'],
  file: ['placeholder', 'accept', 'maxSizeMb'],
  lookup: ['placeholder'],
  hidden: ['placeholder'],
};

export const widgetHasFormProps = (widget: ColumnFormWidget | '' | undefined): boolean => {
  if (!widget) {
    return false;
  }
  return PROPS_BY_WIDGET[widget].length > 0;
};

/** Keep only keys relevant to the selected widget; drop empty values. */
export const pruneColumnFormWidgetProps = (
  widget: ColumnFormWidget | '' | undefined,
  props: ColumnFormWidgetProps | null | undefined,
): ColumnFormWidgetProps | undefined => {
  if (!props) {
    return undefined;
  }

  // Auto / unknown widget: still keep Placeholder (always edited opposite Form Widget).
  const allowedKeys = widget ? PROPS_BY_WIDGET[widget] : undefined;
  if (!allowedKeys) {
    const placeholder = props.placeholder?.trim();
    return placeholder ? { placeholder } : undefined;
  }

  const allowed = new Set(allowedKeys);
  const next: ColumnFormWidgetProps = {};
  for (const key of allowed) {
    const value = props[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'string' && !value.trim()) {
      continue;
    }
    if (typeof value === 'string') {
      next[key] = value.trim() as never;
    } else {
      next[key] = value as never;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
};

export const createEmptyColumnFormWidgetProps = (): ColumnFormWidgetProps => ({});

/** Default Rows for multiline / code / html / markdown / json editors. */
export const DEFAULT_COLUMN_FORM_WIDGET_ROWS = 3;

const widgetSupportsRows = (widget: ColumnFormWidget | '' | undefined): boolean => (
  Boolean(widget && PROPS_BY_WIDGET[widget].includes('rows'))
);

/**
 * Prune widget props, then fill defaults for the selected widget.
 * Multiline-style widgets get `rows: 3` when unset.
 */
export const applyColumnFormWidgetPropDefaults = (
  widget: ColumnFormWidget | '' | undefined,
  props: ColumnFormWidgetProps | null | undefined,
): ColumnFormWidgetProps => {
  const pruned = pruneColumnFormWidgetProps(widget, props) ?? createEmptyColumnFormWidgetProps();
  if (widgetSupportsRows(widget) && pruned.rows === undefined) {
    return { ...pruned, rows: DEFAULT_COLUMN_FORM_WIDGET_ROWS };
  }
  return pruned;
};
