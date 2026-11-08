import { describe, expect, it } from 'vitest';
import { knowledgeRegistryService } from '../knowledgeRegistry.service';

describe('knowledgeRegistryService', () => {
  it('findStandards returns governed records from project standards', () => {
    const hits = knowledgeRegistryService.findStandards({ query: 'grid', maxResults: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.trust).toBe('PLATFORM_VERIFIED');
  });

  it('getHealth reports ingested registry snapshot', () => {
    const health = knowledgeRegistryService.getHealth();
    expect(health.recordCount).toBeGreaterThan(0);
    expect(health.registryVersion).toBe('1.0.0');
  });
});
