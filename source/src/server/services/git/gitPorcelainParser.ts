import { isDeniedPath } from '../../../core/ai/tools/pathAllowlist';
import type { GitChangeEntry, GitChangeSection, GitChangesPayload } from '../../../shared/api/contracts/git/types';

const STAGED_INDEX_STATUS = new Set(['M', 'A', 'D', 'R', 'C', 'U']);
const UNSTAGED_WORKTREE_STATUS = new Set(['M', 'D', 'U']);

const parseBranchHead = (line: string): string | null => {
  const match = line.match(/^# branch\.head (.+)$/);
  return match?.[1]?.trim() || null;
};

const parseBranchAheadBehind = (line: string): { ahead: number; behind: number } | null => {
  const match = line.match(/^# branch\.ab \+(\d+) -(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    ahead: Number.parseInt(match[1], 10) || 0,
    behind: Number.parseInt(match[2], 10) || 0,
  };
};

const buildEntry = (
  path: string,
  section: GitChangeSection,
  statusCode: string,
): GitChangeEntry => ({
  path,
  section,
  statusCode,
  denied: isDeniedPath(path),
});

const OBJECT_NAME_PATTERN = /^[0-9a-f]{40}$/i;

/** Porcelain v2 paths are tab-separated; some Git builds (notably on Windows) emit a space before the path. */
const splitPorcelainRecord = (
  line: string,
): { headerPart: string; path: string } | null => {
  const tabIndex = line.indexOf('\t');
  if (tabIndex >= 0) {
    const path = line.slice(tabIndex + 1).trim();
    if (!path) {
      return null;
    }
    return {
      headerPart: line.slice(0, tabIndex).trim(),
      path,
    };
  }

  const parts = line.trim().split(/\s+/);
  if (parts.length < 9) {
    return null;
  }

  const objectNameIndexes = parts
    .map((part, index) => (OBJECT_NAME_PATTERN.test(part) ? index : -1))
    .filter((index) => index >= 0);

  if (objectNameIndexes.length < 2) {
    return null;
  }

  const pathStartIndex = objectNameIndexes[objectNameIndexes.length - 1] + 1;
  const path = parts.slice(pathStartIndex).join(' ').trim();
  if (!path) {
    return null;
  }

  return {
    headerPart: parts.slice(0, pathStartIndex).join(' '),
    path,
  };
};

const parseStatusEntries = (
  headerPart: string,
  path: string,
  stagedCode = 'R',
  unstagedCode = 'R',
): GitChangeEntry[] => {
  const header = headerPart.trim().split(/\s+/);
  const xy = header[1] ?? '';
  if (xy.length !== 2) {
    return [];
  }

  const [indexStatus, worktreeStatus] = xy;
  const entries: GitChangeEntry[] = [];

  if (STAGED_INDEX_STATUS.has(indexStatus)) {
    entries.push(buildEntry(path, 'staged', indexStatus === 'R' ? stagedCode : indexStatus));
  }
  if (UNSTAGED_WORKTREE_STATUS.has(worktreeStatus)) {
    entries.push(buildEntry(path, 'unstaged', worktreeStatus === 'R' ? unstagedCode : worktreeStatus));
  }

  return entries;
};

const parseOrdinaryChangeLine = (line: string): GitChangeEntry[] => {
  const record = splitPorcelainRecord(line);
  if (!record) {
    return [];
  }

  return parseStatusEntries(record.headerPart, record.path);
};

const parseRenameChangeLine = (line: string): GitChangeEntry[] => {
  const record = splitPorcelainRecord(line);
  if (!record) {
    return [];
  }

  return parseStatusEntries(record.headerPart, record.path);
};

export const parseGitPorcelainV2 = (output: string): GitChangesPayload => {
  let branch: string | null = null;
  let ahead = 0;
  let behind = 0;
  const entries: GitChangeEntry[] = [];

  for (const rawLine of output.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line) {
      continue;
    }

    if (line.startsWith('# branch.head ')) {
      branch = parseBranchHead(line);
      continue;
    }

    if (line.startsWith('# branch.ab ')) {
      const ab = parseBranchAheadBehind(line);
      if (ab) {
        ahead = ab.ahead;
        behind = ab.behind;
      }
      continue;
    }

    if (line.startsWith('1 ')) {
      entries.push(...parseOrdinaryChangeLine(line));
      continue;
    }

    if (line.startsWith('2 ')) {
      entries.push(...parseRenameChangeLine(line));
      continue;
    }

    if (line.startsWith('? ')) {
      const path = line.slice(2).trim();
      if (path) {
        entries.push(buildEntry(path, 'untracked', 'U'));
      }
    }
  }

  return {
    branch,
    ahead,
    behind,
    isClean: entries.length === 0,
    entries,
  };
};
