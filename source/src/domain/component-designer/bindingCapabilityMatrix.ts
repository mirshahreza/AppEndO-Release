/**
 * T1-19 — Binding capability matrix per Palette Item (sdoc 13 pillar 2).
 * Cross-references T1-18 parity fixtures with toolbox catalog ids.
 */
import { DESIGNER_PALETTE } from './catalog';
import { PALETTE_ITEMS_BY_BINDING_CAPABILITY } from './bindingParity/paletteItemsByCapability';
import type { BindingParityCapability } from './bindingParity/types';

export type BindingCapabilityParityStatus = 'parity-tested' | 'partial' | 'broken';

/** Aggregate binding maturity for a palette item. */
export type PaletteBindingStatus = 'none' | BindingCapabilityParityStatus;

/**
 * Per-capability parity outcome from Phase T1-18 (BINDING-PARITY-FINDINGS.md).
 * Do not change without updating the snapshot suite and findings doc.
 */
export const BINDING_CAPABILITY_PARITY_STATUS: Readonly<
  Record<BindingParityCapability, BindingCapabilityParityStatus>
> = {
  Region: 'parity-tested',
  Grid: 'parity-tested',
  GridDetail: 'parity-tested',
  Chart: 'parity-tested',
  Viz: 'parity-tested',
  Store: 'parity-tested',
  Content: 'parity-tested',
  DynamicActions: 'parity-tested',
  Mutation: 'parity-tested',
  EntityPicker: 'parity-tested',
  LOV: 'parity-tested',
};

export type BindingCapabilityMatrixRow = {
  paletteItemId: string;
  /** Binding capabilities this item can use (empty when none). */
  supportedCapabilities: BindingParityCapability[];
  bindingStatus: PaletteBindingStatus;
  /** True when every supported capability has a T1-18 fixture and parity-tested status. */
  parityTested: boolean;
  /** Capabilities with partial or broken parity (for report / tooltip detail). */
  incompleteCapabilities: BindingParityCapability[];
};

const STATUS_SEVERITY: Record<PaletteBindingStatus, number> = {
  none: 0,
  'parity-tested': 1,
  partial: 2,
  broken: 3,
};

const resolveCapabilitiesForPaletteItem = (
  paletteItemId: string,
): BindingParityCapability[] => {
  const capabilities: BindingParityCapability[] = [];
  for (const [capability, items] of Object.entries(PALETTE_ITEMS_BY_BINDING_CAPABILITY) as Array<
    [BindingParityCapability, readonly string[]]
  >) {
    if (items.includes(paletteItemId)) {
      capabilities.push(capability);
    }
  }
  return capabilities;
};

export const resolvePaletteBindingStatus = (
  supportedCapabilities: readonly BindingParityCapability[],
): {
  bindingStatus: PaletteBindingStatus;
  parityTested: boolean;
  incompleteCapabilities: BindingParityCapability[];
} => {
  if (supportedCapabilities.length === 0) {
    return {
      bindingStatus: 'none',
      parityTested: false,
      incompleteCapabilities: [],
    };
  }

  const incompleteCapabilities = supportedCapabilities.filter(
    (capability) => BINDING_CAPABILITY_PARITY_STATUS[capability] !== 'parity-tested',
  );

  let bindingStatus: PaletteBindingStatus = 'parity-tested';
  for (const capability of supportedCapabilities) {
    const status = BINDING_CAPABILITY_PARITY_STATUS[capability];
    if (STATUS_SEVERITY[status] > STATUS_SEVERITY[bindingStatus]) {
      bindingStatus = status;
    }
  }

  return {
    bindingStatus,
    parityTested: incompleteCapabilities.length === 0,
    incompleteCapabilities,
  };
};

export const buildBindingCapabilityMatrix = (): BindingCapabilityMatrixRow[] =>
  DESIGNER_PALETTE.map((item) => {
    const supportedCapabilities = resolveCapabilitiesForPaletteItem(item.id);
    const { bindingStatus, parityTested, incompleteCapabilities } = resolvePaletteBindingStatus(
      supportedCapabilities,
    );
    return {
      paletteItemId: item.id,
      supportedCapabilities,
      bindingStatus,
      parityTested,
      incompleteCapabilities,
    };
  });

export type BindingCapabilitySummary = {
  total: number;
  none: number;
  parityTested: number;
  partial: number;
  broken: number;
  withBindingSupport: number;
};

export const summarizeBindingCapabilityMatrix = (
  rows: BindingCapabilityMatrixRow[] = buildBindingCapabilityMatrix(),
): BindingCapabilitySummary => ({
  total: rows.length,
  none: rows.filter((row) => row.bindingStatus === 'none').length,
  parityTested: rows.filter((row) => row.bindingStatus === 'parity-tested').length,
  partial: rows.filter((row) => row.bindingStatus === 'partial').length,
  broken: rows.filter((row) => row.bindingStatus === 'broken').length,
  withBindingSupport: rows.filter((row) => row.supportedCapabilities.length > 0).length,
});

/** Cached lookup for Toolbox UI (T1-19). */
let bindingMatrixByIdCache: ReadonlyMap<string, BindingCapabilityMatrixRow> | null = null;

export const getBindingCapabilityRow = (
  paletteItemId: string,
): BindingCapabilityMatrixRow | undefined => {
  if (!bindingMatrixByIdCache) {
    bindingMatrixByIdCache = new Map(
      buildBindingCapabilityMatrix().map((row) => [row.paletteItemId, row]),
    );
  }
  return bindingMatrixByIdCache.get(paletteItemId);
};

const formatCapabilityList = (capabilities: readonly BindingParityCapability[]): string =>
  capabilities.join(', ');

/**
 * Human-readable binding limitation for Toolbox maturity badge (null when binding is OK or N/A).
 */
export const resolveBindingCapabilityWarning = (paletteItemId: string): string | null => {
  const row = getBindingCapabilityRow(paletteItemId);
  if (!row || row.bindingStatus === 'none' || row.bindingStatus === 'parity-tested') {
    return null;
  }

  if (row.bindingStatus === 'broken') {
    return `Binding parity broken (${formatCapabilityList(row.incompleteCapabilities)}). Export may not match preview.`;
  }

  return `Binding parity partial (${formatCapabilityList(row.incompleteCapabilities)}). Some paths are not fully E2E-tested.`;
};

export const isBindingStatusIncomplete = (bindingStatus: PaletteBindingStatus): boolean =>
  bindingStatus === 'partial' || bindingStatus === 'broken';
