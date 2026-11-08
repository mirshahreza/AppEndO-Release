export type WorkspaceMutationDiffSummary = {
  addedCount: number;
  previewPaths: string[];
  isolatedPrefix?: string;
};

const WORKSPACE_MUTATION_PREFIX = 'appendoo/ws/';

/** AE-10.3 — summarize isolated workspace mutation paths for architect UX. */
export const summarizeWorkspaceMutationDiff = (
  mutationPaths: string[],
  previewLimit = 3,
): WorkspaceMutationDiffSummary => {
  const normalized = mutationPaths
    .map((item) => item.replace(/\\/g, '/').trim())
    .filter(Boolean);

  const isolatedPrefix = normalized.find((item) => item.startsWith(WORKSPACE_MUTATION_PREFIX))
    ?.split('/')
    .slice(0, 3)
    .join('/');

  return {
    addedCount: normalized.length,
    previewPaths: normalized.slice(0, previewLimit),
    isolatedPrefix,
  };
};
