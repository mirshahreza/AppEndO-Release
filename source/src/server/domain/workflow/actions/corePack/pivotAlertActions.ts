import { parsePivotSpec } from '../../../../../shared/api/contracts/data-api';
import type { ActionDefinition, ActionExecutor } from '../types';
import { getDataSourcesFromSettings } from '../../../../db/dataSourcesStore';
import { SETTINGS_PATH } from '../../../../config/settingsFile';
import { executePivot } from '../../../../services/data-api/pivotExecute';
import { dispatchNotification } from '../../../../services/notifications/notificationDispatch';
import { parseNotificationUserId } from '../../../../services/notifications/userNotification.service';
import { renderPivotSnapshotPdf } from '../../../../services/dashboard-canvas/dashboardCanvasRender';
import { loadDashboardPage } from '../../../../services/dashboard-canvas/dashboardCanvas.service';

const inlineObject = (properties: Record<string, unknown>, required?: string[]) => ({
  type: 'INLINE' as const,
  schema: { type: 'object', properties, ...(required ? { required } : {}) },
});

const compare = (left: number, operator: string, right: number): boolean => {
  switch (operator) {
    case 'gte': return left >= right;
    case 'lt': return left < right;
    case 'lte': return left <= right;
    case 'eq': return left === right;
    case 'ne': return left !== right;
    case 'gt':
    default: return left > right;
  }
};

export const dataPivotThresholdCheckDefinition: ActionDefinition = {
  key: 'data.pivot-threshold-check',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineObject({
    dataSourceId: { type: 'string', title: 'Data source', format: 'data-source-id' },
  }, ['dataSourceId']),
  inputSchema: inlineObject({
    spec: { type: 'object', title: 'PivotSpec' },
    threshold: {
      type: 'object',
      properties: {
        field: { type: 'string' },
        operator: { type: 'string', enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'ne'] },
        value: { type: 'number' },
      },
      required: ['operator', 'value'],
    },
    userId: { type: ['integer', 'string'], title: 'Notify user id on breach' },
    title: { type: 'string' },
    body: { type: 'string' },
  }, ['spec', 'threshold']),
  outputSchema: inlineObject({
    breached: { type: 'boolean' },
    value: { type: ['number', 'null'] },
  }),
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['data.db-read'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['data', 'pivot', 'alert'],
};

export const dataPivotThresholdCheckExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const dataSourceId = (config as { dataSourceId?: unknown })?.dataSourceId;
    if (typeof dataSourceId !== 'string' || !dataSourceId.trim()) {
      return { status: 'FAILED', errorCode: 'PIVOT_ALERT_DATASOURCE_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'config.dataSourceId is required.' };
    }
    const rec = (input ?? {}) as {
      spec?: unknown;
      threshold?: { field?: string; operator?: string; value?: number };
      userId?: unknown;
      title?: unknown;
      body?: unknown;
    };
    try {
      const spec = parsePivotSpec(rec.spec);
      const dataSource = getDataSourcesFromSettings(SETTINGS_PATH).find((item) => item.id === dataSourceId);
      if (!dataSource) {
        return { status: 'FAILED', errorCode: 'PIVOT_ALERT_DATASOURCE_MISSING', errorClass: 'VALIDATION', safeMessage: 'Data source was not found.' };
      }
      const executed = await executePivot({
        spec,
        dataSource,
        policyContextKey: 'workflow:pivot-threshold',
      });
      const measureIndex = rec.threshold?.field
        ? executed.data.measures.findIndex((item) => item.field === rec.threshold?.field)
        : 0;
      const value = executed.data.cells[0]?.values[measureIndex < 0 ? 0 : measureIndex] ?? null;
      const thresholdValue = Number(rec.threshold?.value);
      const operator = rec.threshold?.operator ?? 'gt';
      const breached = typeof value === 'number' && Number.isFinite(thresholdValue)
        ? compare(value, operator, thresholdValue)
        : false;
      if (breached) {
        const userId = parseNotificationUserId(rec.userId);
        if (userId) {
          await dispatchNotification({
            userId,
            title: typeof rec.title === 'string' && rec.title.trim() ? rec.title : 'Pivot threshold breached',
            body: typeof rec.body === 'string' && rec.body.trim()
              ? rec.body
              : `Value ${value} ${operator} ${thresholdValue}.`,
            severity: 'warning',
            eventType: 'workflow',
          });
        }
      }
      return { status: 'SUCCEEDED', output: { breached, value } };
    } catch (error) {
      return {
        status: 'FAILED',
        errorCode: 'PIVOT_ALERT_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage: error instanceof Error ? error.message : 'Pivot threshold check failed.',
      };
    }
  },
};

export const dataPivotSnapshotDeliveryDefinition: ActionDefinition = {
  key: 'data.pivot-snapshot-delivery',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineObject({
    pageId: { type: 'string', title: 'Dashboard page id' },
  }, ['pageId']),
  inputSchema: inlineObject({
    userId: { type: ['integer', 'string'], title: 'Recipient user id' },
    title: { type: 'string' },
    body: { type: 'string' },
  }, ['userId']),
  outputSchema: inlineObject({
    delivered: { type: 'boolean' },
    bytes: { type: 'number' },
  }),
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['communication.notification'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['data', 'pivot', 'delivery'],
};

export const dataPivotSnapshotDeliveryExecutor: ActionExecutor = {
  async execute(_context, config, input) {
    const pageId = (config as { pageId?: unknown })?.pageId;
    if (typeof pageId !== 'string' || !pageId.trim()) {
      return { status: 'FAILED', errorCode: 'PIVOT_DELIVERY_PAGE_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'config.pageId is required.' };
    }
    const rec = (input ?? {}) as { userId?: unknown; title?: unknown; body?: unknown };
    const userId = parseNotificationUserId(rec.userId);
    if (!userId) {
      return { status: 'FAILED', errorCode: 'PIVOT_DELIVERY_USER_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.userId is required.' };
    }
    try {
      const { config: pageConfig } = loadDashboardPage(pageId);
      const pdf = await renderPivotSnapshotPdf({
        title: typeof rec.title === 'string' && rec.title.trim() ? rec.title : `Dashboard ${pageId}`,
        takenAt: new Date().toISOString(),
        results: [],
      });
      await dispatchNotification({
        userId,
        title: typeof rec.title === 'string' && rec.title.trim() ? rec.title : `Scheduled dashboard ${pageConfig.domain[0]?.label ?? pageId}`,
        body: typeof rec.body === 'string' && rec.body.trim()
          ? rec.body
          : `Scheduled delivery (${pdf.byteLength} bytes).`,
        severity: 'info',
        eventType: 'workflow',
      });
      return { status: 'SUCCEEDED', output: { delivered: true, bytes: pdf.byteLength } };
    } catch (error) {
      return {
        status: 'FAILED',
        errorCode: 'PIVOT_DELIVERY_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage: error instanceof Error ? error.message : 'Snapshot delivery failed.',
      };
    }
  },
};
