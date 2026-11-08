import {
  DEFAULT_BUILTIN_CULTURE_PACKS,
  type PlatformCulturePack,
} from '../../shared/api/contracts/platform/cultures';
import type { CulturePackAdapter } from '../../shared/api/contracts/systemExtensions/types';
import { buildCustomCulturePackAdapter } from './buildCustomCulturePackAdapter';

export const MASTER_CULTURE_PACK_ID = 'us';

let adapterById = new Map<string, CulturePackAdapter>();

const defaultEnabledCulturePackIds = () => DEFAULT_BUILTIN_CULTURE_PACKS.map((pack) => pack.id);

let enabledCulturePackIds: string[] = defaultEnabledCulturePackIds();
let defaultCulturePackId: string = MASTER_CULTURE_PACK_ID;

export type CultureRegistryBootstrapConfig = {
  enabledCulturePackIds?: string[];
  defaultCultureId?: string;
  packs?: PlatformCulturePack[];
};

function rebuildAdapterRegistry(packs: PlatformCulturePack[] = DEFAULT_BUILTIN_CULTURE_PACKS): void {
  adapterById = new Map();

  for (const pack of packs) {
    const id = pack.id.trim();
    if (!id) {
      continue;
    }
    adapterById.set(id, buildCustomCulturePackAdapter(pack));
  }
}

function applyDefaultCultureId(requestedDefault?: string): void {
  if (requestedDefault?.trim() && adapterById.has(requestedDefault.trim())) {
    defaultCulturePackId = requestedDefault.trim();
    return;
  }

  if (enabledCulturePackIds.includes(MASTER_CULTURE_PACK_ID)) {
    defaultCulturePackId = MASTER_CULTURE_PACK_ID;
    return;
  }

  defaultCulturePackId = enabledCulturePackIds[0] ?? MASTER_CULTURE_PACK_ID;
}

export const bootstrapCultureRegistry = (
  config?: string[] | CultureRegistryBootstrapConfig,
): void => {
  if (Array.isArray(config)) {
    rebuildAdapterRegistry();
    enabledCulturePackIds = config.filter((id) => adapterById.has(id));
    applyDefaultCultureId();
    return;
  }

  const packs = config?.packs && config.packs.length > 0
    ? config.packs
    : DEFAULT_BUILTIN_CULTURE_PACKS;

  rebuildAdapterRegistry(packs);
  const requested = config?.enabledCulturePackIds ?? defaultEnabledCulturePackIds();
  enabledCulturePackIds = requested.filter((id) => adapterById.has(id));
  applyDefaultCultureId(config?.defaultCultureId);
};

export const getDefaultCulturePackId = (): string => defaultCulturePackId;

export const listBuiltinCulturePackAdapters = (): CulturePackAdapter[] => (
  DEFAULT_BUILTIN_CULTURE_PACKS.map((pack) => buildCustomCulturePackAdapter(pack))
);

export const resolveCulturePackAdapter = (cultureId: string): CulturePackAdapter | undefined => (
  adapterById.get(cultureId)
);

export const getEnabledCulturePackIds = (): string[] => [...enabledCulturePackIds];

export const getEnabledCulturePackAdapters = (): CulturePackAdapter[] => (
  enabledCulturePackIds
    .map((id) => adapterById.get(id))
    .filter((adapter): adapter is CulturePackAdapter => adapter != null)
);

export const getMasterCulturePackAdapter = (): CulturePackAdapter => (
  buildCustomCulturePackAdapter(
    DEFAULT_BUILTIN_CULTURE_PACKS.find((pack) => pack.id === MASTER_CULTURE_PACK_ID)
      ?? DEFAULT_BUILTIN_CULTURE_PACKS[0],
  )
);

/** Builtin packs before `/api/boot` — avoids iq/ir URLs resolving as US (LTR) on first paint. */
bootstrapCultureRegistry();
