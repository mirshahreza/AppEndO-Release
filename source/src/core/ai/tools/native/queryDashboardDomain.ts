import { parsePivotSpec } from '../../../../shared/api/contracts/data-api';
import type { NativeToolDefinition } from '../ToolRegistry';
import { SETTINGS_PATH } from '../../../../server/config/settingsFile';
import {
  executeDashboardDomainPivot,
  loadDashboardPage,
} from '../../../../server/services/dashboard-canvas/dashboardCanvas.service';
import { assertPivotSpecInDomain } from '../../../../shared/lib/dashboardCanvas';

export const QUERY_DASHBOARD_DOMAIN_TOOL_NAME = 'query_dashboard_domain';

export const executeQueryDashboardDomain = async (args: Record<string, unknown>) => {
  const pageId = typeof args.pageId === 'string' ? args.pageId.trim() : '';
  const domainEntryId = typeof args.domainEntryId === 'string' ? args.domainEntryId.trim() : '';
  if (!pageId || !domainEntryId) {
    return { ok: false as const, summary: 'pageId and domainEntryId are required.', error: 'missing_args' };
  }
  try {
    const { config } = loadDashboardPage(pageId);
    const spec = parsePivotSpec(args.spec);
    assertPivotSpecInDomain(config, domainEntryId, spec);
    const result = await executeDashboardDomainPivot({
      pageId,
      domainEntryId,
      spec,
      policyContextKey: 'mcp:query_dashboard_domain',
      settingsPath: SETTINGS_PATH,
    });
    return {
      ok: true as const,
      summary: `Queried dashboard domain "${domainEntryId}" on page ${pageId}.`,
      data: result,
    };
  } catch (error) {
    return {
      ok: false as const,
      summary: error instanceof Error ? error.message : 'Dashboard domain query failed.',
      error: 'query_failed',
    };
  }
};

export const queryDashboardDomainTool: NativeToolDefinition = {
  name: QUERY_DASHBOARD_DOMAIN_TOOL_NAME,
  description: 'Run a PivotSpec against a personalizable dashboard page domain entry. Same whitelist as the UI. Never accepts raw SQL.',
  group: 'data',
  parameters: {
    type: 'object',
    properties: {
      pageId: { type: 'string', description: 'Designer page / draft id' },
      domainEntryId: { type: 'string', description: 'Declared domain entry id' },
      spec: { type: 'object', description: 'PivotSpec (rows, columns, measures, filters)' },
    },
    required: ['pageId', 'domainEntryId', 'spec'],
  },
  execute: executeQueryDashboardDomain,
};
