export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const normalize = (value: unknown, path: string): CanonicalJsonValue => {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Canonical JSON rejects non-finite number at ${path}.`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => normalize(item, `${path}[${index}]`));
  if (isPlainObject(value)) {
    const output: Record<string, CanonicalJsonValue> = {};
    for (const key of Object.keys(value).sort((left, right) => left < right ? -1 : left > right ? 1 : 0)) {
      output[key] = normalize(value[key], `${path}.${key}`);
    }
    return output;
  }
  throw new TypeError(`Canonical JSON rejects ${typeof value} at ${path}.`);
};

export function toCanonicalJsonText(value: unknown): string {
  return JSON.stringify(normalize(value, '$'));
}
