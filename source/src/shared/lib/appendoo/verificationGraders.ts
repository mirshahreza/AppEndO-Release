import type {
  VerificationGraderDefinition,
  VerificationGraderResult,
} from '../../api/contracts/appendoo/verificationEngine.types';
import { validateBuilderMutationPaths } from './builderProtocolScaffold';
import { workspaceRoot } from './builderPrimitivePaths';

export const WORKSPACE_ARTIFACT_PREFIX = 'appendoo/ws/';

const normalizePath = (path: string): string => path.replace(/\\/g, '/').trim();

const baseResult = (
  grader: VerificationGraderDefinition,
  started: number,
): Pick<VerificationGraderResult, 'graderId' | 'version' | 'layer' | 'durationMs'> => ({
  graderId: grader.graderId,
  version: grader.version,
  layer: grader.layer,
  durationMs: Date.now() - started,
});

/** AE-9.2 — reject mutations targeting active application roots. */
export const gradeActiveRootMutation = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
): VerificationGraderResult => {
  const started = Date.now();
  const validation = validateBuilderMutationPaths(mutationPaths);

  return {
    ...baseResult(grader, started),
    grade: validation.ok ? 'PASS' : 'FAIL',
    evidence: validation.ok ? ['No active-root mutations detected.'] : [],
    diagnostics: validation.errors,
    sourceRefs: mutationPaths,
  };
};

/** AE-9.2 — mutation paths must stay under isolated workspace prefix. */
export const gradeWorkspaceDrift = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
  changeSetId?: string,
): VerificationGraderResult => {
  const started = Date.now();
  const expectedPrefix = changeSetId ? `${workspaceRoot(changeSetId)}/` : WORKSPACE_ARTIFACT_PREFIX;

  if (mutationPaths.length === 0) {
    return {
      ...baseResult(grader, started),
      grade: 'PASS',
      evidence: ['No workspace mutations recorded for drift check.'],
      diagnostics: [],
      sourceRefs: [],
    };
  }

  const driftPaths = mutationPaths.filter((path) => {
    const normalized = normalizePath(path);
    return !normalized.startsWith(expectedPrefix) && !normalized.startsWith(WORKSPACE_ARTIFACT_PREFIX);
  });

  return {
    ...baseResult(grader, started),
    grade: driftPaths.length === 0 ? 'PASS' : 'FAIL',
    evidence: driftPaths.length === 0 ? [`All mutations under ${WORKSPACE_ARTIFACT_PREFIX}`] : [],
    diagnostics: driftPaths.map((path) => `Workspace drift detected: ${path}`),
    sourceRefs: mutationPaths,
  };
};

/** AE-9.2 — path hygiene + standards deny patterns for builder outputs. */
export const gradeProjectStandards = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
): VerificationGraderResult => {
  const started = Date.now();
  const diagnostics: string[] = [];

  for (const path of mutationPaths) {
    const normalized = normalizePath(path);
    if (normalized.includes('..')) {
      diagnostics.push(`Path traversal rejected: ${path}`);
    }
    if (normalized.startsWith('/')) {
      diagnostics.push(`Absolute path rejected: ${path}`);
    }
    if (/^[a-zA-Z]:/.test(normalized)) {
      diagnostics.push(`Drive path rejected: ${path}`);
    }
  }

  const activeRoot = validateBuilderMutationPaths(mutationPaths);
  if (!activeRoot.ok) {
    diagnostics.push(...activeRoot.errors);
  }

  return {
    ...baseResult(grader, started),
    grade: diagnostics.length === 0 ? 'PASS' : 'FAIL',
    evidence: diagnostics.length === 0 ? ['Mutation paths satisfy project standards hygiene.'] : [],
    diagnostics,
    sourceRefs: mutationPaths,
  };
};

