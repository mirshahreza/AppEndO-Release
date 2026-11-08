/**
 * p-99/WFT-2 — generic "live dropdown" primitive for Action config/input fields, generalizing the
 * two hand-rolled special cases the Designer already had (`format: 'data-source-id'`/
 * `'edge-api-key'`, each with its own bespoke prop + fetch call in `ActionFieldsMappingEditor.tsx`)
 * into something any Action author can opt into by declaring, on a schema property:
 * `{ format: 'dynamic-options', dynamicOptionsSource: '<key>' }`. Deliberately NOT dependent on
 * sibling field values (n8n's `loadOptions`/Activepieces' `refreshers` equivalent) — every
 * registered resolver here is a flat, unfiltered "list everything" call; a resolver that needs to
 * react to another field's value is a real, separate, larger feature (documented boundary, not a
 * silent gap).
 */

export type DynamicOption = { value: string; label: string };
export type DynamicOptionsResolver = () => Promise<DynamicOption[]>;

const resolvers = new Map<string, DynamicOptionsResolver>();

/** Idempotent — safe to call again with the same source key (last registration wins), matching `registerCoreActionPack`'s "safe to call multiple times" boot convention. */
export function registerDynamicOptionsResolver(source: string, resolver: DynamicOptionsResolver): void {
  resolvers.set(source, resolver);
}

export async function resolveDynamicOptions(source: string): Promise<DynamicOption[] | undefined> {
  const resolver = resolvers.get(source);
  if (!resolver) return undefined;
  return resolver();
}

export function isDynamicOptionsSourceRegistered(source: string): boolean {
  return resolvers.has(source);
}

/** Test-only reset. */
export function __resetDynamicOptionsRegistryForTests(): void {
  resolvers.clear();
}
