import { describe, expect, it } from 'vitest';
import { PROJECT_STANDARDS } from '../../../../config/projectStandards';
import {
  findConstraints,
  findStandards,
  getRegistryHealth,
  ingestProjectStandards,
} from '../engineeringKnowledgeRegistry';

describe('engineeringKnowledgeRegistry', () => {
  it('ingests project standards as PLATFORM_VERIFIED records', () => {
    const records = ingestProjectStandards(PROJECT_STANDARDS);
    expect(records.length).toBe(PROJECT_STANDARDS.standards.length);
    expect(records[0]?.trust).toBe('PLATFORM_VERIFIED');
    expect(records[0]?.sourceType).toBe('project_standards');
    expect(records[0]?.recordId).toMatch(/^project-standards:/);
  });

  it('findStandards filters by query', () => {
    const records = ingestProjectStandards(PROJECT_STANDARDS);
    const hits = findStandards(records, { query: 'checkbox', maxResults: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((record) => (
      record.sourceId.toLowerCase().includes('checkbox')
      || record.title.toLowerCase().includes('checkbox')
      || record.statement.toLowerCase().includes('checkbox')
      || record.appliesTo.some((scope) => scope.toLowerCase().includes('checkbox'))
    ))).toBe(true);
  });

  it('findConstraints returns normative constraint-like records', () => {
    const records = ingestProjectStandards(PROJECT_STANDARDS);
    const constraints = findConstraints(records, 'AgentOrchestrator');
    expect(constraints.every((record) => (
      record.kind === 'CONSTRAINT' || record.kind === 'ANTI_PATTERN'
    ))).toBe(true);
  });

  it('reports registry health', () => {
    const records = ingestProjectStandards(PROJECT_STANDARDS);
    const health = getRegistryHealth(PROJECT_STANDARDS, records);
    expect(health.sourceVersion).toBe(PROJECT_STANDARDS.version);
    expect(health.recordCount).toBe(records.length);
    expect(health.normativeCount).toBe(records.length);
  });
});
