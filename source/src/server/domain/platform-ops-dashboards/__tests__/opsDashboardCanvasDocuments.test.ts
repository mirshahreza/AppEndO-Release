import { describe, expect, it } from 'vitest';
import { assertPersistableDesignerDocument } from '../../../../domain/component-designer/documentPersist';
import type { EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import { OPS_DASHBOARD_MODELS, OPS_DASHBOARD_PAGE_KEYS } from '../../../../shared/lib/opsDashboardCatalog';
import type { StoredDataSource } from '../../../db/dataSourcesStore';
import { buildOpsDashboardDocuments } from '../opsDashboardCanvasDocuments';

const dataSource = {
  id: 'ds_default',
  name: 'default-db',
  type: 'SQL Server',
  host: 'localhost',
  port: 1433,
  status: 'connected',
  isDefault: true,
  created_at: '2026-09-14T00:00:00.000Z',
  updated_at: '2026-09-14T00:00:00.000Z',
} as StoredDataSource;

const models = new Map<string, EdgeModelDefinition>(
  OPS_DASHBOARD_MODELS.map((spec) => [spec.id, { id: spec.edgeModelId } as EdgeModelDefinition]),
);

describe('opsDashboardCanvasDocuments', () => {
  it('builds persistable Insights canvases', () => {
    const documents = buildOpsDashboardDocuments(dataSource, models);
    for (const pageKey of OPS_DASHBOARD_PAGE_KEYS) {
      expect(() => assertPersistableDesignerDocument(documents[pageKey])).not.toThrow();
    }
  });
});
