import type { RegionFormFieldMapping } from './bindingRegionEngine';
import { readBoolean, readNumber, readString } from './runtimeShared';
import type { CrossFieldRule, DesignerDocument, DesignerNode } from './types';
import {
  compileDesignerConditionExpression,
  isSafeDesignerRuntimeExpression,
} from './visibilityConditionEngine';

const DEFAULT_REQUIRED_MESSAGE = 'This field is required.';
const DEFAULT_PATTERN_MESSAGE = 'Value does not match the required pattern.';
const DEFAULT_MIN_LENGTH_MESSAGE = (min: number) => `Minimum length is ${min}.`;
const DEFAULT_MAX_LENGTH_MESSAGE = (max: number) => `Maximum length is ${max}.`;
const DEFAULT_MIN_VALUE_MESSAGE = (min: string) => `Minimum value is ${min}.`;
const DEFAULT_MAX_VALUE_MESSAGE = (max: string) => `Maximum value is ${max}.`;

type DesignerNodeProps = DesignerNode['props'];

const resolveValidationMessage = (props: DesignerNodeProps, fallback: string): string =>
  readString(props.errorMessage, fallback);

/**
 * Pure validation core shared by BOTH the live preview (`validateRegionSubmitFields` below,
 * and the per-keystroke check in `runtimeRenderer.tsx`) and the exported/published `.tsx`
 * bundle (`renderFormValidationLines` in `bindingCodegen.ts`, which imports this function
 * directly). Only ever reads `props` — never the rest of a `DesignerNode` — specifically so it
 * can be reused as-is by codegen'd code that only has a per-field literal props object baked in
 * at export time, not a live `DesignerNode`/`DesignerDocument`.
 */
export const validateDesignerFieldNode = (
  props: DesignerNodeProps,
  value: string,
  designerStore: Record<string, unknown> = {},
  formValues: Record<string, string> = {},
): string | null => {
  const trimmed = value.trim();
  const required = readBoolean(props.isRequired) || readBoolean(props.required);

  if (required && trimmed.length === 0) {
    return resolveValidationMessage(props, DEFAULT_REQUIRED_MESSAGE);
  }

  const validationRule = typeof props.validationRule === 'string'
    ? props.validationRule.trim()
    : '';
  if (validationRule.length > 0) {
    try {
      if (!isSafeDesignerRuntimeExpression(validationRule)) {
        return readString(props.validationErrorMessage || props.errorMessage, 'Value is invalid.');
      }
      const compiled = compileDesignerConditionExpression(validationRule);
      const evaluator = new Function(
        'designerStore',
        'dataContext',
        'value',
        `return Boolean(${compiled});`,
      ) as (
        designerStore: Record<string, unknown>,
        dataContext: Record<string, unknown> | null,
        value: string,
      ) => boolean;

      const isValid = evaluator(designerStore, formValues, value);
      if (!isValid) {
        return readString(props.validationErrorMessage || props.errorMessage, 'Value is invalid.');
      }
    } catch {
      // Ignore evaluation error
    }
  }

  if (trimmed.length === 0) {
    return null;
  }

  const minLength = readNumber(props.minLength, Number.NaN);
  if (Number.isFinite(minLength) && value.length < minLength) {
    return resolveValidationMessage(props, DEFAULT_MIN_LENGTH_MESSAGE(minLength));
  }

  const maxLength = readNumber(props.maxLength, Number.NaN);
  if (Number.isFinite(maxLength) && value.length > maxLength) {
    return resolveValidationMessage(props, DEFAULT_MAX_LENGTH_MESSAGE(maxLength));
  }

  const pattern = readString(props.pattern);
  if (pattern) {
    try {
      if (!new RegExp(pattern).test(value)) {
        return resolveValidationMessage(props, DEFAULT_PATTERN_MESSAGE);
      }
    } catch {
      // Ignore invalid inspector patterns in preview.
    }
  }

  const paletteItemId = typeof props._designerPaletteItemId === 'string'
    ? props._designerPaletteItemId
    : '';
  if (paletteItemId === 'heroui.number-input') {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      const min = readString(props.min);
      if (min && Number.isFinite(Number(min)) && numericValue < Number(min)) {
        return resolveValidationMessage(props, DEFAULT_MIN_VALUE_MESSAGE(min));
      }

      const max = readString(props.max);
      if (max && Number.isFinite(Number(max)) && numericValue > Number(max)) {
        return resolveValidationMessage(props, DEFAULT_MAX_VALUE_MESSAGE(max));
      }
    }
  }

  return null;
};

/**
 * Bug found (parity audit item 1): live per-keystroke/on-blur validation feedback
 * (`isInvalid`/`errorMessage`) only ever fired for heroui.input-text/number-input/textarea
 * (wired directly in `runtimeRenderer.tsx`'s `sharedFieldEventProps`) — every other form
 * element exposing the same validation Inspector fields (select/autocomplete/entity-picker/
 * date-picker/code-editor/html-editor/mask-input/calculator/color-control/tags-input) never
 * called `onPreviewFieldValidation` at all, so the live canvas never showed a red/invalid state
 * for them even though the fields were configured. (Submission itself was never affected by
 * this gap — Region-bound submit already validates every mapped field via
 * `validateRegionSubmitFields` regardless of live per-field feedback.) Small shared helper so
 * each of those ten call sites only needs one line instead of re-deriving this pattern.
 */
