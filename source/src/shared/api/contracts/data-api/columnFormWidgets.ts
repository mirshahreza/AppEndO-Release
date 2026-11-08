import { z } from 'zod';

/**
 * Form display widget for a column (studio-meta).
 * Used by generated UIs; unset means infer from column type.
 */
export const COLUMN_FORM_WIDGET_VALUES = [
  'text',
  'multiline',
  'html',
  'code',
  'markdown',
  'json',
  'number',
  'currency',
  'checkbox',
  'switch',
  'select',
  'dropdown',
  'tags',
  'date',
  'datetime',
  'time',
  'password',
  'email',
  'url',
  'phone',
  'color',
  'image',
  'file',
  'lookup',
  'hidden',
] as const;

export type ColumnFormWidget = (typeof COLUMN_FORM_WIDGET_VALUES)[number];

export const columnFormWidgetSchema = z.enum(COLUMN_FORM_WIDGET_VALUES);

/**
 * UiSelect drops empty option values, so Auto uses this non-empty sentinel in the
 * Column Properties select; map to '' / omit before persisting studio-meta.
 */
export const COLUMN_FORM_WIDGET_AUTO_SELECT_VALUE = 'auto' as const;

export type ColumnFormWidgetOption = {
  value: ColumnFormWidget;
  label: string;
  description: string;
};

/** Operator-facing catalog for Column Properties. */
export const COLUMN_FORM_WIDGET_OPTIONS: readonly ColumnFormWidgetOption[] = [
  { value: 'text', label: 'Text', description: 'Single-line text input.' },
  { value: 'multiline', label: 'Multiline text', description: 'Multi-line plain text area.' },
  { value: 'html', label: 'HTML', description: 'Rich HTML editor.' },
  { value: 'code', label: 'Code', description: 'Monospace code editor.' },
  { value: 'markdown', label: 'Markdown', description: 'Markdown editor with preview.' },
  { value: 'json', label: 'JSON', description: 'Structured JSON editor.' },
  { value: 'number', label: 'Number box', description: 'Numeric spinner / input.' },
  { value: 'currency', label: 'Currency', description: 'Money amount with formatting.' },
  { value: 'checkbox', label: 'Checkbox', description: 'Boolean checkbox.' },
  { value: 'switch', label: 'Switch', description: 'Boolean toggle switch.' },
  { value: 'select', label: 'Select box', description: 'Always-visible choice list (radio / listbox).' },
  { value: 'dropdown', label: 'Dropdown box', description: 'Compact dropdown select.' },
  { value: 'tags', label: 'Tags', description: 'Multi-value tags / chips.' },
  { value: 'date', label: 'Date', description: 'Calendar date picker.' },
  { value: 'datetime', label: 'Date & time', description: 'Date and time picker.' },
  { value: 'time', label: 'Time', description: 'Time-only picker.' },
  { value: 'password', label: 'Password', description: 'Masked secret input.' },
  { value: 'email', label: 'Email', description: 'Email address with validation.' },
  { value: 'url', label: 'URL', description: 'Web address input.' },
  { value: 'phone', label: 'Phone', description: 'Telephone number input.' },
  { value: 'color', label: 'Color', description: 'Color swatch / picker.' },
  { value: 'image', label: 'Image field', description: 'Image upload / preview.' },
  { value: 'file', label: 'File field', description: 'Generic file upload.' },
  { value: 'lookup', label: 'Lookup', description: 'Relation / foreign-key picker.' },
  { value: 'hidden', label: 'Hidden', description: 'Stored but not shown on the form.' },
];

export const COLUMN_FORM_WIDGET_LABEL_BY_VALUE: Record<ColumnFormWidget, string> = (
  Object.fromEntries(
    COLUMN_FORM_WIDGET_OPTIONS.map((option) => [option.value, option.label]),
  ) as Record<ColumnFormWidget, string>
);
