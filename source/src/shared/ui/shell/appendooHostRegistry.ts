const REGISTRY_KEY = Symbol.for('appendo.aiPanelHost');

type AppEndooHostRegistry = {
  ownerId: string | null;
  ownerPriority: number;
};

const getRegistry = (): AppEndooHostRegistry => {
  const scope = globalThis as typeof globalThis & { [REGISTRY_KEY]?: AppEndooHostRegistry };
  if (!scope[REGISTRY_KEY]) {
    scope[REGISTRY_KEY] = { ownerId: null, ownerPriority: Number.NEGATIVE_INFINITY };
  }
  return scope[REGISTRY_KEY]!;
};

export const claimAppEndooHost = (ownerId: string, priority: number): boolean => {
  const registry = getRegistry();
  if (registry.ownerId === null || registry.ownerId === ownerId) {
    registry.ownerId = ownerId;
    registry.ownerPriority = priority;
    return true;
  }
  if (priority > registry.ownerPriority) {
    registry.ownerId = ownerId;
    registry.ownerPriority = priority;
    return true;
  }
  return false;
};

export const releaseAppEndooHost = (ownerId: string): void => {
  const registry = getRegistry();
  if (registry.ownerId === ownerId) {
    registry.ownerId = null;
    registry.ownerPriority = Number.NEGATIVE_INFINITY;
  }
};

export const resetAppEndooHostRegistryForTests = (): void => {
  const registry = getRegistry();
  registry.ownerId = null;
  registry.ownerPriority = Number.NEGATIVE_INFINITY;
};
