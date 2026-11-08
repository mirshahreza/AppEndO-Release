export type PackageWorkflowRef = {
  scopeKey: string;
  key: string;
};

export function normalizePackageWorkflowScopeKey(scopeKey?: string | null): string {
  const trimmed = typeof scopeKey === 'string' ? scopeKey.trim() : '';
  return trimmed || 'global';
}

export function packageWorkflowIdentity(scopeKey: string | undefined, key: string): string {
  return `${normalizePackageWorkflowScopeKey(scopeKey)}/${key.trim()}`;
}

export function packageWorkflowEntryPath(scopeKey: string | undefined, key: string): string {
  return `workflows/${normalizePackageWorkflowScopeKey(scopeKey)}/${key.trim()}.json`;
}

export function packageWorkflowLifecycleLabel(status: string | undefined): string {
  if (status === 'ACTIVE') return 'Published';
  if (status === 'DRAFT') return 'Draft';
  return status?.trim() || 'Draft';
}
