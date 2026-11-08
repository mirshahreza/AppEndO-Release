import { randomUUID } from 'crypto';
import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import {
  canAccessManagedFunction,
  normalizeFunctionAccessControl,
} from '../../../shared/api/contracts/server-functions/accessControl';
import type { PivotSpec } from '../../../shared/api/contracts/data-api';
import {
  DASHBOARD_CANVAS_CONFIG_PROP,
  DASHBOARD_PERSONALIZABLE_PROP,
  parseDashboardCanvasPageConfig,
  parseDashboardCanvasPersonalization,
  type DashboardAccessPermission,
  type DashboardCanvasPageConfig,
  type DashboardCanvasPersonalization,
} from '../../../shared/api/contracts/dashboard-canvas';
import {
  assertPivotSpecInDomain,
  sanitizeCanvasPersonalization,
  sanitizeDashboardEmbedOrigins,
} from '../../../shared/lib/dashboardCanvas';
import type { DesignerDocument } from '../../../domain/component-designer/types';
import { getDesignerDraft } from '../../domain/component-designer/drafts';
import { getDataSourcesFromSettings, type StoredDataSource } from '../../db/dataSourcesStore';
import { executePivot } from '../data-api/pivotExecute';
import { DataApiExecutor } from '../data-api/dataApiExecutor';
import { listEdgeModels } from '../data-api/edgeModelStore';
import { listEdgeApiDefinitions } from '../data-api/edgeApiStore';
import {
  getDashboardPageAccessModel,
  getDashboardSnapshotModel,
  getDashboardWidgetCommentModel,
} from '../../domain/dashboard-canvas/dashboardCanvasSequelizeModels';
import { renderPivotSnapshotPdf, renderPivotSnapshotPng, renderPivotSnapshotText } from './dashboardCanvasRender';
import {
  normalizeDashboardLayoutPayload,
  type DashboardLayoutPreference,
} from '../../../shared/lib/userDashboardLayout';
import {
  getMyDashboardLayout,
  updateMyDashboardLayout,
} from '../attributes/dashboardLayout.service';
import type { ActorContext } from '../../types/requestContext';
import { HttpError } from '../../errors/HttpError';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const readPageConfigFromDocument = (document: DesignerDocument): DashboardCanvasPageConfig => {
  const root = document.nodes[document.rootNodeId];
  const parsed = parseDashboardCanvasPageConfig(root?.props?.[DASHBOARD_CANVAS_CONFIG_PROP]);
  const personalizable = root?.props?.[DASHBOARD_PERSONALIZABLE_PROP] === true || parsed.personalizable;
  return { ...parsed, personalizable };
};

export const loadDashboardPage = (pageId: string): { document: DesignerDocument; config: DashboardCanvasPageConfig } => {
  const draft = getDesignerDraft(pageId);
  if (!draft?.document) {
    throw new HttpError(404, 'Dashboard page was not found.');
  }
  return {
    document: draft.document,
    config: readPageConfigFromDocument(draft.document),
  };
};

export const collectDeveloperWidgetNodeIds = (document: DesignerDocument): Set<string> => {
  const ids = new Set<string>();
  for (const node of Object.values(document.nodes)) {
    const palette = node.paletteItemId
      ?? (typeof node.props?.paletteItemId === 'string' ? node.props.paletteItemId : '');
    if (
      palette
      && palette !== 'viz.dashboard-canvas'
      && (
        palette.startsWith('viz.')
        || palette === 'content.stat-trend'
        || palette === 'heroui.data-grid'
        || palette.startsWith('content.')
      )
    ) {
      ids.add(node.id);
    }
  }
  return ids;
};

const emptyHomeLayout = (): DashboardLayoutPreference => ({
  layoutMode: 'masonry',
  widgetOrder: [],
  hiddenWidgets: [],
  widgetSizes: {},
  widgetChrome: {},
  homeShortcuts: [],
  pageCanvases: {},
});

export const readCanvasPersonalization = async (
  userId: number,
  pageId: string,
  config: DashboardCanvasPageConfig,
  developerNodeIds: ReadonlySet<string>,
): Promise<DashboardCanvasPersonalization> => {
  const raw = await getMyDashboardLayout(userId);
  const layout = normalizeDashboardLayoutPayload(raw.body.layout) ?? emptyHomeLayout();
  return sanitizeCanvasPersonalization(config, layout.pageCanvases?.[pageId], developerNodeIds);
};