/** AE-9.2 — server function artifacts follow workspace runtime layout. */
export const gradeServerFunctionOpenApi = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
): VerificationGraderResult => {
  const started = Date.now();
  const serverFunctionPaths = mutationPaths.filter((path) => path.includes('/workspace/server-functions/'));

  if (serverFunctionPaths.length === 0) {
    return {
      ...baseResult(grader, started),
      grade: 'SKIPPED',
      evidence: [],
      diagnostics: ['No server-function mutations in this revision.'],
      sourceRefs: [],
    };
  }

  const invalid = serverFunctionPaths.filter((path) => (
    !path.endsWith('.ts') && !path.endsWith('.metadata.json')
  ));

  return {
    ...baseResult(grader, started),
    grade: invalid.length === 0 ? 'PASS' : 'FAIL',
    evidence: invalid.length === 0 ? ['Server function artifact extensions valid.'] : [],
    diagnostics: invalid.map((path) => `Invalid server function artifact: ${path}`),
    sourceRefs: serverFunctionPaths,
  };
};

const filterPaths = (mutationPaths: string[], segment: string): string[] => (
  mutationPaths.filter((path) => normalizePath(path).includes(segment))
);

/** AE-9.3 — workspace paths must not mimic active application roots. */
export const gradeFsdDependency = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
): VerificationGraderResult => {
  const started = Date.now();
  if (mutationPaths.length === 0) {
    return {
      ...baseResult(grader, started),
      grade: 'SKIPPED',
      evidence: [],
      diagnostics: ['No mutations for FSD dependency check.'],
      sourceRefs: [],
    };
  }

  const forbiddenSegments = ['/src/features/', '/src/app/', '/src/server/routes/'];
  const violations = mutationPaths.filter((path) => {
    const normalized = normalizePath(path);
    return forbiddenSegments.some((segment) => normalized.includes(segment))
      && !normalized.startsWith(WORKSPACE_ARTIFACT_PREFIX);
  });

  return {
    ...baseResult(grader, started),
    grade: violations.length === 0 ? 'PASS' : 'FAIL',
    evidence: violations.length === 0 ? ['No active-root FSD segments in workspace mutations.'] : [],
    diagnostics: violations.map((path) => `FSD dependency violation: ${path}`),
    sourceRefs: mutationPaths,
  };
};

/** AE-9.3 — mutations stay in workspace runtime layers. */
export const gradeCleanArchitecture = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
): VerificationGraderResult => {
  const started = Date.now();
  if (mutationPaths.length === 0) {
    return {
      ...baseResult(grader, started),
      grade: 'SKIPPED',
      evidence: [],
      diagnostics: ['No mutations for clean architecture check.'],
      sourceRefs: [],
    };
  }

  const invalid = mutationPaths.filter((path) => {
    const normalized = normalizePath(path);
    return normalized.includes('/src/core/') || normalized.includes('/src/layouts/');
  });

  return {
    ...baseResult(grader, started),
    grade: invalid.length === 0 ? 'PASS' : 'FAIL',
    evidence: invalid.length === 0 ? ['Workspace mutations avoid core/layout active roots.'] : [],
    diagnostics: invalid.map((path) => `Clean architecture violation: ${path}`),
    sourceRefs: mutationPaths,
  };
};

/** AE-9.3 — migration scripts must stay in workspace migrations and avoid control-plane paths. */
export const gradeEdgeDbBoundary = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
): VerificationGraderResult => {
  const started = Date.now();
  const migrationPaths = filterPaths(mutationPaths, '/runtime/migrations/');

  if (migrationPaths.length === 0) {
    return {
      ...baseResult(grader, started),
      grade: 'SKIPPED',
      evidence: [],
      diagnostics: ['No migration mutations in this revision.'],
      sourceRefs: [],
    };
  }

  const diagnostics: string[] = [];
  for (const path of migrationPaths) {
    const normalized = normalizePath(path);
    if (!normalized.endsWith('.sql')) {
      diagnostics.push(`Migration must use .sql extension: ${path}`);
    }
    if (/edge.?db|control-plane|base_tables/i.test(normalized)) {
      diagnostics.push(`Control-plane migration rejected: ${path}`);
    }
  }

  return {
    ...baseResult(grader, started),
    grade: diagnostics.length === 0 ? 'PASS' : 'FAIL',
    evidence: diagnostics.length === 0 ? ['Migration paths respect EdgeDb boundary.'] : [],
    diagnostics,
    sourceRefs: migrationPaths,
  };
};

