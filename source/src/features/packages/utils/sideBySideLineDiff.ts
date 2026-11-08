export type SideBySideDiffLineKind = 'equal' | 'removed' | 'added' | 'changed' | 'padding';

export type SideBySideDiffRow = {
  left: string;
  right: string;
  leftKind: SideBySideDiffLineKind;
  rightKind: SideBySideDiffLineKind;
};

function splitLines(text: string): string[] {
  if (!text) return [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '' && normalized.endsWith('\n')) {
    lines.pop();
  }
  return lines;
}

type LcsOp =
  | { type: 'equal'; value: string }
  | { type: 'delete'; value: string }
  | { type: 'insert'; value: string };

function buildLcsOps(left: string[], right: string[]): LcsOp[] {
  const m = left.length;
  const n = right.length;
  const dp = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (left[i] === right[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const ops: LcsOp[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (left[i] === right[j]) {
      ops.push({ type: 'equal', value: left[i] });
      i += 1;
      j += 1;
      continue;
    }
    if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'delete', value: left[i] });
      i += 1;
    } else {
      ops.push({ type: 'insert', value: right[j] });
      j += 1;
    }
  }
  while (i < m) {
    ops.push({ type: 'delete', value: left[i] });
    i += 1;
  }
  while (j < n) {
    ops.push({ type: 'insert', value: right[j] });
    j += 1;
  }

  return ops;
}

function pairDeleteInsertOps(ops: LcsOp[]): LcsOp[] {
  const paired: LcsOp[] = [];
  let index = 0;
  while (index < ops.length) {
    const current = ops[index];
    const next = ops[index + 1];
    if (current.type === 'delete' && next?.type === 'insert') {
      paired.push({ type: 'delete', value: current.value });
      paired.push({ type: 'insert', value: next.value });
      index += 2;
      continue;
    }
    paired.push(current);
    index += 1;
  }
  return paired;
}

export function buildSideBySideLineDiff(baseline: string, current: string): SideBySideDiffRow[] {
  const leftLines = splitLines(baseline);
  const rightLines = splitLines(current);
  const ops = pairDeleteInsertOps(buildLcsOps(leftLines, rightLines));
  const rows: SideBySideDiffRow[] = [];

  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    const next = ops[index + 1];

    if (op.type === 'equal') {
      rows.push({
        left: op.value,
        right: op.value,
        leftKind: 'equal',
        rightKind: 'equal',
      });
      continue;
    }

    if (op.type === 'delete' && next?.type === 'insert') {
      rows.push({
        left: op.value,
        right: next.value,
        leftKind: 'changed',
        rightKind: 'changed',
      });
      index += 1;
      continue;
    }

    if (op.type === 'delete') {
      rows.push({
        left: op.value,
        right: '',
        leftKind: 'removed',
        rightKind: 'padding',
      });
      continue;
    }

    rows.push({
      left: '',
      right: op.value,
      leftKind: 'padding',
      rightKind: 'added',
    });
  }

  if (rows.length === 0) {
    return [{
      left: '',
      right: '',
      leftKind: 'equal',
      rightKind: 'equal',
    }];
  }

  return rows;
}

export const SIDE_BY_SIDE_LEFT_LINE_CLASS: Record<SideBySideDiffLineKind, string> = {
  equal: 'bg-white text-slate-800',
  removed: 'bg-rose-100 text-rose-950 border-l-[3px] border-l-rose-500',
  added: 'bg-white text-slate-800',
  changed: 'bg-rose-100 text-rose-950 border-l-[3px] border-l-rose-500',
  padding: 'bg-slate-50 text-slate-300',
};

export const SIDE_BY_SIDE_RIGHT_LINE_CLASS: Record<SideBySideDiffLineKind, string> = {
  equal: 'bg-white text-slate-800',
  removed: 'bg-white text-slate-800',
  added: 'bg-emerald-100 text-emerald-950 border-l-[3px] border-l-emerald-500',
  changed: 'bg-emerald-100 text-emerald-950 border-l-[3px] border-l-emerald-500',
  padding: 'bg-slate-50 text-slate-300',
};