export const writeCanvasPersonalization = async (
  actor: ActorContext,
  userId: number,
  pageId: string,
  config: DashboardCanvasPageConfig,
  developerNodeIds: ReadonlySet<string>,
  next: unknown,
): Promise<DashboardCanvasPersonalization> => {
  const sanitized = sanitizeCanvasPersonalization(config, next, developerNodeIds);
  const raw = await getMyDashboardLayout(userId);
  const layout = normalizeDashboardLayoutPayload(raw.body.layout) ?? emptyHomeLayout();
  await updateMyDashboardLayout(actor, userId, {
    ...layout,
    pageCanvases: {
      ...(layout.pageCanvases ?? {}),
      [pageId]: sanitized,
    },
  });
  return sanitized;
};

const resolveDomainDataSource = (
  entry: DashboardCanvasPageConfig['domain'][number],
  sources: StoredDataSource[],
): StoredDataSource => {
  const ref = entry.dataSourceRef;
  const id = typeof ref === 'string'
    ? ref
    : isRecord(ref) && typeof ref.id === 'string'
      ? ref.id
      : isRecord(ref) && typeof ref.dataSourceId === 'string'
        ? ref.dataSourceId
        : '';
  const source = sources.find((item) => item.id === id);
  if (!source) {
    throw new HttpError(400, 'Domain entry data source is not configured.');
  }
  return source;
};

export const executeDashboardDomainPivot = async (input: {
  pageId: string;
  domainEntryId: string;
  spec: unknown;
  policyContextKey: string;
  settingsPath: string;
  actorUserId?: number | null;
}): Promise<Record<string, unknown>> => {
  const { config } = loadDashboardPage(input.pageId);
  const entry = config.domain.find((item) => item.id === input.domainEntryId);
  if (!entry) {
    throw new HttpError(400, 'Domain entry is not declared on this page.');
  }
  const spec = input.spec as PivotSpec;
  assertPivotSpecInDomain(config, input.domainEntryId, spec);
  const sources = getDataSourcesFromSettings(input.settingsPath);
  const dataSource = resolveDomainDataSource(entry, sources);
  const models = listEdgeModels().filter((model) => model.dataSourceId === dataSource.id);
  const published = models.find((model) => (
    isRecord(entry.dataSourceRef) && entry.dataSourceRef.edgeModelId === model.id
  )) ?? models[0];
  const definition = published
    ? listEdgeApiDefinitions().find((item) => item.edgeModelId === published.id)
    : undefined;
  const pivotOp = definition?.operations.find((operation) => operation.kind === 'pivot');

  if (definition && pivotOp) {
    const executor = new DataApiExecutor({ getDataSources: () => sources });
    return executor.execute({
      edgeApiDefinitionId: definition.id,
      operationId: pivotOp.id,
      body: spec,
      actorUserId: input.actorUserId ?? null,
      skipPublishCheck: true,
    });
  }

  return executePivot({
    spec,
    dataSource,
    policyContextKey: input.policyContextKey,
  }) as unknown as Record<string, unknown>;
};

export const listWidgetComments = async (pageId: string, widgetNodeId: string) => {
  const model = getDashboardWidgetCommentModel();
  const rows = await model.findAll({
    where: { pageId, widgetNodeId },
    order: [['created_at', 'ASC']],
  });
  return rows.map((row) => ({
    id: row.id,
    pageId: row.pageId,
    widgetNodeId: row.widgetNodeId,
    authorId: Number(row.authorId),
    body: row.body,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  }));
};

