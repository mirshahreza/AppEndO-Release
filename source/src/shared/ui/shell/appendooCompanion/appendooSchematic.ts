type Point = { x: number; y: number };

const closedCatmullRomPath = (points: readonly Point[]): string => {
  const count = points.length;
  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const previous = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    const after = points[(index + 2) % count];
    if (index === 0) {
      parts.push(`M ${current.x.toFixed(2)} ${current.y.toFixed(2)}`);
    }
    parts.push(
      `C ${(current.x + (next.x - previous.x) / 6).toFixed(2)} ${(current.y + (next.y - previous.y) / 6).toFixed(2)} ${(next.x - (after.x - current.x) / 6).toFixed(2)} ${(next.y - (after.y - current.y) / 6).toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`,
    );
  }
  parts.push('Z');
  return parts.join(' ');
};

export const APPENDOO_SCHEMATIC_INK = '#1a1612';
export const APPENDOO_SCHEMATIC_LINE = '#b7b0a8';
export const APPENDOO_SCHEMATIC_SHADOW = 'rgb(48 42 38)';

const len = (point: Point): number => Math.hypot(point.x, point.y);
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const norm = (point: Point): Point => {
  const size = len(point);
  return size < 1e-6 ? { x: 1, y: 0 } : { x: point.x / size, y: point.y / size };
};

const boundsY = (points: readonly Point[]): { minY: number; maxY: number } => {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minY, maxY };
};

/** Outward normal for a clockwise silhouette (top, then right, then down). */
const outwardNormal = (tangent: Point): Point => ({ x: tangent.y, y: -tangent.x });

export const appendooSchematicHalfWidthAt = (
  point: Point,
  tangent: Point,
  index: number,
  count: number,
  minY: number,
  maxY: number,
): number => {
  const depth = (point.y - minY) / (maxY - minY || 1);
  const outward = outwardNormal(tangent);
  const shade = Math.max(0, outward.y * 0.78 + outward.x * 0.22);
  const pulse = 0.5 + 0.5 * Math.sin((index / Math.max(1, count)) * Math.PI * 6 + 0.85);
  const heat = Math.max(0, (depth - 0.42) / 0.58) ** 1.15;
  const mix = 0.16 * pulse + 0.36 * depth + 0.24 * shade + 0.24 * heat;
  return 0.42 + mix * 2.55;
};

const offsetSilhouette = (points: readonly Point[], sign: 1 | -1): Point[] => {
  const count = points.length;
  if (count < 3) return [...points];
  const { minY, maxY } = boundsY(points);
  return points.map((point, index) => {
    const prev = points[(index - 1 + count) % count];
    const next = points[(index + 1) % count];
    const tangent = norm(sub(next, prev));
    const outward = outwardNormal(tangent);
    const width = appendooSchematicHalfWidthAt(point, tangent, index, count, minY, maxY);
    return {
      x: point.x + outward.x * width * sign,
      y: point.y + outward.y * width * sign,
    };
  });
};

export const pathFromAppendooSchematicStroke = (points: readonly Point[]): string => {
  if (points.length < 3) return '';
  const outer = closedCatmullRomPath(offsetSilhouette(points, 1));
  const inner = closedCatmullRomPath(offsetSilhouette(points, -1));
  return `${outer} ${inner}`;
};
