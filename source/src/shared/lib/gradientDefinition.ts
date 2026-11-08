import { clamp, colorToHex, colorToRgba, interpolateColor, parseCssColor, rgbaToCss, rgbToHex } from './colorMath';

export type GradientType =
  | 'linear'
  | 'radial'
  | 'conic'
  | 'repeating-linear'
  | 'repeating-radial'
  | 'repeating-conic';

export type RadialShape = 'circle' | 'ellipse';
export type RadialSize = 'closest-side' | 'closest-corner' | 'farthest-side' | 'farthest-corner';

export type GradientStop = {
  id: string;
  color: string;
  position: number;
};

export type GradientDefinition = {
  type: GradientType;
  angle: number;
  centerX: number;
  centerY: number;
  radialShape: RadialShape;
  radialSize: RadialSize;
  repeatLength: number;
  stops: GradientStop[];
};

const GRADIENT_TYPE_LABELS: Record<GradientType, string> = {
  linear: 'Linear',
  radial: 'Radial',
  conic: 'Conic',
  'repeating-linear': 'Repeating linear',
  'repeating-radial': 'Repeating radial',
  'repeating-conic': 'Repeating conic',
};

export const GRADIENT_TYPES = Object.keys(GRADIENT_TYPE_LABELS) as GradientType[];

export const getGradientTypeLabel = (type: GradientType): string => GRADIENT_TYPE_LABELS[type];

export const isRepeatingGradient = (type: GradientType): boolean => type.startsWith('repeating-');

export const isLinearFamily = (type: GradientType): boolean => (
  type === 'linear' || type === 'repeating-linear'
);

export const isRadialFamily = (type: GradientType): boolean => (
  type === 'radial' || type === 'repeating-radial'
);

export const isConicFamily = (type: GradientType): boolean => (
  type === 'conic' || type === 'repeating-conic'
);

let stopIdCounter = 0;
export const createGradientStop = (color: string, position: number): GradientStop => ({
  id: `stop-${++stopIdCounter}`,
  color,
  position,
});

export const createDefaultGradient = (
  type: GradientType = 'linear',
): GradientDefinition => ({
  type,
  angle: type === 'conic' || type === 'repeating-conic' ? 0 : 135,
  centerX: 50,
  centerY: 50,
  radialShape: 'ellipse',
  radialSize: 'farthest-corner',
  repeatLength: 25,
  stops: [
    createGradientStop('#667EEA', 0),
    createGradientStop('#764BA2', 100),
  ],
});

const sortStops = (stops: GradientStop[]): GradientStop[] => (
  [...stops].sort((left, right) => left.position - right.position)
);

const formatStopColor = (color: string): string => {
  const rgba = parseCssColor(color) ?? colorToRgba(color);
  return rgba.a < 1 ? rgbaToCss(rgba) : rgbToHex(rgba.r, rgba.g, rgba.b);
};

const parseStopPart = (part: string, index: number, total: number): GradientStop => {
  const trimmed = part.trim();
  const percentMatch = trimmed.match(/\s+([\d.]+)%\s*$/);
  const degMatch = percentMatch ? null : trimmed.match(/\s+([\d.]+)deg\s*$/);

  let color = trimmed;
  let position = index === 0 ? 0 : index === total - 1 ? 100 : (index / (total - 1)) * 100;

  if (percentMatch?.index != null) {
    color = trimmed.slice(0, percentMatch.index).trim();
    position = Number(percentMatch[1]);
  } else if (degMatch?.index != null) {
    color = trimmed.slice(0, degMatch.index).trim();
    position = (Number(degMatch[1]) / 360) * 100;
  }

  return createGradientStop(formatStopColor(color), position);
};

const formatStopList = (stops: GradientStop[]): string => (
  sortStops(stops)
    .map((stop) => `${formatStopColor(stop.color)} ${stop.position}%`)
    .join(', ')
);

const resolveFunctionName = (type: GradientType): string => {
  switch (type) {
    case 'linear':
      return 'linear-gradient';
    case 'radial':
      return 'radial-gradient';
    case 'conic':
      return 'conic-gradient';
    case 'repeating-linear':
      return 'repeating-linear-gradient';
    case 'repeating-radial':
      return 'repeating-radial-gradient';
    default:
      return 'repeating-conic-gradient';
  }
};