export const addWidgetComment = async (input: {
  pageId: string;
  widgetNodeId: string;
  authorId: number;
  body: string;
}) => {
  const body = input.body.trim();
  if (!body) {
    throw new HttpError(400, 'Comment body is required.');
  }
  const model = getDashboardWidgetCommentModel();
  const row = await model.create({
    pageId: input.pageId,
    widgetNodeId: input.widgetNodeId,
    authorId: input.authorId,
    body,
    createdAt: new Date(),
  });
  return {
    id: row.id,
    pageId: row.pageId,
    widgetNodeId: row.widgetNodeId,
    authorId: Number(row.authorId),
    body: row.body,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
};

export const readPageAccess = async (pageId: string) => {
  const model = getDashboardPageAccessModel();
  const row = await model.findByPk(pageId);
  if (!row) {
    return null;
  }
  let accessControl: FunctionAccessControl | null = null;
  if (row.accessControl) {
    try {
      accessControl = normalizeFunctionAccessControl(JSON.parse(row.accessControl));
    } catch {
      accessControl = null;
    }
  }
  return {
    pageId: row.pageId,
    accessControl,
    accessPermission: (row.accessPermission === 'personalize' ? 'personalize' : 'view') as DashboardAccessPermission,
    ownerUserId: Number(row.ownerUserId),
    embedAllowedOrigins: row.embedAllowedOrigins
      ? row.embedAllowedOrigins.split('\n').map((item) => item.trim()).filter(Boolean)
      : [],
  };
};

export const upsertPageAccess = async (input: {
  pageId: string;
  accessControl: FunctionAccessControl;
  accessPermission: DashboardAccessPermission;
  ownerUserId: number;
  embedAllowedOrigins?: string[];
  actorUserId: number;
}) => {
  const model = getDashboardPageAccessModel();
  const existing = await model.findByPk(input.pageId);
  const now = new Date();
  await model.upsert({
    pageId: input.pageId,
    accessControl: JSON.stringify(normalizeFunctionAccessControl(input.accessControl)),
    accessPermission: input.accessPermission,
    ownerUserId: existing ? Number(existing.ownerUserId) : input.ownerUserId,
    embedAllowedOrigins: sanitizeDashboardEmbedOrigins(input.embedAllowedOrigins ?? []).join('\n') || null,
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? input.actorUserId,
    updatedAt: now,
    updatedBy: input.actorUserId,
  });
  return readPageAccess(input.pageId);
};

export const assertDashboardPageAccess = async (input: {
  pageId: string;
  userId: number | null;
  email?: string | null;
  roles?: string[];
  isAdmin?: boolean;
  wantPersonalize?: boolean;
}): Promise<{ permission: DashboardAccessPermission; publicVisitor: boolean }> => {
  const access = await readPageAccess(input.pageId);
  if (!access?.accessControl) {
    if (!input.userId) {
      throw new HttpError(401, 'Authentication is required.');
    }
    return { permission: 'personalize', publicVisitor: false };
  }
  const allowed = canAccessManagedFunction(
    {
      isAuthenticated: Boolean(input.userId),
      isAdmin: input.isAdmin,
      userId: input.userId,
      email: input.email,
      roles: input.roles,
    },
    access.accessControl,
  );
  if (!allowed) {
    throw new HttpError(403, 'This dashboard is not shared with you.');
  }
  const publicVisitor = !input.userId && access.accessControl.accessMode === 'public';
  if (input.wantPersonalize && access.accessPermission !== 'personalize') {
    throw new HttpError(403, 'Personalization is not allowed on this shared dashboard.');
  }
  return {
    permission: access.accessPermission,
    publicVisitor,
  };
};

export const saveDashboardSnapshot = async (input: {
  pageId: string;
  createdBy: number;
  payload: unknown;
  expiresAt?: string | null;
}) => {
  const model = getDashboardSnapshotModel();
  const id = randomUUID();
  const row = await model.create({
    id,
    pageId: input.pageId,
    renderedPayload: JSON.stringify(input.payload),
    createdBy: input.createdBy,
    createdAt: new Date(),
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  });
  return {
    id: row.id,
    pageId: row.pageId,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
};

export const readDashboardSnapshot = async (id: string) => {
  const model = getDashboardSnapshotModel();
  const row = await model.findByPk(id);
  if (!row) {
    throw new HttpError(404, 'Snapshot was not found.');
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    throw new HttpError(410, 'This snapshot has expired.');
  }
  return {
    id: row.id,
    pageId: row.pageId,
    payload: JSON.parse(row.renderedPayload) as unknown,
    createdBy: Number(row.createdBy),
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
};

export { parseDashboardCanvasPersonalization, renderPivotSnapshotPdf, renderPivotSnapshotPng, renderPivotSnapshotText };
