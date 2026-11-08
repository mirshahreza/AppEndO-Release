import type { FeatureGraph } from './aiIndexCodegen';
import {
  OPERATOR_PAGE_EDIT_LOCK_EXCEPTION_PAGE_KEYS,
  OPERATOR_PAGE_EDIT_LOCK_META_PATH_PREFIXES,
  OPERATOR_PAGE_EDIT_LOCK_POLICY,
  type OperatorPageEditLockPolicy,
} from '../../config/operatorPageEditLocks';
import { findFeatureGraphNode, resolveFeatureSearchRoots, resolvePageKeyFromFilePath } from './featureGraphStore';

export type PageEditLockManifestEntry = {
  pageKey: string;
  label: string;
  routePattern: string | null;
  searchRoots: string[];
  source: 'feature-graph' | 'route-binding' | 'package-ui';
};

export type PageEditLockManifest = {
  version: string;
  generatedAt: string;
  policy: OperatorPageEditLockPolicy;
  pageCount: number;
  pages: PageEditLockManifestEntry[];
};

export type PageEditLockEvaluation = {
  locked: boolean;
  pageKey: string | null;
  reason: string;
};

const normalizeRepoPath = (filePath: string): string => filePath.replace(/\\/g, '/').replace(/^\.\//, '');

export function isOperatorPageEditLockMetaPath(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath);
  return OPERATOR_PAGE_EDIT_LOCK_META_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export function normalizePageKeyToken(value: string): string {
  return value.trim().toLowerCase();
}

/** Page keys the operator explicitly named in the current prompt (case-insensitive). */
export function extractExplicitPageKeysFromPrompt(
  prompt: string,
  manifest: PageEditLockManifest,
): string[] {
  const haystack = prompt.toLowerCase();
  if (!haystack.trim()) return [];

  const explicit = new Set<string>();

  for (const entry of manifest.pages) {
    const pageKey = normalizePageKeyToken(entry.pageKey);
    if (pageKey && haystack.includes(pageKey)) {
      explicit.add(entry.pageKey);
      continue;
    }
    if (entry.routePattern) {
      const route = entry.routePattern.toLowerCase();
      if (route.length > 2 && haystack.includes(route)) {
        explicit.add(entry.pageKey);
        continue;
      }
    }
    const label = entry.label.trim().toLowerCase();
    if (label.length >= 4 && haystack.includes(label)) {
      explicit.add(entry.pageKey);
    }
  }

  for (const exception of OPERATOR_PAGE_EDIT_LOCK_EXCEPTION_PAGE_KEYS) {
    const key = normalizePageKeyToken(exception);
    if (key && haystack.includes(key)) {
      explicit.add(exception);
    }
  }

  return [...explicit];
}

function isUnderSearchRoot(filePath: string, root: string): boolean {
  const normalized = normalizeRepoPath(filePath);
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/$/, '');
  if (!normalizedRoot) return false;
  return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`);
}

function resolvePageKeyFromManifest(filePath: string, manifest: PageEditLockManifest): string | undefined {
  let best: { pageKey: string; rootLength: number } | undefined;

  for (const entry of manifest.pages) {
    for (const root of entry.searchRoots) {
      if (!isUnderSearchRoot(filePath, root)) continue;
      const rootLength = root.replace(/\/$/, '').length;
      if (!best || rootLength > best.rootLength) {
        best = { pageKey: entry.pageKey, rootLength };
      }
    }
  }

  return best?.pageKey;
}

export function evaluatePageEditLockForFile(args: {
  filePath: string;
  promptText: string;
  manifest: PageEditLockManifest;
  graph?: FeatureGraph;
}): PageEditLockEvaluation {
  const { filePath, promptText, manifest, graph } = args;

  if (OPERATOR_PAGE_EDIT_LOCK_POLICY !== 'all-locked') {
    return { locked: false, pageKey: null, reason: 'policy-open' };
  }

  if (isOperatorPageEditLockMetaPath(filePath)) {
    return { locked: false, pageKey: null, reason: 'lock-meta-path' };
  }

  const explicit = new Set(extractExplicitPageKeysFromPrompt(promptText, manifest));
  for (const key of OPERATOR_PAGE_EDIT_LOCK_EXCEPTION_PAGE_KEYS) {
    explicit.add(key);
  }

  const pageKey =
    (graph ? resolvePageKeyFromFilePath(filePath, graph) : undefined)
    ?? resolvePageKeyFromManifest(filePath, manifest);

  if (!pageKey) {
    return { locked: false, pageKey: null, reason: 'not-page-scoped' };
  }

  if (explicit.has(pageKey)) {
    return { locked: false, pageKey, reason: 'explicit-in-prompt' };
  }

  return {
    locked: true,
    pageKey,
    reason: 'page-locked-until-explicit-prompt',
  };
}

export function summarizePageEditLockPolicy(manifest: PageEditLockManifest) {
  return {
    policy: OPERATOR_PAGE_EDIT_LOCK_POLICY,
    pageCount: manifest.pageCount,
    exceptionPageKeys: [...OPERATOR_PAGE_EDIT_LOCK_EXCEPTION_PAGE_KEYS],
    manifestPointer: 'docs/ai/page-edit-locks.json',
    configPointer: 'src/config/operatorPageEditLocks.ts',
    rulePointer: '.cursor/rules/operator-page-edit-lock.mdc',
  };
}

export function buildManifestEntryFromGraphNode(
  node: NonNullable<ReturnType<typeof findFeatureGraphNode>>,
  source: PageEditLockManifestEntry['source'] = 'feature-graph',
): PageEditLockManifestEntry {
  return {
    pageKey: node.pageKey,
    label: node.label,
    routePattern: node.routePattern,
    searchRoots: resolveFeatureSearchRoots(node),
    source,
  };
}
