/** D.3 — contiguous changed line ranges in the after file (1-based, inclusive). */
export type DiffZone = {
  startLine: number;
  endLine: number;
};

export const computeLineDiffZones = (before: string, after: string): DiffZone[] => {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  const zones: DiffZone[] = [];
  let zoneStart: number | null = null;

  for (let index = 0; index < maxLines; index += 1) {
    const changed = beforeLines[index] !== afterLines[index];
    const lineNum = index + 1;
    if (changed) {
      if (zoneStart === null) zoneStart = lineNum;
    } else if (zoneStart !== null) {
      zones.push({ startLine: zoneStart, endLine: index });
      zoneStart = null;
    }
  }

  if (zoneStart !== null) {
    zones.push({ startLine: zoneStart, endLine: maxLines });
  }

  return zones;
};

export const formatDiffZoneLabel = (zone: DiffZone): string => (
  zone.startLine === zone.endLine
    ? `L${zone.startLine}`
    : `L${zone.startLine}–${zone.endLine}`
);

/** Restore one changed zone in `afterContent` using baseline lines from `beforeContent`. */
export const revertDiffZone = (
  beforeContent: string,
  afterContent: string,
  zone: DiffZone,
): string => {
  const beforeLines = beforeContent.split(/\r?\n/);
  const afterLines = [...afterContent.split(/\r?\n/)];

  for (let line = zone.startLine; line <= zone.endLine; line += 1) {
    const index = line - 1;
    if (index < 0) continue;
    if (index < beforeLines.length) {
      afterLines[index] = beforeLines[index]!;
    } else {
      afterLines[index] = '';
    }
  }

  while (afterLines.length > beforeLines.length && afterLines[afterLines.length - 1] === '') {
    afterLines.pop();
  }

  return afterLines.join('\n');
};