export const triggerPreviewFieldValidation = (
  nodeId: string,
  props: DesignerNodeProps,
  value: string,
  onPreviewFieldValidation: ((nodeId: string, message: string | null) => void) | undefined,
  designerStore: Record<string, unknown> = {},
  formValues: Record<string, string> = {},
): void => {
  if (!onPreviewFieldValidation) {
    return;
  }
  onPreviewFieldValidation(nodeId, validateDesignerFieldNode(props, value, designerStore, formValues));
};

const readRegionFormFieldValue = (field: Element): string => {
  if (field instanceof HTMLInputElement) {
    if (field.type === 'checkbox' || field.type === 'radio') {
      return field.checked ? 'true' : 'false';
    }

    return field.value;
  }

  if (field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    return field.value;
  }

  const value = field.getAttribute('value');
  return value ?? '';
};

export const readRegionFormFieldValueFromContainer = (
  container: ParentNode,
  formFieldName: string,
): string => {
  const escapedName = formFieldName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const field = container.querySelector(`[name="${escapedName}"]`);
  return field ? readRegionFormFieldValue(field) : '';
};

export const validateRegionSubmitFields = (
  submitRoot: ParentNode,
  fieldMappings: RegionFormFieldMapping[],
  document: DesignerDocument,
  designerStore: Record<string, unknown> = {},
  crossFieldRules?: CrossFieldRule[],
): Record<string, string> => {
  const errors: Record<string, string> = {};

  const formValues: Record<string, string> = {};
  for (const mapping of fieldMappings) {
    const val = readRegionFormFieldValueFromContainer(submitRoot, mapping.formFieldName);
    formValues[mapping.formFieldName] = val;
  }

  for (const mapping of fieldMappings) {
    const node = document.nodes[mapping.nodeId];
    if (!node) {
      continue;
    }

    const value = formValues[mapping.formFieldName] || '';
    const message = validateDesignerFieldNode(node.props, value, designerStore, formValues);
    if (message) {
      errors[mapping.nodeId] = message;
    }
  }

  if (crossFieldRules && crossFieldRules.length > 0) {
    const crossErrors = validateCrossFieldRules(crossFieldRules, formValues, fieldMappings, designerStore);
    for (const [nodeId, msg] of Object.entries(crossErrors)) {
      if (!errors[nodeId]) {
        errors[nodeId] = msg;
      }
    }
  }

  return errors;
};

const resolveCrossFieldValue = (formValues: Record<string, string>, fieldName: string): string => {
  if (fieldName in formValues) return formValues[fieldName];
  for (const [key, val] of Object.entries(formValues)) {
    if (key.endsWith(`.${fieldName}`) || key === fieldName) return val;
  }
  return '';
};

/**
 * Evaluates cross-field validation rules attached to a form/region node.
 * Returns a map of nodeId→errorMessage for each failed rule (keyed by `appliesTo`
 * which is a form field name, resolved to a nodeId via `fieldMappings`).
 */
export const validateCrossFieldRules = (
  rules: CrossFieldRule[],
  formValues: Record<string, string>,
  fieldMappings: RegionFormFieldMapping[],
  designerStore: Record<string, unknown> = {},
): Record<string, string> => {
  if (!rules || rules.length === 0) return {};

  const errors: Record<string, string> = {};
  const fieldNameToNodeId = new Map<string, string>();
  for (const m of fieldMappings) {
    fieldNameToNodeId.set(m.formFieldName, m.nodeId);
  }

  for (const rule of rules) {
    if (!rule.fields || rule.fields.length < 2 && rule.rule !== 'expression') continue;

    let failed = false;
    const vals = rule.fields.map((f) => resolveCrossFieldValue(formValues, f));

    switch (rule.rule) {
      case 'equals':
        failed = !vals.every((v) => v === vals[0]);
        break;
      case 'notEquals':
        failed = vals.length >= 2 && vals[0] === vals[1];
        break;
      case 'greaterThan': {
        const a = Number(vals[0]);
        const b = Number(vals[1]);
        failed = !Number.isNaN(a) && !Number.isNaN(b) && !(a > b);
        break;
      }
      case 'lessThan': {
        const a = Number(vals[0]);
        const b = Number(vals[1]);
        failed = !Number.isNaN(a) && !Number.isNaN(b) && !(a < b);
        break;
      }
      case 'expression': {
        if (!rule.expression) break;
        try {
          if (!isSafeDesignerRuntimeExpression(rule.expression)) {
            failed = true;
            break;
          }
          const compiled = compileDesignerConditionExpression(rule.expression);
          const evaluator = new Function(
            'designerStore', 'dataContext', 'value',
            `return Boolean(${compiled});`,
          ) as (s: Record<string, unknown>, d: Record<string, unknown>, v: string) => boolean;
          failed = !evaluator(designerStore, formValues, vals[0] ?? '');
        } catch {
          /* skip broken expressions */
        }
        break;
      }
    }

    if (failed) {
      const targetNodeId = fieldNameToNodeId.get(rule.appliesTo) ?? rule.appliesTo;
      if (!errors[targetNodeId]) {
        errors[targetNodeId] = rule.errorMessageKey || 'Validation failed.';
      }
    }
  }

  return errors;
};
