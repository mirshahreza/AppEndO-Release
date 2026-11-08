export type SeededPoint = {
  x: number;
  y: number;
  size: number;
  phase: number;
  depth: number;
  rotation: number;
};

/** Mulberry32 with an integer-only seed path for stable server/client output. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createSeededPoints(seed: number, count: number): readonly SeededPoint[] {
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, () => ({
    x: Number((random() * 100).toFixed(3)),
    y: Number((random() * 100).toFixed(3)),
    size: Number((0.5 + random() * 1.5).toFixed(3)),
    phase: Number((random() * -12).toFixed(3)),
    depth: Number((0.2 + random() * 0.8).toFixed(3)),
    rotation: Math.floor(random() * 360),
  }));
}

export function seededPolygon(seed: number, vertices: number): string {
  const random = createSeededRandom(seed);
  return Array.from({ length: vertices }, (_, index) => {
    const angle = (Math.PI * 2 * index) / vertices;
    const radius = 34 + random() * 14;
    return `${(50 + Math.cos(angle) * radius).toFixed(2)},${(
      50 +
      Math.sin(angle) * radius
    ).toFixed(2)}`;
  }).join(' ');
}

