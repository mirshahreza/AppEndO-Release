import type { ApiFormField } from './apiFieldSchema';
import { isBaseInfoCodeField } from './baseInfoFieldInference';

/**
 * Maps an API request field to a Component Designer form control (palette item),
 * and builds the control's default props. Pure + UI-agnostic so it can be unit tested
 * and reused by the auto-form wizard.
 */

/** Form-input palette items the wizard can scaffold + offer as control overrides. */
export const AUTO_FORM_CONTROL_PALETTE_ITEM_IDS = [
  'heroui.input-text',
  'heroui.textarea',
  'heroui.number-input',
  'heroui.select',
  'heroui.autocomplete',
  'heroui.entity-picker',
  'heroui.switch',
  'heroui.checkbox-group',
  'heroui.radio-group',
  'heroui.slider',
  'heroui.date-picker',
  'form.date-range',
  'heroui.tags-input',
  'html.file-upload',
  'hwy.institute-logo-upload',
  'form.code-editor',
  'form.html-editor',
  'form.markdown-editor',
  'form.mask-input',
  'form.calculator',
  'heroui.color-control',
] as const;

export type AutoFormControlPaletteItemId = typeof AUTO_FORM_CONTROL_PALETTE_ITEM_IDS[number];

export const AUTO_FORM_CONTROL_LABELS: Record<AutoFormControlPaletteItemId, string> = {
  'heroui.input-text': 'Text input',
  'heroui.textarea': 'Textarea',
  'heroui.number-input': 'Number input',
  'heroui.select': 'Select',
  'heroui.autocomplete': 'Autocomplete',
  'heroui.entity-picker': 'Entity picker',
  'heroui.switch': 'Switch (boolean)',
  'heroui.checkbox-group': 'Checkbox group',
  'heroui.radio-group': 'Radio group',
  'heroui.slider': 'Slider',
  'heroui.date-picker': 'Date picker',
  'form.date-range': 'Date range',
  'heroui.tags-input': 'Tags input',
  'html.file-upload': 'File upload',
  'hwy.institute-logo-upload': 'Institute logo upload',
  'form.code-editor': 'Code editor',
  'form.html-editor': 'Rich text editor',
  'form.markdown-editor': 'Markdown editor',
  'form.mask-input': 'Mask input',
  'form.calculator': 'Calculator',
  'heroui.color-control': 'Color editor',
};

