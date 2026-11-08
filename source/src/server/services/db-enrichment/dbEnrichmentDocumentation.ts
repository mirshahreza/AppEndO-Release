import { HttpError } from '../../errors/HttpError';
import { DB_ENRICHMENT_CONFIDENCE_BY_BASIS, type DbEnrichmentDocumentation, type DbEnrichmentDocumentationObject } from '../../../shared/api/contracts/db-enrichment';
import { mapWithConcurrency } from '../../utils/sqlSchemaSemantics';
import type { DataSourcesService } from '../data-sources.service';
import * as dbEnrichmentRepository from '../../domain/db-enrichment/dbEnrichmentRepository';

/** How many tables' schema/relations are introspected concurrently — no LLM calls here, just DB metadata reads. */
const INTROSPECTION_CONCURRENCY = 5;

/** Builds the full documentation payload for a data source: schema shape plus every piece of DB Enricher knowledge and open ambiguity gathered so far. */
export const buildDbEnrichmentDocumentation = async (
  dataSourcesService: DataSourcesService,
  dataSourceId: string,
): Promise<DbEnrichmentDocumentation> => {
  const source = dataSourcesService.list({}).body.items.find((item) => item.id === dataSourceId);
  if (!source) {
    throw new HttpError(404, 'Data source not found.');
  }

  const [catalog, knowledgeRows, questions] = await Promise.all([
    dataSourcesService.listSchemaCatalog(dataSourceId).then((result) => result.body.catalog),
    dbEnrichmentRepository.listKnowledgeForDataSource(dataSourceId),
    dbEnrichmentRepository.listQuestions(dataSourceId),
  ]);

  const knowledgeByObject = new Map(knowledgeRows.map((row) => [`${row.objectType}:${row.objectName}`, row]));

  const catalogObjects: { objectType: 'TABLE' | 'VIEW'; name: string }[] = [
    ...catalog.TABLE.map((name) => ({ objectType: 'TABLE' as const, name })),
    ...catalog.VIEW.map((name) => ({ objectType: 'VIEW' as const, name })),
  ];

  const objects = await mapWithConcurrency(catalogObjects, INTROSPECTION_CONCURRENCY, async (object) => {
    const [fields, relationsResult] = await Promise.all([
      dataSourcesService.listObjectFields(dataSourceId, object.objectType, object.name).then((result) => result.body.items),
      dataSourcesService.listObjectRelations(dataSourceId, object.objectType, object.name).then((result) => result.body.data.relations),
    ]);
    const outgoingEdges = relationsResult.filter((edge) => edge.fromTable === object.name);
    const knowledge = knowledgeByObject.get(`${object.objectType}:${object.name}`);
    const knowledgeColumns = new Map((knowledge?.columns ?? []).map((column) => [column.columnName, column]));
    const knowledgeRelations = new Map(
      (knowledge?.relations ?? []).map((relation) => [`${relation.fromColumn}:${relation.toTable}:${relation.toColumn}`, relation]),
    );

    const entry: DbEnrichmentDocumentationObject = {
      objectType: object.objectType,
      objectName: object.name,
      purpose: knowledge?.tablePurpose ?? null,
      confidence: knowledge?.tableConfidence ?? null,
      sourceOfTruth: knowledge?.sourceOfTruth ?? null,
      columns: fields.map((field) => {
        const columnKnowledge = knowledgeColumns.get(field.name);
        return {
          name: field.name,
          dataType: field.dataType,
          isPrimaryKey: field.isPrimaryKey,
          meaning: columnKnowledge?.meaning || null,
          confidence: columnKnowledge?.confidence ?? null,
          confidenceBasis: columnKnowledge?.confidenceBasis ?? null,
          valueGlossary: columnKnowledge?.valueGlossary,
        };
      }),
      relations: outgoingEdges.map((edge) => {
        const known = knowledgeRelations.get(`${edge.fromColumn}:${edge.toTable}:${edge.toColumn}`);
        return {
          fromColumn: edge.fromColumn,
          toTable: edge.toTable,
          toColumn: edge.toColumn,
          intent: known?.intent ?? `references ${edge.toTable}.${edge.toColumn}`,
          confidence: known?.confidence ?? DB_ENRICHMENT_CONFIDENCE_BY_BASIS.fk_lookup_sampled,
        };
      }),
    };
    return entry;
  });

  const tablesEnriched = objects.filter((object) => knowledgeByObject.has(`${object.objectType}:${object.objectName}`)).length;
  const confidenceWeights = objects
    .filter((object) => object.confidence !== null)
    .map((object) => ({ confidence: object.confidence as number, weight: Math.max(object.columns.length, 1) }));
  const totalWeight = confidenceWeights.reduce((sum, entry) => sum + entry.weight, 0);
  const overallConfidence = totalWeight > 0
    ? confidenceWeights.reduce((sum, entry) => sum + entry.confidence * entry.weight, 0) / totalWeight
    : null;

  return {
    dataSourceId,
    dataSourceName: source.name,
    dataSourceType: source.type,
    generatedAt: new Date().toISOString(),
    tablesTotal: objects.length,
    tablesEnriched,
    overallConfidence,
    openQuestionCount: questions.filter((question) => question.status === 'open').length,
    objects,
    questions,
  };
};
