import type { PackageManifest } from './PackageManifestValidator.js';

export interface InstalledPackageDependencyInput {
  packageId: string;
  version: string;
  manifest: PackageManifest;
}

export interface DependencyGraphNode {
  packageId: string;
  installedVersion: string;
}

export interface DependencyGraphEdge {
  fromPackageId: string;
  toPackageId: string;
  versionRange: string;
  satisfied: boolean;
}

export interface DependencyGraphReverseEdge {
  packageId: string;
  requiredBy: string[];
}

export interface DependencyGraph {
  schema: 'package-dependency-graph';
  schemaVersion: '1.0.0';
  updatedAt: string;
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
  reverseEdges: DependencyGraphReverseEdge[];
  hasCycle: boolean;
  issues: string[];
}

export interface InstallDependencyResolution {
  missing: string[];
  conflicts: string[];
  cycles: string[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseSemver(value: string): [number, number, number] | null {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a: string, b: string): number {
  const av = parseSemver(a);
  const bv = parseSemver(b);
  if (!av || !bv) return 0;
  if (av[0] !== bv[0]) return av[0] - bv[0];
  if (av[1] !== bv[1]) return av[1] - bv[1];
  return av[2] - bv[2];
}

export function satisfiesVersionRange(version: string, range: string): boolean {
  const trimmed = String(range || '').trim();
  if (!trimmed || trimmed === '*') return true;
  if (/^\d+\.\d+\.\d+$/.test(trimmed)) return version === trimmed;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  for (const token of tokens) {
    const m = token.match(/^(<=|>=|<|>|=)?(\d+\.\d+\.\d+)$/);
    if (!m) return false;
    const op = m[1] || '=';
    const bound = m[2];
    const cmp = compareSemver(version, bound);
    if (op === '=' && cmp !== 0) return false;
    if (op === '<' && !(cmp < 0)) return false;
    if (op === '>' && !(cmp > 0)) return false;
    if (op === '<=' && !(cmp <= 0)) return false;
    if (op === '>=' && !(cmp >= 0)) return false;
  }
  return true;
}

function detectCycles(adjacency: Map<string, string[]>): string[] {
  const cycles: string[] = [];
  const permanent = new Set<string>();
  const stackSet = new Set<string>();
  const stack: string[] = [];

  const visit = (node: string): void => {
    if (permanent.has(node)) return;
    if (stackSet.has(node)) {
      const start = stack.indexOf(node);
      const cycle = start >= 0 ? [...stack.slice(start), node] : [node, node];
      cycles.push(cycle.join(' -> '));
      return;
    }

    stackSet.add(node);
    stack.push(node);

    for (const next of adjacency.get(node) ?? []) {
      if (!adjacency.has(next)) continue;
      visit(next);
    }

    stack.pop();
    stackSet.delete(node);
    permanent.add(node);
  };

  for (const node of adjacency.keys()) {
    visit(node);
  }

  return Array.from(new Set(cycles));
}

export function resolveInstallDependencies(
  candidatePackageId: string,
  candidateManifest: PackageManifest,
  installedVersions: Map<string, string>,
  installedPackageManifests: InstalledPackageDependencyInput[],
): InstallDependencyResolution {
  const missing: string[] = [];
  const conflicts: string[] = [];

  for (const dep of candidateManifest.dependencies ?? []) {
    const installedVersion = installedVersions.get(dep.packageId);
    if (!installedVersion) {
      missing.push(`Missing dependency: ${dep.packageId} (${dep.versionRange}).`);
      continue;
    }

    if (!satisfiesVersionRange(installedVersion, dep.versionRange)) {
      conflicts.push(
        `Dependency version conflict: ${dep.packageId} installed ${installedVersion} does not satisfy ${dep.versionRange}.`,
      );
    }
  }

  const adjacency = new Map<string, string[]>();
  for (const pkg of installedPackageManifests) {
    adjacency.set(pkg.packageId, []);
  }
  adjacency.set(candidatePackageId, []);

  for (const pkg of installedPackageManifests) {
    const next = adjacency.get(pkg.packageId) ?? [];
    for (const dep of pkg.manifest.dependencies ?? []) {
      if (adjacency.has(dep.packageId)) next.push(dep.packageId);
    }
    adjacency.set(pkg.packageId, next);
  }

  const candidateNext = adjacency.get(candidatePackageId) ?? [];
  for (const dep of candidateManifest.dependencies ?? []) {
    if (adjacency.has(dep.packageId)) candidateNext.push(dep.packageId);
  }
  adjacency.set(candidatePackageId, candidateNext);

  const cycles = detectCycles(adjacency).filter((cycle) => cycle.includes(candidatePackageId));

  return {
    missing,
    conflicts,
    cycles,
  };
}

export function buildDependencyGraph(installedPackages: InstalledPackageDependencyInput[]): DependencyGraph {
  const nodes: DependencyGraphNode[] = [];
  const edges: DependencyGraphEdge[] = [];
  const reverseMap = new Map<string, Set<string>>();
  const issues: string[] = [];

  const installedVersionByPackage = new Map<string, string>();
  for (const pkg of installedPackages) {
    installedVersionByPackage.set(pkg.packageId, pkg.version);
    nodes.push({ packageId: pkg.packageId, installedVersion: pkg.version });
  }

  for (const pkg of installedPackages) {
    for (const dep of pkg.manifest.dependencies ?? []) {
      const targetVersion = installedVersionByPackage.get(dep.packageId);
      const satisfied = !!targetVersion && satisfiesVersionRange(targetVersion, dep.versionRange);
      edges.push({
        fromPackageId: pkg.packageId,
        toPackageId: dep.packageId,
        versionRange: dep.versionRange,
        satisfied,
      });

      if (!targetVersion) {
        issues.push(`Missing dependency for ${pkg.packageId}: ${dep.packageId} (${dep.versionRange}).`);
      }

      const rev = reverseMap.get(dep.packageId) ?? new Set<string>();
      rev.add(pkg.packageId);
      reverseMap.set(dep.packageId, rev);
    }
  }

  const reverseEdges: DependencyGraphReverseEdge[] = Array.from(reverseMap.entries())
    .map(([packageId, requiredBy]) => ({ packageId, requiredBy: Array.from(requiredBy).sort() }))
    .sort((a, b) => a.packageId.localeCompare(b.packageId));

  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.packageId, []);
  }
  for (const edge of edges) {
    if (!adjacency.has(edge.toPackageId)) continue;
    const next = adjacency.get(edge.fromPackageId) ?? [];
    next.push(edge.toPackageId);
    adjacency.set(edge.fromPackageId, next);
  }

  const cycles = detectCycles(adjacency);
  if (cycles.length > 0) {
    issues.push(...cycles.map((cycle) => `Dependency cycle detected: ${cycle}`));
  }

  return {
    schema: 'package-dependency-graph',
    schemaVersion: '1.0.0',
    updatedAt: nowIso(),
    nodes: nodes.sort((a, b) => a.packageId.localeCompare(b.packageId)),
    edges,
    reverseEdges,
    hasCycle: cycles.length > 0,
    issues,
  };
}
