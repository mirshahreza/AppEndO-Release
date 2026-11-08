/**
 * Builds catalog-driven option steps for exhaustive base-components QA.
 * Run: npx tsx workspace/functional-pass/export-exhaustive-matrix.ts
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGET_BASE_COMPONENT_SECTION_IDS } from '../../src/features/base-components/catalog/sections/catalogSections.options';
import { getBaseComponentOptions } from '../../src/features/base-components/catalog/baseComponentCatalog';
import { resolveBaseComponentConfig } from '../../src/features/base-components/catalog/resolveBaseComponentConfig';
import type { BaseComponentOptionMeta } from '../../src/features/base-components/catalog/baseComponentOptionTypes';

const __dirname = dirname(fileURLToPath(import.meta.url));

const AUTOMATABLE = new Set([
  'checkbox',
  'segmented',
  'select',
  'combobox',
  'multi-select',
  'text',
  'number-step',
  'range',
  'state-matrix',
  'responsive-matrix',
]);

const sameValue = (a: unknown, b: unknown) =>
  Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);

function valuesForOption(option: BaseComponentOptionMeta): unknown[] {
  if (option.control === 'checkbox') return [true, false];
  if (option.values?.length) return [...option.values];
  if (option.control === 'text') {
    const base = String(option.defaultValue ?? '');
    return base.length > 0 ? [base, `${base.slice(0, 40)}-qa`] : ['sample', 'sample-qa'];
  }
  if (option.control === 'number-step' || option.control === 'range') {
    const n = typeof option.defaultValue === 'number' ? option.defaultValue : 0;
    return option.values?.length ? [...option.values] : [n, n + 1];
  }
  return [];
}

function preconditionsFor(
  options: readonly BaseComponentOptionMeta[],
  option: BaseComponentOptionMeta,
): Record<string, unknown> {
  const pre: Record<string, unknown> = {};
  const cond = option.visibleWhen;
  if (!cond) return pre;
  const apply = (c: typeof cond): void => {
    if ('equals' in c) {
      pre[c.optionId] = c.equals;
      return;
    }
    if ('in' in c && c.in.length > 0) {
      pre[c.optionId] = c.in[0];
      return;
    }
    if ('all' in c) c.all.forEach(apply);
    if ('any' in c && c.any.length > 0) apply(c.any[0]!);
  };
  apply(cond);
  return pre;
}

export type ExhaustiveCatalogStep = {
  sectionId: string;
  optionId: string;
  label: string;
  control: string;
  value: unknown;
  preValues: Record<string, unknown>;
  skipReason?: string;
};

const steps: ExhaustiveCatalogStep[] = [];

for (const sectionId of TARGET_BASE_COMPONENT_SECTION_IDS) {
  const options = getBaseComponentOptions(sectionId);
  for (const option of options) {
    if (option.disposition === 'catalog-only') continue;
    if (!AUTOMATABLE.has(option.control)) continue;

    for (const value of valuesForOption(option)) {
      const preValues = preconditionsFor(options, option);
      const resolution = resolveBaseComponentConfig(options, preValues);
      const state = resolution.optionState[option.id];
      if (!state?.visible || !state.enabled) {
        steps.push({
          sectionId,
          optionId: option.id,
          label: option.label,
          control: option.control,
          value,
          preValues,
          skipReason: 'not visible/enabled after preconditions',
        });
        continue;
      }
      steps.push({
        sectionId,
        optionId: option.id,
        label: option.label,
        control: option.control,
        value,
        preValues,
      });
    }
  }
}

const out = join(__dirname, 'exhaustive-catalog-matrix.json');
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), stepCount: steps.length, steps }, null, 2));
console.log(`Wrote ${out} (${steps.length} steps, ${steps.filter((s) => !s.skipReason).length} runnable)`);
