import type { Request, Response } from 'express';
import type { DataSourcesService } from '../services/data-sources.service';
import type { DataSourceAuditActor } from '../services/data-sources.service';
import { asyncHandler } from '../utils/asyncHandler';

const resolveDataSourceAuditActor = (req: Request): DataSourceAuditActor => ({
  username: req.auth?.email?.trim() || null,
});

export class DataSourcesController {
  constructor(private readonly dataSourcesService: DataSourcesService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const result = this.dataSourcesService.list(req.query as Record<string, unknown>);
    res.json(result.body);
  }, 'Failed to list data sources.');

  create = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.create(
      (req.body || {}) as Record<string, unknown>,
      resolveDataSourceAuditActor(req),
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create data source.');

  update = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.update(
      String(req.params.id || ''),
      (req.body || {}) as Record<string, unknown>,
      resolveDataSourceAuditActor(req),
    );
    res.json(result.body);
  }, 'Failed to update data source.');

  remove = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.remove(String(req.params.id || ''));
    res.json(result.body);
  }, 'Failed to delete data source.');

  testById = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.testById(String(req.params.id || ''));
    res.json(result.body);
  }, 'Failed to test data source connectivity.');

  testDraft = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.testDraft((req.body || {}) as Record<string, unknown>);
    res.json(result.body);
  }, 'Failed to test draft data source connectivity.');

  testAll = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.dataSourcesService.testAll();
    res.json(result.body);
  }, 'Failed to test all data source connections.');

  listSchemaObjects = asyncHandler(async (req: Request, res: Response) => {
    const objectType = String(req.query.objectType || 'TABLE');
    const dataSourceId = String(req.query.dataSourceId || req.params.id || '');
    const functionKindRaw = String(req.query.functionKind || '').trim().toUpperCase();
    const functionKind = functionKindRaw === 'SCALAR' || functionKindRaw === 'TABLE_VALUED'
      ? functionKindRaw
      : undefined;
    const result = await this.dataSourcesService.listSchemaObjects(
      dataSourceId,
      objectType as 'TABLE' | 'VIEW' | 'PROCEDURE' | 'FUNCTION',
      functionKind,
    );
    res.json(result.body);
  }, 'Failed to list schema objects.');

  listSchemaCatalog = asyncHandler(async (req: Request, res: Response) => {
    const dataSourceId = String(req.query.dataSourceId || req.params.id || '');
    const result = await this.dataSourcesService.listSchemaCatalog(dataSourceId);
    res.json(result.body);
  }, 'Failed to load schema catalog.');

  listObjectFields = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.listObjectFields(
      String(req.query.dataSourceId || ''),
      String(req.query.objectType || 'TABLE') as 'TABLE' | 'VIEW' | 'PROCEDURE' | 'FUNCTION',
      String(req.query.objectName || ''),
    );
    res.json(result.body);
  }, 'Failed to list object fields.');

  listObjectRelations = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.listObjectRelations(
      String(req.query.dataSourceId || ''),
      String(req.query.objectType || 'TABLE') as 'TABLE' | 'VIEW',
      String(req.query.objectName || ''),
    );
    res.json(result.body);
  }, 'Failed to list object relations.');

  addForeignKeyConstraint = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.addForeignKeyConstraint(
      (req.body || {}) as Record<string, unknown>,
    );
    res.status(201).json(result.body);
  }, 'Failed to add foreign-key constraint.');

  dropForeignKeyConstraint = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.dropForeignKeyConstraint(
      (req.body || {}) as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to drop foreign-key constraint.');

  createSchemaObject = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.createSchemaObject((req.body || {}) as Record<string, unknown>);
    res.status(201).json(result.body);
  }, 'Failed to create schema object.');

  deleteSchemaObject = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.deleteSchemaObject((req.body || {}) as Record<string, unknown>);
    res.json(result.body);
  }, 'Failed to delete schema object.');

  truncateSchemaObject = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.truncateSchemaObject((req.body || {}) as Record<string, unknown>);
    res.json(result.body);
  }, 'Failed to truncate schema object.');

  getSchemaObjectDeletePreview = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.getSchemaObjectDeletePreview(req.query as Record<string, unknown>);
    res.json(result.body);
  }, 'Failed to load schema object delete preview.');

  getSchemaObjectDefinition = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.getSchemaObjectDefinition(req.query as Record<string, unknown>);
    res.json(result.body);
  }, 'Failed to load schema object definition.');

  getSchemaObjectDependencies = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.getSchemaObjectDependencies(req.query as Record<string, unknown>);
    res.json(result.body);
  }, 'Failed to load schema object dependencies.');

  updateSchemaObjectDefinition = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.updateSchemaObjectDefinition((req.body || {}) as Record<string, unknown>);
    res.json(result.body);
  }, 'Failed to update schema object definition.');

  executeDataSourceQuery = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.dataSourcesService.executeDataSourceQuery((req.body || {}) as Record<string, unknown>);
    res.json(result.body);
  }, 'Failed to execute data source query.');
}
