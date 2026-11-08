export function parseSemver(value: string): [number, number, number] | null {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareSemver(a: string, b: string): number {
  const av = parseSemver(a);
  const bv = parseSemver(b);
  if (!av || !bv) return 0;
  if (av[0] !== bv[0]) return av[0] - bv[0];
  if (av[1] !== bv[1]) return av[1] - bv[1];
  return av[2] - bv[2];
}

export function maxSemver(versions: string[]): string | null {
  let best: string | null = null;
  for (const version of versions) {
    const trimmed = version.trim();
    if (!parseSemver(trimmed)) continue;
    if (!best || compareSemver(trimmed, best) > 0) {
      best = trimmed;
    }
  }
  return best;
}

export function isValidSemver(value: string): boolean {
  return parseSemver(value) !== null;
}