export const buildGradientCss = (definition: GradientDefinition): string => {
  const fn = resolveFunctionName(definition.type);
  const stops = formatStopList(definition.stops);

  if (isLinearFamily(definition.type)) {
    if (isRepeatingGradient(definition.type)) {
      const repeatStops = sortStops(definition.stops)
        .map((stop) => {
          const scaled = (stop.position / 100) * definition.repeatLength;
          return `${formatStopColor(stop.color)} ${scaled}%`;
        })
        .join(', ');
      return `${fn}(${definition.angle}deg, ${repeatStops})`;
    }
    return `${fn}(${definition.angle}deg, ${stops})`;
  }

  if (isRadialFamily(definition.type)) {
    const position = `at ${definition.centerX}% ${definition.centerY}%`;
    const shape = `${definition.radialShape} ${definition.radialSize}`;
    if (isRepeatingGradient(definition.type)) {
      const repeatStops = sortStops(definition.stops)
        .map((stop) => {
          const scaled = (stop.position / 100) * definition.repeatLength;
          return `${formatStopColor(stop.color)} ${scaled}%`;
        })
        .join(', ');
      return `${fn}(${shape} ${position}, ${repeatStops})`;
    }
    return `${fn}(${shape} ${position}, ${stops})`;
  }

  const from = `from ${definition.angle}deg at ${definition.centerX}% ${definition.centerY}%`;
  if (isRepeatingGradient(definition.type)) {
    const repeatStops = sortStops(definition.stops)
      .map((stop) => {
        const scaled = (stop.position / 100) * 360 * (definition.repeatLength / 100);
        return `${formatStopColor(stop.color)} ${scaled}deg`;
      })
      .join(', ');
    return `${fn}(${from}, ${repeatStops})`;
  }
  const conicStops = sortStops(definition.stops)
    .map((stop) => `${formatStopColor(stop.color)} ${(stop.position / 100) * 360}deg`)
    .join(', ');
  return `${fn}(${from}, ${conicStops})`;
};

const parseStops = (raw: string): GradientStop[] => {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of raw) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    }
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts.map((part, index) => parseStopPart(part, index, parts.length));
};

export const parseGradientCss = (css: string): GradientDefinition | null => {
  const trimmed = css.trim();
  const match = trimmed.match(
    /^(repeating-)?(linear|radial|conic)-gradient\((.+)\)$/i,
  );
  if (!match) {
    return null;
  }

  const repeating = Boolean(match[1]);
  const family = match[2].toLowerCase() as 'linear' | 'radial' | 'conic';
  const body = match[3].trim();
  const type: GradientType = repeating ? `repeating-${family}` as GradientType : family;

  const definition = createDefaultGradient(type);

  if (family === 'linear') {
    const angleMatch = body.match(/^([\d.]+)deg\s*,\s*(.+)$/i);
    if (angleMatch) {
      definition.angle = Number(angleMatch[1]);
      definition.stops = parseStops(angleMatch[2]);
      return definition;
    }
    definition.stops = parseStops(body);
    return definition;
  }

  if (family === 'radial') {
    const radialMatch = body.match(
      /^(circle|ellipse)?\s*(closest-side|closest-corner|farthest-side|farthest-corner)?\s*(?:at\s+([\d.]+)%\s+([\d.]+)%)?\s*,\s*(.+)$/i,
    );
    if (radialMatch) {
      definition.radialShape = (radialMatch[1] as RadialShape | undefined) ?? definition.radialShape;
      definition.radialSize = (radialMatch[2] as RadialSize | undefined) ?? definition.radialSize;
      if (radialMatch[3] && radialMatch[4]) {
        definition.centerX = Number(radialMatch[3]);
        definition.centerY = Number(radialMatch[4]);
      }
      definition.stops = parseStops(radialMatch[5]);
      return definition;
    }
    definition.stops = parseStops(body);
    return definition;
  }

  const conicMatch = body.match(
    /^from\s+([\d.]+)deg\s+at\s+([\d.]+)%\s+([\d.]+)%\s*,\s*(.+)$/i,
  );
  if (conicMatch) {
    definition.angle = Number(conicMatch[1]);
    definition.centerX = Number(conicMatch[2]);
    definition.centerY = Number(conicMatch[3]);
    definition.stops = parseStops(conicMatch[4]);
    return definition;
  }
  definition.stops = parseStops(body);
  return definition;
};

