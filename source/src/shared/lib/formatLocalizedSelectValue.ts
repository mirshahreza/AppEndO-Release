import { isValidElement, type ReactNode } from 'react';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';

const reactNodeToPlainText = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((child) => reactNodeToPlainText(child)).join('');
  }
  if (isValidElement(node)) {
    return reactNodeToPlainText(node.props.children);
  }
  return '';
};

const UI_SELECT_LIST_PAIR_KEY = 'ui.controls.select.listPair';
const UI_SELECT_LIST_CONJUNCTION_KEY = 'ui.controls.select.listConjunction';
const UI_SELECT_MULTIPLE_COUNT_KEY = 'ui.controls.select.multipleCount';

const applyTemplate = (template: string, replacements: Record<string, string>): string => (
  Object.entries(replacements).reduce(
    (result, [token, value]) => result.replaceAll(`{${token}}`, value),
    template,
  )
);

/** Trigger text for HeroUI multi-select — localized conjunction and count label. */
export const formatLocalizedSelectValue = (
  labels: readonly string[],
  t: TranslationFn,
): string => {
  const trimmed = labels.map((label) => String(label ?? '').trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return '';
  }
  if (trimmed.length === 1) {
    return trimmed[0]!;
  }

  const countTemplate = t(UI_SELECT_MULTIPLE_COUNT_KEY);
  if (trimmed.length > 2) {
    return applyTemplate(countTemplate, { count: String(trimmed.length) });
  }

  const pairTemplate = t(UI_SELECT_LIST_PAIR_KEY);
  if (pairTemplate !== UI_SELECT_LIST_PAIR_KEY) {
    return applyTemplate(pairTemplate, {
      first: trimmed[0]!,
      second: trimmed[1]!,
    });
  }

  const conjunction = t(UI_SELECT_LIST_CONJUNCTION_KEY);
  return `${trimmed[0]} ${conjunction} ${trimmed[1]}`;
};

export const resolveNativeOptionLabel = (label: ReactNode, value: string): string => {
  if (typeof label === 'string' || typeof label === 'number') {
    return String(label);
  }
  const flattened = reactNodeToPlainText(label).trim();
  return flattened || value;
};
