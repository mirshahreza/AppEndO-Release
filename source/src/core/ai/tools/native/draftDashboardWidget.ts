import type { NativeToolDefinition } from '../ToolRegistry';
import { loadDashboardPage } from '../../../../server/services/dashboard-canvas/dashboardCanvas.service';
import { createDraftId, putAgentDraft } from './agentDraftStore';
import type { DashboardUserWidget } from '../../../../shared/api/contracts/dashboard-canvas';

export const DRAFT_DASHBOARD_WIDGET_TOOL_NAME = 'draft_dashboard_widget';

export type DashboardWidgetDraft = {
  kind: 'dashboard_widget';
  id: string;
  pageId: string;
  widget: Partial<DashboardUserWidget> & { kind: DashboardUserWidget['kind'] };
};

export const executeDraftDashboardWidget = async (args: Record<string, unknown>) => {
  const pageId = typeof args.pageId === 'string' ? args.pageId.trim() : '';
  const prompt = typeof args.prompt === 'string' ? args.prompt.trim().toLowerCase() : '';
  if (!pageId || !prompt) {
    return { ok: false as const, summary: 'pageId and prompt are required.', error: 'missing_args' };
  }
  try {
    const { config } = loadDashboardPage(pageId);
    const kind: DashboardUserWidget['kind'] = prompt.includes('kpi')
      ? 'kpi'
      : prompt.includes('table')
        ? 'table'
        : prompt.includes('note') || prompt.includes('text')
          ? 'text'
          : prompt.includes('combo') && (config.joinablePairs ?? []).length > 0
            ? 'combo'
            : 'chart';
    const domain = config.domain.find((entry) => (
      prompt.includes(entry.id.toLowerCase()) || (entry.label && prompt.includes(entry.label.toLowerCase()))
    )) ?? config.domain[0];
    if (!domain && kind !== 'text') {
      return { ok: false as const, summary: 'This page has no declared domain entries.', error: 'no_domain' };
    }
    const widget: DashboardWidgetDraft['widget'] = kind === 'combo' && config.joinablePairs?.[0]
      ? {
        kind: 'combo',
        comboRef: config.joinablePairs[0],
        fieldMapping: {},
        vizConfig: {},
        gridPosition: { x: 0, y: 0, w: 6, h: 4 },
      }
      : {
        kind,
        domainEntryId: domain?.id,
        fieldMapping: { metric: domain?.exposedFields[0], dimension: domain?.exposedFields[1] },
        vizConfig: {},
        gridPosition: { x: 0, y: 0, w: 6, h: 4 },
      };
    const draftId = createDraftId();
    putAgentDraft({
      kind: 'dashboard_widget',
      id: draftId,
      pageId,
      widget,
    });
    return {
      ok: true as const,
      summary: `Drafted a ${kind} widget for page ${pageId}. Confirm in Add Widget before saving.`,
      data: { draftId, pageId, widget },
      artifacts: [{ kind: 'draft' as const, id: draftId, label: `Dashboard widget (${kind})` }],
    };
  } catch (error) {
    return {
      ok: false as const,
      summary: error instanceof Error ? error.message : 'Widget draft failed.',
      error: 'draft_failed',
    };
  }
};

export const draftDashboardWidgetTool: NativeToolDefinition = {
  name: DRAFT_DASHBOARD_WIDGET_TOOL_NAME,
  description: 'Draft a dashboard widget from natural language. Output pre-fills Add Widget; it never writes personalization directly.',
  group: 'draft',
  parameters: {
    type: 'object',
    properties: {
      pageId: { type: 'string', description: 'Designer page / draft id' },
      prompt: { type: 'string', description: 'What the viewer wants to see' },
    },
    required: ['pageId', 'prompt'],
  },
  execute: executeDraftDashboardWidget,
};