/** Humanizes a snake/camel field name into a readable label (e.g. `due_date` → `Due date`). */
export const humanizeFieldName = (name: string): string => {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!spaced) {
    return name;
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** The HeroUI value prop a control binds to (matches `resolvePreferredValuePropForNode` where applicable). */
export const valuePropForControl = (paletteItemId: string): string => {
  if (
    paletteItemId === 'heroui.switch'
    || paletteItemId === 'heroui.checkbox-group'
    || paletteItemId === 'heroui.radio-group'
  ) {
    return 'isSelected';
  }
  if (
    paletteItemId === 'heroui.select'
    || paletteItemId === 'heroui.autocomplete'
    || paletteItemId === 'heroui.entity-picker'
  ) {
    return 'selectedKeys';
  }
  if (paletteItemId === 'form.date-range') {
    return 'startValue';
  }
  return 'value';
};

const DATE_FORMATS = new Set(['date', 'date-time', 'datetime', 'time']);
const FILE_FORMATS = new Set(['binary', 'byte']);
// Substring match so snake/camel names like `resume_file` / `userAttachment` still hit.
// Phase 18 scope: only file / attachment / upload (format binary|byte covers image/avatar payloads).
const FILE_NAME_RE = /file|attachment|upload/i;
const FOREIGN_KEY_NAME_RE = /(_id|Id|ID)$/;

/** True when OpenAPI format/name strongly suggests a file upload control. */
export const isLikelyFileUploadField = (field: ApiFormField): boolean => {
  const format = field.format?.toLowerCase();
  if (format && FILE_FORMATS.has(format)) {
    return true;
  }
  return FILE_NAME_RE.test(field.name);
};

/** True when the field name looks like a foreign-key / entity reference. */
export const isLikelyForeignKeyField = (field: ApiFormField): boolean => {
  if (isBaseInfoCodeField(field.name)) {
    return false;
  }
  return FOREIGN_KEY_NAME_RE.test(field.name.trim());
};

/** True when both numeric bounds are present (slider is a useful alternative to number-input). */
export const hasNumericBounds = (field: ApiFormField): boolean =>
  typeof field.minimum === 'number'
  && Number.isFinite(field.minimum)
  && typeof field.maximum === 'number'
  && Number.isFinite(field.maximum);

/**
 * Non-default control alternatives the wizard dropdown already lists, documented here so
 * callers/tests can assert which overrides make sense for a field without changing the default.
 */
export const alternativeControlsForField = (field: ApiFormField): AutoFormControlPaletteItemId[] => {
  const alternatives: AutoFormControlPaletteItemId[] = [];
  if (field.type === 'array' && field.enum && field.enum.length > 0) {
    alternatives.push('heroui.checkbox-group');
  }
  if (field.enum && field.enum.length > 0 && field.enum.length <= 4 && field.type !== 'array') {
    alternatives.push('heroui.radio-group');
  }
  if ((field.type === 'number' || field.type === 'integer') && hasNumericBounds(field)) {
    alternatives.push('heroui.slider');
  }
  if (isLikelyForeignKeyField(field)) {
    alternatives.push('heroui.autocomplete', 'heroui.entity-picker');
  }
  if (field.type === 'string' && (field.format === 'date' || field.format === 'date-time')) {
    alternatives.push('form.date-range');
  }
  return alternatives;
};

/** Suggests the best default control for a field based on its type/format/enum. */
export const suggestControlForField = (field: ApiFormField): AutoFormControlPaletteItemId => {
  if (isLikelyFileUploadField(field)) {
    return 'html.file-upload';
  }
  if (isBaseInfoCodeField(field.name)) {
    return 'heroui.select';
  }
  if (field.type === 'boolean') {
    return 'heroui.switch';
  }
  if (field.type === 'array') {
    // Array of a fixed set → multi-select; otherwise free-form tags.
    // checkbox-group remains an explicit alternative in the wizard dropdown.
    return field.enum && field.enum.length > 0 ? 'heroui.select' : 'heroui.tags-input';
  }
  if (field.enum && field.enum.length > 0) {
    // radio-group is offered as a visual alternative for small enums (≤4), not forced.
    return 'heroui.select';
  }
  if (field.type === 'number' || field.type === 'integer') {
    // slider is offered when minimum+maximum exist; default stays number-input.
    return 'heroui.number-input';
  }
  if (field.type === 'string' && field.format) {
    const format = field.format.toLowerCase();
    if (DATE_FORMATS.has(format)) {
      return 'heroui.date-picker';
    }
    if (format === 'textarea' || format === 'multiline') {
      return 'heroui.textarea';
    }
  }
  if (field.type === 'string' && /\b(note|notes|description|body|comment|message|content|remarks)\b/i.test(field.name)) {
    return 'heroui.textarea';
  }
  return 'heroui.input-text';
};

export type MappedFormControl = {
  paletteItemId: AutoFormControlPaletteItemId;
  valueProp: string;
};

export const mapApiFieldToControl = (field: ApiFormField): MappedFormControl => {
  const paletteItemId = suggestControlForField(field);
  return { paletteItemId, valueProp: valuePropForControl(paletteItemId) };
};

const enumToSelectItems = (values: string[] | undefined): string | undefined => {
  if (!values || values.length === 0) {
    return undefined;
  }
  const items = values.map((value) => ({ id: value, textValue: humanizeFieldName(value) }));
  return JSON.stringify(items);
};

const inputTypeForField = (field: ApiFormField): string | undefined => {
  const format = field.format?.toLowerCase();
  if (format === 'email') {
    return 'email';
  }
  if (format === 'password') {
    return 'password';
  }
  if (format === 'uri' || format === 'url') {
    return 'url';
  }
  return undefined;
};

const TEXT_VALIDATION_CONTROLS = new Set([
  'heroui.input-text',
  'heroui.textarea',
  'heroui.number-input',
]);

const applyOpenApiValidationProps = (
  paletteItemId: string,
  field: ApiFormField,
  props: Record<string, unknown>,
): void => {
  if (TEXT_VALIDATION_CONTROLS.has(paletteItemId)) {
    if (field.pattern) {
      props.pattern = field.pattern;
    }
    if (typeof field.minLength === 'number' && Number.isFinite(field.minLength)) {
      props.minLength = field.minLength;
    }
    if (typeof field.maxLength === 'number' && Number.isFinite(field.maxLength)) {
      props.maxLength = field.maxLength;
    }
  }

  if (paletteItemId === 'heroui.number-input') {
    // Inspector stores min/max as strings on number-input (matches existing step='1' pattern).
    if (typeof field.minimum === 'number' && Number.isFinite(field.minimum)) {
      props.min = String(field.minimum);
    }
    if (typeof field.maximum === 'number' && Number.isFinite(field.maximum)) {
      props.max = String(field.maximum);
    }
  }

  if (paletteItemId === 'heroui.slider') {
    if (typeof field.minimum === 'number' && Number.isFinite(field.minimum)) {
      props.min = field.minimum;
    }
    if (typeof field.maximum === 'number' && Number.isFinite(field.maximum)) {
      props.max = field.maximum;
    }
  }
};

export const defaultPageGuideHintForField = (label: string, field: ApiFormField): string => {
  const name = label.trim() || 'this field';
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  if (field.enum?.length) return `Choose ${lower} from the available options.`;
  if (field.type === 'boolean') return `Turn ${lower} on or off.`;
  if (field.format === 'email') return `Enter the ${lower} email address.`;
  if (field.format === 'date' || field.format === 'date-time') return `Set ${lower}.`;
  if (field.required) return `Required. Enter ${lower}.`;
  return `Enter ${lower}.`;
};

/**
 * Builds the designer node props for a chosen control + field. Always sets `name`
 * (the API field key), `label`, and required state; control-specific extras are added too.
 */
export const buildControlProps = (
  paletteItemId: string,
  options: { field: ApiFormField; label: string },
): Record<string, unknown> => {
  const { field, label } = options;
  const props: Record<string, unknown> = {
    name: field.name,
    label,
  };

  const sizedFieldControls = new Set([
    'heroui.input-text',
    'heroui.textarea',
    'heroui.number-input',
    'heroui.select',
    'heroui.autocomplete',
    'heroui.entity-picker',
    'form.mask-input',
    'form.calculator',
    'form.date-range',
  ]);
  if (sizedFieldControls.has(paletteItemId)) {
    props.size = 'sm';
  }

  if (field.required) {
    props.isRequired = true;
  }

  switch (paletteItemId) {
    case 'heroui.input-text': {
      props.placeholder = label;
      const inputType = inputTypeForField(field);
      if (inputType) {
        props.inputType = inputType;
      }
      break;
    }
    case 'heroui.textarea':
      props.placeholder = label;
      break;
    case 'heroui.number-input':
      props.placeholder = label;
      if (field.type === 'integer') {
        props.step = '1';
      }
      break;
    case 'heroui.select':
    case 'heroui.autocomplete': {
      props.placeholder = `Select ${label.toLowerCase()}…`;
      if (!isBaseInfoCodeField(field.name)) {
        const items = enumToSelectItems(field.enum);
        if (items) {
          props.items = items;
        }
      }
      break;
    }
    case 'heroui.entity-picker':
      props.placeholder = `Select ${label.toLowerCase()}…`;
      break;
    case 'heroui.checkbox-group':
    case 'heroui.radio-group': {
      const items = enumToSelectItems(field.enum);
      if (items) {
        props.items = items;
      }
      break;
    }
    case 'heroui.slider':
      props.ariaLabel = label;
      if (field.type === 'integer') {
        props.step = 1;
      }
      break;
    case 'heroui.switch':
      props.ariaLabel = label;
      break;
    case 'heroui.tags-input':
      props.placeholder = label;
      break;
    case 'heroui.date-picker':
      props.placeholder = `Select ${label.toLowerCase()}…`;
      break;
    case 'form.date-range':
      // Manual override only in this phase (no auto pair of start_/end_ fields).
      break;
    case 'hwy.institute-logo-upload':
      props.ariaLabel = label;
      break;
    case 'html.file-upload': {
      const format = field.format?.toLowerCase();
      if (format === 'byte' || /\b(image|photo|avatar|picture)\b/i.test(field.name)) {
        props.accept = 'image/*';
      } else if (/\b(pdf|document)\b/i.test(field.name)) {
        props.accept = '.pdf,application/pdf';
      } else {
        props.accept = '*/*';
      }
      if (field.type === 'array') {
        props.multiple = true;
      }
      break;
    }
    case 'form.code-editor':
      props.placeholder = `// ${label}`;
      props.language = field.format === 'json' ? 'json' : 'typescript';
      break;
    case 'form.html-editor':
      props.placeholder = label;
      break;
    case 'form.markdown-editor':
      props.placeholder = label;
      break;
    case 'form.mask-input':
      props.placeholder = label;
      props.maskPreset = 'digits-only';
      break;
    case 'form.calculator':
      props.placeholder = label;
      break;
    case 'heroui.color-control':
      props.placeholder = '#RRGGBB';
      break;
    default:
      break;
  }

  applyOpenApiValidationProps(paletteItemId, field, props);
  props.hint = defaultPageGuideHintForField(label, field);
  return props;
};
