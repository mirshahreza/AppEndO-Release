import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { generateDesignerTsx } from '../codegen';
import {
  BINDING_PARITY_CAPABILITIES,
  type BindingParityComparison,
} from '../bindingParity/types';
import { buildAllBindingParityFixtures } from '../bindingParity/fixtures';
import {
  compareAllBindingParities,
  compareBindingParity,
  summarizeBindingParityMismatches,
} from '../bindingParity/harness';

const expectValidTsx = (label: string, tsx: string): void => {
  assertValidTsxSyntax(label, tsx);
  expect(tsx).toContain('export const GeneratedComponent');
};

const normalizeDynamicPaths = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value
      .replace(/dynamic\.heroui-button-solid-\d+-[a-z0-9]+/g, 'dynamic.<button-node>')
      .replace(/ui\.visibility\.layout-stack-compact-\d+-[a-z0-9]+/g, 'ui.visibility.<panel-node>');
  }
  if (Array.isArray(value)) {
    return value.map(normalizeDynamicPaths);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, normalizeDynamicPaths(entry)]),
    );
  }
  return value;
};

const toSnapshotShape = (result: BindingParityComparison) => normalizeDynamicPaths({
  capability: result.capability,
  fixtureId: result.fixtureId,
  matches: result.matches,
  engineLabel: result.engineLabel,
  codegenLabel: result.codegenLabel,
  engineData: result.engineData,
  codegenData: result.codegenData,
  notes: result.notes,
});

describe('binding parity snapshot suite (Phase T1-18)', () => {
  const fixtures = buildAllBindingParityFixtures();

  it('provides exactly one fixture per binding capability', () => {
    expect(fixtures).toHaveLength(BINDING_PARITY_CAPABILITIES.length);
    for (const capability of BINDING_PARITY_CAPABILITIES) {
      expect(fixtures.some((fixture) => fixture.capability === capability)).toBe(true);
    }
  });

  it.each(fixtures.map((fixture) => [fixture.capability, fixture.id, fixture]))(
    'compiles export TSX for %s fixture (%s)',
    async (_capability, _id, fixture) => {
      const tsx = generateDesignerTsx(fixture.state.document, fixture.state.bindingDefinitions);
      await expectValidTsx(fixture.id, tsx);
    },
  );

  it.each(fixtures.map((fixture) => [fixture.capability, fixture.id, fixture]))(
    'runs engine vs codegen parity harness for %s (%s)',
    (_capability, _id, fixture) => {
      const result = compareBindingParity(fixture);
      expect(result.engineData).toBeDefined();
      expect(result.codegenData).toBeDefined();
      expect(result.engineLabel.length).toBeGreaterThan(0);
      expect(result.codegenLabel.length).toBeGreaterThan(0);
      expect(toSnapshotShape(result)).toMatchSnapshot();
    },
  );

  it('snapshots aggregate parity summary for BINDING-PARITY-FINDINGS', () => {
    const results = compareAllBindingParities(fixtures);
    const mismatches = summarizeBindingParityMismatches(results);
    expect({
      total: results.length,
      matched: results.filter((entry) => entry.matches).length,
      mismatched: mismatches.length,
      mismatches: mismatches.map(toSnapshotShape),
    }).toMatchSnapshot();
  });
});
