import type { SideBySideDiffRow } from '../../packages/utils/sideBySideLineDiff';

const DIFF_META_PREFIXES = [
  'diff --git ',
  'index ',
  '--- ',
  '+++ ',
  'new file mode ',
  'deleted file mode ',
  'similarity index ',
  'rename from ',
  'rename to ',
  'old mode ',
  'new mode ',
] as const;

const isDiffMetaLine = (line: string): boolean => (
  DIFF_META_PREFIXES.some((prefix) => line.startsWith(prefix))
  || line.startsWith('\\ No newline at end of file')
);

export const parseUnifiedDiffToSideBySideRows = (diff: string): SideBySideDiffRow[] => {
  const trimmed = diff.trim();
  if (!trimmed) {
    return [];
  }

  const rows: SideBySideDiffRow[] = [];

  for (const rawLine of trimmed.replace(/\r\n/g, '\n').split('\n')) {
    if (isDiffMetaLine(rawLine)) {
      continue;
    }

    if (rawLine.startsWith('@@')) {
      rows.push({
        left: rawLine,
        right: rawLine,
        leftKind: 'equal',
        rightKind: 'equal',
      });
      continue;
    }

    const marker = rawLine[0];
    const content = rawLine.slice(1);

    if (marker === ' ') {
      rows.push({
        left: content,
        right: content,
        leftKind: 'equal',
        rightKind: 'equal',
      });
      continue;
    }

    if (marker === '-') {
      rows.push({
        left: content,
        right: '',
        leftKind: 'removed',
        rightKind: 'padding',
      });
      continue;
    }

    if (marker === '+') {
      rows.push({
        left: '',
        right: content,
        leftKind: 'padding',
        rightKind: 'added',
      });
    }
  }

  return rows;
};

export const hasUnifiedDiffChanges = (diff: string): boolean => {
  const rows = parseUnifiedDiffToSideBySideRows(diff);
  return rows.some((row) => row.leftKind === 'removed' || row.rightKind === 'added' || row.leftKind === 'changed');
};