/** AE-9.3 — entity/relation schema artifacts use JSON under data-sources. */
export const gradeSharedApiQueries = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
): VerificationGraderResult => {
  const started = Date.now();
  const schemaPaths = filterPaths(mutationPaths, '/runtime/data-sources/schema/');

  if (schemaPaths.length === 0) {
    return {
      ...baseResult(grader, started),
      grade: 'SKIPPED',
      evidence: [],
      diagnostics: ['No data-source schema mutations in this revision.'],
      sourceRefs: [],
    };
  }

  const invalid = schemaPaths.filter((path) => !normalizePath(path).endsWith('.json'));

  return {
    ...baseResult(grader, started),
    grade: invalid.length === 0 ? 'PASS' : 'FAIL',
    evidence: invalid.length === 0 ? ['Data-source schema artifacts use JSON.'] : [],
    diagnostics: invalid.map((path) => `Invalid schema artifact: ${path}`),
    sourceRefs: schemaPaths,
  };
};

/** AE-9.3 — designer drafts include draft.json binding. */
export const gradeDesignerRegistryBinding = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
): VerificationGraderResult => {
  const started = Date.now();
  const designerPaths = filterPaths(mutationPaths, '/workspace/designer/drafts/');

  if (designerPaths.length === 0) {
    return {
      ...baseResult(grader, started),
      grade: 'SKIPPED',
      evidence: [],
      diagnostics: ['No designer draft mutations in this revision.'],
      sourceRefs: [],
    };
  }

  const draftRoots = new Set<string>();
  for (const path of designerPaths) {
    const match = normalizePath(path).match(/^(.*\/workspace\/designer\/drafts\/[^/]+)/);
    if (match?.[1]) {
      draftRoots.add(match[1]);
    }
  }

  const missingBindings = [...draftRoots].filter((root) => (
    !designerPaths.some((path) => normalizePath(path) === `${root}/draft.json`)
  ));

  return {
    ...baseResult(grader, started),
    grade: missingBindings.length === 0 ? 'PASS' : 'FAIL',
    evidence: missingBindings.length === 0 ? ['Designer drafts include draft.json bindings.'] : [],
    diagnostics: missingBindings.map((root) => `Missing draft.json for ${root}`),
    sourceRefs: designerPaths,
  };
};

/** AE-9.3 — route artifacts registered under platform-registry/routes. */
export const gradeExperienceRouting = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
): VerificationGraderResult => {
  const started = Date.now();
  const routePaths = filterPaths(mutationPaths, '/workspace/platform-registry/routes/');

  if (routePaths.length === 0) {
    return {
      ...baseResult(grader, started),
      grade: 'SKIPPED',
      evidence: [],
      diagnostics: ['No route mutations in this revision.'],
      sourceRefs: [],
    };
  }

  const invalid = routePaths.filter((path) => !normalizePath(path).endsWith('.json'));

  return {
    ...baseResult(grader, started),
    grade: invalid.length === 0 ? 'PASS' : 'FAIL',
    evidence: invalid.length === 0 ? ['Route artifacts registered as JSON.'] : [],
    diagnostics: invalid.map((path) => `Invalid route artifact: ${path}`),
    sourceRefs: routePaths,
  };
};

/** AE-9.3 — permission artifacts registered under platform-registry/permissions. */
export const gradeRbacEnforcement = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
): VerificationGraderResult => {
  const started = Date.now();
  const permissionPaths = filterPaths(mutationPaths, '/workspace/platform-registry/permissions/');

  if (permissionPaths.length === 0) {
    return {
      ...baseResult(grader, started),
      grade: 'SKIPPED',
      evidence: [],
      diagnostics: ['No permission mutations in this revision.'],
      sourceRefs: [],
    };
  }

  const invalid = permissionPaths.filter((path) => !normalizePath(path).endsWith('.json'));

  return {
    ...baseResult(grader, started),
    grade: invalid.length === 0 ? 'PASS' : 'FAIL',
    evidence: invalid.length === 0 ? ['Permission artifacts registered as JSON.'] : [],
    diagnostics: invalid.map((path) => `Invalid permission artifact: ${path}`),
    sourceRefs: permissionPaths,
  };
};

