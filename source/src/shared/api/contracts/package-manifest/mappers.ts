import type {
  DependencyGraph,
  PackageListApiItem,
  PackageRow,
} from './types';
import { compareSemver } from '../../../lib/semver';

function normalizeAuditValue(value?: string | null): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || null;
}

export function buildPackageRows(
  items: PackageListApiItem[],
  graph: DependencyGraph,
): PackageRow[] {
  return items
    .map<PackageRow>((item) => {
      const edges = (graph.edges || []).filter((edge) => edge.fromPackageId === item.packageId && !edge.satisfied);
      const graphIssues = (graph.issues || []).filter((issue) => issue.includes(item.packageId));
      const dependencyIssues = [
        ...edges.map((edge) => `Dependency ${edge.toPackageId} does not satisfy ${edge.versionRange}.`),
        ...graphIssues,
      ];

      return {
        ...item,
        createdAt: normalizeAuditValue(item.createdAt),
        createdBy: normalizeAuditValue(item.createdBy),
        dependencyHealthy: dependencyIssues.length === 0,
        dependencyIssues,
      };
    })
    .sort((left, right) => {
      const byName = left.displayName.localeCompare(right.displayName);
      if (byName !== 0) return byName;
      return compareSemver(right.version, left.version);
    });
}

export function packageRowKey(row: Pick<PackageRow, 'packageId' | 'version'>): string {
  return `${row.packageId}:${row.version}`;
}
