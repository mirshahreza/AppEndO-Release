import type { DesignerState } from '../types';

/** Binding capabilities audited in Phase T1-18 (sdoc 13). */
export const BINDING_PARITY_CAPABILITIES = [
  'Region',
  'Grid',
  'GridDetail',
  'Chart',
  'Viz',
  'Store',
  'Content',
  'DynamicActions',
  'Mutation',
  'EntityPicker',
  'LOV',
] as const;

export type BindingParityCapability = (typeof BINDING_PARITY_CAPABILITIES)[number];

export type BindingParityFixture = {
  capability: BindingParityCapability;
  id: string;
  description: string;
  state: DesignerState;
  /** Primary node under test. */
  nodeId: string;
  /** Bound property whose resolved data is compared (when applicable). */
  targetProp?: string;
  /** Simulated API payload before response-mapping unwrap. */
  mockApiPayload: unknown;
  /** Palette items that exercise this capability (for findings cross-ref). */
  paletteItems: readonly string[];
};

export type BindingParityComparison = {
  capability: BindingParityCapability;
  fixtureId: string;
  engineData: unknown;
  codegenData: unknown;
  matches: boolean;
  engineLabel: string;
  codegenLabel: string;
  notes?: string;
};