/** AE-9.3 — package manifest mutations target manifest.json only. */
export const gradePackageManifestPolicy = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
): VerificationGraderResult => {
  const started = Date.now();
  const packagePaths = filterPaths(mutationPaths, '/runtime/packages/');

  if (packagePaths.length === 0) {
    return {
      ...baseResult(grader, started),
      grade: 'SKIPPED',
      evidence: [],
      diagnostics: ['No package manifest mutations in this revision.'],
      sourceRefs: [],
    };
  }

  const invalid = packagePaths.filter((path) => !normalizePath(path).endsWith('/manifest.json'));

  return {
    ...baseResult(grader, started),
    grade: invalid.length === 0 ? 'PASS' : 'FAIL',
    evidence: invalid.length === 0 ? ['Package mutations target manifest.json.'] : [],
    diagnostics: invalid.map((path) => `Invalid package manifest path: ${path}`),
    sourceRefs: packagePaths,
  };
};

/** AE-9.3 — capability-bound workspace mutations include changeSet scope. */
export const gradeCapabilityBinding = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
  changeSetId?: string,
): VerificationGraderResult => {
  const started = Date.now();

  if (mutationPaths.length === 0) {
    return {
      ...baseResult(grader, started),
      grade: 'SKIPPED',
      evidence: [],
      diagnostics: ['No mutations for capability binding check.'],
      sourceRefs: [],
    };
  }

  if (!changeSetId) {
    return {
      ...baseResult(grader, started),
      grade: 'WARNING',
      evidence: [],
      diagnostics: ['ChangeSet id missing for capability binding check.'],
      sourceRefs: mutationPaths,
    };
  }

  const expectedRoot = `${WORKSPACE_ARTIFACT_PREFIX}${changeSetId}`;
  const unbound = mutationPaths.filter((path) => !normalizePath(path).startsWith(expectedRoot));

  return {
    ...baseResult(grader, started),
    grade: unbound.length === 0 ? 'PASS' : 'FAIL',
    evidence: unbound.length === 0 ? [`Mutations bound to changeSet ${changeSetId}.`] : [],
    diagnostics: unbound.map((path) => `Capability binding drift: ${path}`),
    sourceRefs: mutationPaths,
  };
};

export const runVerificationGrader = (
  grader: VerificationGraderDefinition,
  mutationPaths: string[],
  changeSetId?: string,
): VerificationGraderResult => {
  switch (grader.graderId) {
    case 'active-root-mutation':
      return gradeActiveRootMutation(grader, mutationPaths);
    case 'workspace-drift':
      return gradeWorkspaceDrift(grader, mutationPaths, changeSetId);
    case 'project-standards':
      return gradeProjectStandards(grader, mutationPaths);
    case 'server-function-openapi':
      return gradeServerFunctionOpenApi(grader, mutationPaths);
    case 'fsd-dependency':
      return gradeFsdDependency(grader, mutationPaths);
    case 'clean-architecture':
      return gradeCleanArchitecture(grader, mutationPaths);
    case 'edge-db-boundary':
      return gradeEdgeDbBoundary(grader, mutationPaths);
    case 'shared-api-queries':
      return gradeSharedApiQueries(grader, mutationPaths);
    case 'designer-registry-binding':
      return gradeDesignerRegistryBinding(grader, mutationPaths);
    case 'experience-routing':
      return gradeExperienceRouting(grader, mutationPaths);
    case 'rbac-enforcement':
      return gradeRbacEnforcement(grader, mutationPaths);
    case 'package-manifest-policy':
      return gradePackageManifestPolicy(grader, mutationPaths);
    case 'capability-binding':
      return gradeCapabilityBinding(grader, mutationPaths, changeSetId);
    default:
      return {
        graderId: grader.graderId,
        version: grader.version,
        layer: grader.layer,
        grade: 'SKIPPED',
        evidence: [],
        diagnostics: [`Grader ${grader.graderId} depth deferred — enable in AE-9+ tranche.`],
        sourceRefs: [],
        durationMs: 0,
      };
  }
};
