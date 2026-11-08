import type { ProjectStandardsResource, ProjectStandard } from '../../../config/projectStandards';
import type {
  EngineeringKnowledgeRecord,
  EngineeringKnowledgeRegistryHealth,
  FindStandardsOptions,
  KnowledgeKind,
  KnowledgeTrustLevel,
} from '../../api/contracts/appendoo/knowledgeRegistry.types';
import { ENGINEERING_KNOWLEDGE_REGISTRY_VERSION } from '../../api/contracts/appendoo/knowledgeRegistry.types';

const classifyStandardKind = (standard: ProjectStandard): KnowledgeKind => {
  const id = standard.id.toLowerCase();
  if (id.includes('anti') || id.includes('forbidden') || id.includes('never')) {
    return 'ANTI_PATTERN';
  }
  if (id.includes('verify') || id.includes('test')) {
    return 'VERIFICATION_GUIDANCE';
  }
  if (id.includes('builder') || id.includes('workflow') || id.includes('vibe')) {
    return 'BUILDER_GUIDANCE';
  }
  if (id.includes('constraint') || id.includes('boundary') || id.includes('must-not')) {
    return 'CONSTRAINT';
  }
  return 'STANDARD';
};

/** Normalize `/api/project-standards` into governed knowledge records — no prompt duplication. */
export const ingestProjectStandards = (
  resource: ProjectStandardsResource,
): EngineeringKnowledgeRecord[] => resource.standards.map((standard) => ({
  recordId: `project-standards:${standard.id}`,
  kind: classifyStandardKind(standard),
  trust: 'PLATFORM_VERIFIED',
  title: standard.title,
  statement: standard.value,
  appliesTo: [...standard.appliesTo],
  sourceType: 'project_standards',
  sourceId: standard.id,
  sourceVersion: resource.version,
  updatedAt: resource.updatedAt,
}));

const matchesQuery = (record: EngineeringKnowledgeRecord, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return record.sourceId.toLowerCase().includes(needle)
    || record.title.toLowerCase().includes(needle)
    || record.statement.toLowerCase().includes(needle)
    || record.appliesTo.some((scope) => scope.toLowerCase().includes(needle));
};

const matchesAppliesTo = (record: EngineeringKnowledgeRecord, appliesTo: string): boolean => {
  const needle = appliesTo.trim().toLowerCase();
  if (!needle) return true;

  return record.appliesTo.some((scope) => scope.toLowerCase().includes(needle))
    || record.sourceId.toLowerCase().includes(needle);
};

const isNormative = (record: EngineeringKnowledgeRecord): boolean => (
  record.trust === 'PLATFORM_VERIFIED' || record.trust === 'ARCHITECT_APPROVED'
);

export const findStandards = (
  records: EngineeringKnowledgeRecord[],
  options: FindStandardsOptions = {},
): EngineeringKnowledgeRecord[] => {
  const maxResults = options.maxResults && options.maxResults > 0
    ? Math.min(Math.floor(options.maxResults), 100)
    : 20;

  let filtered = records;

  if (options.normativeOnly !== false) {
    filtered = filtered.filter(isNormative);
  }

  if (options.appliesTo?.trim()) {
    filtered = filtered.filter((record) => matchesAppliesTo(record, options.appliesTo!));
  }

  if (options.query?.trim()) {
    filtered = filtered.filter((record) => matchesQuery(record, options.query!));
  }

  return filtered.slice(0, maxResults);
};

export const findConstraints = (
  records: EngineeringKnowledgeRecord[],
  appliesTo?: string,
): EngineeringKnowledgeRecord[] => findStandards(records, {
  appliesTo,
  maxResults: 50,
  normativeOnly: true,
}).filter((record) => record.kind === 'CONSTRAINT' || record.kind === 'ANTI_PATTERN');

export const getRegistryHealth = (
  resource: ProjectStandardsResource,
  records: EngineeringKnowledgeRecord[],
): EngineeringKnowledgeRegistryHealth => ({
  registryVersion: ENGINEERING_KNOWLEDGE_REGISTRY_VERSION,
  sourceVersion: resource.version,
  updatedAt: resource.updatedAt,
  recordCount: records.length,
  normativeCount: records.filter(isNormative).length,
});

export const explainKnowledgeSelection = (
  records: EngineeringKnowledgeRecord[],
  options: FindStandardsOptions,
): {
  matchedCount: number;
  returnedCount: number;
  trustLevels: KnowledgeTrustLevel[];
  kinds: KnowledgeKind[];
} => {
  const allMatches = findStandards(records, { ...options, maxResults: 10_000 });
  const returned = findStandards(records, options);

  return {
    matchedCount: allMatches.length,
    returnedCount: returned.length,
    trustLevels: [...new Set(returned.map((record) => record.trust))],
    kinds: [...new Set(returned.map((record) => record.kind))],
  };
};
