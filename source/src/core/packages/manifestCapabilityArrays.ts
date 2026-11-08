/** Safe iteration over manifest capability lists (vertical-app manifests omit many keys). */
export function readManifestCapabilityArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
