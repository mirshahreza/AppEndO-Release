import { PROJECT_STANDARDS } from '../../../config/projectStandards';
import type {
  EngineeringKnowledgeRecord,
  EngineeringKnowledgeRegistryHealth,
  FindStandardsOptions,
} from '../../../shared/api/contracts/appendoo/knowledgeRegistry.types';
import {
  explainKnowledgeSelection,
  findConstraints,
  findStandards,
  getRegistryHealth,
  ingestProjectStandards,
} from '../../../shared/lib/appendoo/engineeringKnowledgeRegistry';

export class KnowledgeRegistryService {
  private cachedSourceVersion: string | null = null;

  private cachedRecords: EngineeringKnowledgeRecord[] = [];

  private ensureRecords(): EngineeringKnowledgeRecord[] {
    if (this.cachedSourceVersion !== PROJECT_STANDARDS.version) {
      this.cachedRecords = ingestProjectStandards(PROJECT_STANDARDS);
      this.cachedSourceVersion = PROJECT_STANDARDS.version;
    }
    return this.cachedRecords;
  }

  findStandards(options: FindStandardsOptions = {}): EngineeringKnowledgeRecord[] {
    return findStandards(this.ensureRecords(), options);
  }

  findConstraints(appliesTo?: string): EngineeringKnowledgeRecord[] {
    return findConstraints(this.ensureRecords(), appliesTo);
  }

  getHealth(): EngineeringKnowledgeRegistryHealth {
    const records = this.ensureRecords();
    return getRegistryHealth(PROJECT_STANDARDS, records);
  }

  explainSelection(options: FindStandardsOptions = {}) {
    return explainKnowledgeSelection(this.ensureRecords(), options);
  }

  /** For tests — force re-ingest after PROJECT_STANDARDS mutation. */
  resetCacheForTests(): void {
    this.cachedSourceVersion = null;
    this.cachedRecords = [];
  }
}

export const knowledgeRegistryService = new KnowledgeRegistryService();
