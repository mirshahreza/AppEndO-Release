import type { KnowledgeTrustLevel } from '../../api/contracts/appendoo/knowledgeRegistry.types';
import { ENGINEERING_KNOWLEDGE_REGISTRY_VERSION } from '../../api/contracts/appendoo/knowledgeRegistry.types';

export const ENGINEERING_PATTERN_REGISTRY_VERSION = '1.0.0';

export type EngineeringPatternLifecycle =
  | 'CANDIDATE'
  | 'REVIEWED'
  | 'APPROVED'
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'RETIRED';

export type EngineeringPatternRecord = {
  patternId: string;
  title: string;
  problemStatement: string;
  applicability: string[];
  solutionStructure: string;
  requiredCapabilities: string[];
  trust: KnowledgeTrustLevel;
  lifecycle: EngineeringPatternLifecycle;
  referenceImplementations: string[];
  sourceVersion: string;
};

export type FindApplicablePatternsOptions = {
  query?: string;
  appliesTo?: string;
  maxResults?: number;
  activeOnly?: boolean;
};

/** AE-5.1 — governed pattern registry scaffold seeded from reference packages. */
export const SEED_ENGINEERING_PATTERNS: EngineeringPatternRecord[] = [
  {
    patternId: 'pattern.ref-hello-page',
    title: 'Reference Hello Page',
    problemStatement: 'Introduce a minimal studio page with routing and CRUD shell.',
    applicability: ['page', 'crud', 'studio'],
    solutionStructure: 'Feature module + page module + route registration + AppTableGrid list surface.',
    requiredCapabilities: ['appendo-files', 'appendo-codebase'],
    trust: 'PLATFORM_VERIFIED',
    lifecycle: 'ACTIVE',
    referenceImplementations: ['ref-hello-page'],
    sourceVersion: ENGINEERING_PATTERN_REGISTRY_VERSION,
  },
  {
    patternId: 'pattern.ref-hello-api',
    title: 'Reference Hello API',
    problemStatement: 'Add a managed server function with OpenAPI-visible contract.',
    applicability: ['server_function', 'api'],
    solutionStructure: 'Server function service + contract mappers + managed route registration.',
    requiredCapabilities: ['appendo-server-functions', 'appendo-standards'],
    trust: 'PLATFORM_VERIFIED',
    lifecycle: 'ACTIVE',
    referenceImplementations: ['ref-hello-api'],
    sourceVersion: ENGINEERING_PATTERN_REGISTRY_VERSION,
  },
];

export const findApplicablePatterns = (
  patterns: EngineeringPatternRecord[] = SEED_ENGINEERING_PATTERNS,
  options: FindApplicablePatternsOptions = {},
): EngineeringPatternRecord[] => {
  const maxResults = options.maxResults ?? 10;
  const query = options.query?.trim().toLowerCase();
  const appliesTo = options.appliesTo?.trim().toLowerCase();

  let filtered = patterns;
  if (options.activeOnly !== false) {
    filtered = filtered.filter((pattern) => pattern.lifecycle === 'ACTIVE' || pattern.lifecycle === 'APPROVED');
  }
  if (appliesTo) {
    filtered = filtered.filter((pattern) => (
      pattern.applicability.some((scope) => scope.toLowerCase().includes(appliesTo))
      || pattern.patternId.toLowerCase().includes(appliesTo)
    ));
  }
  if (query) {
    filtered = filtered.filter((pattern) => (
      pattern.title.toLowerCase().includes(query)
      || pattern.problemStatement.toLowerCase().includes(query)
      || pattern.solutionStructure.toLowerCase().includes(query)
    ));
  }

  return filtered.slice(0, maxResults);
};

export const getPattern = (
  patternId: string,
  patterns: EngineeringPatternRecord[] = SEED_ENGINEERING_PATTERNS,
): EngineeringPatternRecord | undefined => (
  patterns.find((pattern) => pattern.patternId === patternId)
);

export const getPatternRegistryHealth = (
  patterns: EngineeringPatternRecord[] = SEED_ENGINEERING_PATTERNS,
) => ({
  registryVersion: ENGINEERING_PATTERN_REGISTRY_VERSION,
  patternCount: patterns.length,
  activeCount: patterns.filter((pattern) => pattern.lifecycle === 'ACTIVE').length,
});