export const reverseGradientStops = (stops: GradientStop[]): GradientStop[] => {
  const sorted = sortStops(stops);
  const reversedPositions = sorted.map((stop) => stop.position).reverse();
  return sorted.map((stop, index) => ({
    ...stop,
    position: reversedPositions[index],
  }));
};

export const resolveGradientInsertPosition = (stops: GradientStop[]): number => {
  const sorted = sortStops(stops);
  if (sorted.length < 2) {
    return 50;
  }

  let bestGap = -1;
  let insertAt = 50;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const gap = sorted[index + 1].position - sorted[index].position;
    if (gap > bestGap) {
      bestGap = gap;
      insertAt = Math.round(sorted[index].position + gap / 2);
    }
  }

  if (bestGap <= 0) {
    const occupied = new Set(sorted.map((stop) => stop.position));
    for (let candidate = 1; candidate < 100; candidate += 1) {
      if (!occupied.has(candidate)) {
        return candidate;
      }
    }
  }

  return clamp(insertAt, 1, 99);
};

export const addGradientStop = (
  definition: GradientDefinition,
  position?: number,
): GradientDefinition => {
  const sorted = sortStops(definition.stops);
  const rounded = Math.round(clamp(position ?? resolveGradientInsertPosition(sorted), 0, 100));

  let left = sorted[0];
  let right = sorted[sorted.length - 1];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    if (sorted[index].position <= rounded && sorted[index + 1].position >= rounded) {
      left = sorted[index];
      right = sorted[index + 1];
      break;
    }
  }

  let color = left.color;
  if (left.id !== right.id && left.position !== right.position) {
    const ratio = (rounded - left.position) / (right.position - left.position);
    color = interpolateColor(left.color, right.color, ratio);
  }

  return {
    ...definition,
    stops: sortStops([
      ...definition.stops,
      createGradientStop(color, rounded),
    ]),
  };
};

export const removeGradientStop = (
  definition: GradientDefinition,
  stopId: string,
): GradientDefinition => {
  if (definition.stops.length <= 2) {
    return definition;
  }
  return {
    ...definition,
    stops: definition.stops.filter((stop) => stop.id !== stopId),
  };
};

export const updateGradientStop = (
  definition: GradientDefinition,
  stopId: string,
  patch: Partial<Pick<GradientStop, 'color' | 'position'>>,
): GradientDefinition => ({
  ...definition,
  stops: definition.stops.map((stop) => (
    stop.id === stopId ? { ...stop, ...patch } : stop
  )),
});

export const cloneGradientDefinition = (definition: GradientDefinition): GradientDefinition => ({
  ...definition,
  stops: definition.stops.map((stop) => createGradientStop(stop.color, stop.position)),
});

export const applyGradientCssToDefinition = (css: string): GradientDefinition | null => {
  const parsed = parseGradientCss(css);
  if (!parsed) {
    return null;
  }
  return cloneGradientDefinition(parsed);
};

const GRADIENT_FUNCTION_START = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/i;

export const isCssGradientValue = (value: string): boolean => (
  GRADIENT_FUNCTION_START.test(value.trim())
);

/** Pull the first gradient function from a CSS background value (single or layered). */
export const extractFirstGradientCss = (css: string): string | null => {
  const trimmed = css.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(GRADIENT_FUNCTION_START);
  if (!match || match.index === undefined) {
    return parseGradientCss(trimmed) ? trimmed : null;
  }

  let depth = 0;
  let started = false;
  for (let index = match.index; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === '(') {
      depth += 1;
      started = true;
    } else if (char === ')') {
      depth -= 1;
      if (started && depth === 0) {
        const candidate = trimmed.slice(match.index, index + 1);
        return parseGradientCss(candidate) ? candidate : null;
      }
    }
  }

  return parseGradientCss(trimmed) ? trimmed : null;
};

export const resolveGradientDefinitionFromCss = (css: string): GradientDefinition => {
  const primary = extractFirstGradientCss(css);
  if (primary) {
    const parsed = applyGradientCssToDefinition(primary);
    if (parsed) {
      return parsed;
    }
  }
  return createDefaultGradient('linear');
};
