import path from 'path';
import fs from 'fs';
import { atomicWriteText } from '../../../../core/runtime/RuntimeFileStore';
import { runtimeDirs } from '../../../../core/runtime/runtimePaths';
import type {
  DesignerConnectorAuth,
  DesignerConnectorType,
  WorkspaceDataConnector,
  WorkspaceDataConnectorSummary,
} from '../../../../domain/component-designer/dataConnectorTypes';
import type { DesignerResponseMapping } from '../../../../domain/component-designer/types';
import { HttpError } from '../../../errors/HttpError';
import { designerStoragePaths, ensureDesignerStoragePaths } from '../storage';

export const designerConnectorsPaths = {
  root: path.join(designerStoragePaths.root, 'connectors'),
  index: path.join(designerStoragePaths.root, 'connectors', 'index.json'),
  files: path.join(designerStoragePaths.root, 'connectors', 'files'),
} as const;

const ensureConnectorsStorage = (): void => {
  ensureDesignerStoragePaths();
  fs.mkdirSync(designerConnectorsPaths.root, { recursive: true });
  fs.mkdirSync(designerConnectorsPaths.files, { recursive: true });
  if (!fs.existsSync(designerConnectorsPaths.index)) {
    atomicWriteText(
      designerConnectorsPaths.index,
      JSON.stringify({ schema: 'designer-connectors', schemaVersion: '1.0.0', items: [] }, null, 2),
      runtimeDirs.workspaceTemp,
    );
  }
};

type ConnectorsIndexFile = {
  schema: string;
  schemaVersion: string;
  items: WorkspaceDataConnector[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeAuth = (value: unknown): DesignerConnectorAuth | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  if (value.kind === 'none') {
    return { kind: 'none' };
  }
  if (value.kind === 'bearer' && typeof value.token === 'string' && value.token.trim()) {
    return { kind: 'bearer', token: value.token };
  }
  if (
    value.kind === 'api-key-header'
    && typeof value.headerName === 'string'
    && value.headerName.trim()
    && typeof value.token === 'string'
    && value.token.trim()
  ) {
    return { kind: 'api-key-header', headerName: value.headerName.trim(), token: value.token };
  }
  return undefined;
};

const sanitizeResponseMapping = (value: unknown): DesignerResponseMapping | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const mapping: DesignerResponseMapping = {};
  for (const key of ['dataPath', 'arrayPath', 'totalPath', 'errorPath'] as const) {
    const segment = value[key];
    if (typeof segment === 'string' && segment.trim()) {
      mapping[key] = segment.trim();
    }
  }
  return Object.keys(mapping).length > 0 ? mapping : undefined;
};

const sanitizeHeaders = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const headers: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && key.trim()) {
      headers[key.trim()] = entry;
    }
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
};

const sanitizeConnectorType = (
  value: unknown,
): Exclude<DesignerConnectorType, 'internal-api'> | null => {
  if (value === 'rest-external' || value === 'graphql' || value === 'static-file') {
    return value;
  }
  return null;
};

export const sanitizeWorkspaceDataConnector = (
  value: unknown,
  fallbackId?: string,
): WorkspaceDataConnector | null => {
  if (!isRecord(value)) {
    return null;
  }

  const connectorType = sanitizeConnectorType(value.connectorType);
  if (!connectorType) {
    return null;
  }

  const id = typeof value.id === 'string' && value.id.trim()
    ? value.id.trim()
    : (fallbackId?.trim() || '');
  if (!id) {
    return null;
  }

  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : id;
  const now = new Date().toISOString();
  const createdAt = typeof value.createdAt === 'string' && value.createdAt.trim()
    ? value.createdAt.trim()
    : now;
  const updatedAt = typeof value.updatedAt === 'string' && value.updatedAt.trim()
    ? value.updatedAt.trim()
    : now;

  return {
    id,
    name,
    connectorType,
    baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl.trim() || undefined : undefined,
    headers: sanitizeHeaders(value.headers),
    auth: sanitizeAuth(value.auth),
    defaultPath: typeof value.defaultPath === 'string' ? value.defaultPath.trim() || undefined : undefined,
    graphqlPath: typeof value.graphqlPath === 'string' ? value.graphqlPath.trim() || undefined : undefined,
    graphqlQuery: typeof value.graphqlQuery === 'string' ? value.graphqlQuery.trim() || undefined : undefined,
    staticFilePath: typeof value.staticFilePath === 'string'
      ? value.staticFilePath.trim() || undefined
      : undefined,
    staticFileFormat: value.staticFileFormat === 'csv' || value.staticFileFormat === 'json'
      ? value.staticFileFormat
      : undefined,
    responseMapping: sanitizeResponseMapping(value.responseMapping),
    createdAt,
    updatedAt,
  };
};

const readIndex = (): ConnectorsIndexFile => {
  ensureConnectorsStorage();
  try {
    const raw = fs.readFileSync(designerConnectorsPaths.index, 'utf8');
    const parsed = JSON.parse(raw) as ConnectorsIndexFile;
    if (!parsed || !Array.isArray(parsed.items)) {
      return { schema: 'designer-connectors', schemaVersion: '1.0.0', items: [] };
    }
    return {
      schema: parsed.schema || 'designer-connectors',
      schemaVersion: parsed.schemaVersion || '1.0.0',
      items: parsed.items
        .map((item) => sanitizeWorkspaceDataConnector(item))
        .filter((item): item is WorkspaceDataConnector => Boolean(item)),
    };
  } catch {
    return { schema: 'designer-connectors', schemaVersion: '1.0.0', items: [] };
  }
};

const writeIndex = (items: WorkspaceDataConnector[]): void => {
  ensureConnectorsStorage();
  atomicWriteText(
    designerConnectorsPaths.index,
    JSON.stringify({ schema: 'designer-connectors', schemaVersion: '1.0.0', items }, null, 2),
    runtimeDirs.workspaceTemp,
  );
};

export const toConnectorSummary = (
  connector: WorkspaceDataConnector,
): WorkspaceDataConnectorSummary => {
  const authKind = connector.auth?.kind ?? 'none';
  const hasAuthToken = Boolean(
    (connector.auth?.kind === 'bearer' && connector.auth.token.trim())
    || (connector.auth?.kind === 'api-key-header' && connector.auth.token.trim()),
  );

  const { auth: _auth, ...rest } = connector;
  return {
    ...rest,
    authKind,
    hasAuthToken,
  };
};

export const listWorkspaceDataConnectors = (): WorkspaceDataConnector[] => readIndex().items;

export const listWorkspaceDataConnectorSummaries = (): WorkspaceDataConnectorSummary[] =>
  listWorkspaceDataConnectors().map(toConnectorSummary);

export const getWorkspaceDataConnector = (id: string): WorkspaceDataConnector | null => {
  const key = id.trim();
  if (!key) {
    return null;
  }
  return listWorkspaceDataConnectors().find((item) => item.id === key) ?? null;
};

export const upsertWorkspaceDataConnector = (
  input: unknown,
  options: { createId?: string } = {},
): WorkspaceDataConnector => {
  const existingId = isRecord(input) && typeof input.id === 'string' ? input.id.trim() : '';
  const id = existingId || options.createId?.trim() || `conn_${Date.now().toString(36)}`;
  const existing = getWorkspaceDataConnector(id);
  const now = new Date().toISOString();

  const incoming = isRecord(input) ? { ...input } : {};
  // Preserve existing auth token when the client sends a blank token (edit form leave-blank semantics).
  if (existing?.auth && isRecord(incoming.auth)) {
    const authKind = incoming.auth.kind;
    const token = typeof incoming.auth.token === 'string' ? incoming.auth.token : '';
    if ((authKind === 'bearer' || authKind === 'api-key-header') && !token.trim()) {
      incoming.auth = existing.auth;
    }
  }

  const merged = sanitizeWorkspaceDataConnector({
    ...(existing ?? {}),
    ...incoming,
    id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }, id);

  if (!merged) {
    throw new HttpError(400, 'Invalid connector definition.');
  }

  if (merged.connectorType !== 'static-file' && !merged.baseUrl?.trim()) {
    throw new HttpError(400, 'baseUrl is required for rest-external and graphql connectors.');
  }

  const items = listWorkspaceDataConnectors().filter((item) => item.id !== merged.id);
  items.push(merged);
  items.sort((left, right) => left.name.localeCompare(right.name));
  writeIndex(items);
  return merged;
};

export const deleteWorkspaceDataConnector = (id: string): void => {
  const key = id.trim();
  if (!key) {
    throw new HttpError(400, 'Connector id is required.');
  }
  const before = listWorkspaceDataConnectors();
  const next = before.filter((item) => item.id !== key);
  if (next.length === before.length) {
    throw new HttpError(404, `Connector "${key}" was not found.`);
  }
  writeIndex(next);

  const filesDir = path.join(designerConnectorsPaths.files, key);
  if (fs.existsSync(filesDir)) {
    fs.rmSync(filesDir, { recursive: true, force: true });
  }
};

export const resolveConnectorFilesDir = (connectorId: string): string => {
  const key = connectorId.trim();
  if (!key) {
    throw new HttpError(400, 'Connector id is required.');
  }
  const dir = path.join(designerConnectorsPaths.files, key);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export const resolveSafeConnectorFilePath = (
  connectorId: string,
  relativePath: string,
): string => {
  const dir = resolveConnectorFilesDir(connectorId);
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    throw new HttpError(400, 'Invalid static file path.');
  }
  const absolute = path.resolve(dir, normalized);
  if (!absolute.startsWith(path.resolve(dir))) {
    throw new HttpError(400, 'Static file path escapes connector directory.');
  }
  return absolute;
};

export const saveConnectorStaticFile = (
  connectorId: string,
  fileName: string,
  contents: string | Buffer,
): { relativePath: string; absolutePath: string } => {
  const safeName = path.basename(fileName).replace(/[^\w.\-]+/g, '_');
  if (!safeName) {
    throw new HttpError(400, 'File name is required.');
  }
  const absolutePath = resolveSafeConnectorFilePath(connectorId, safeName);
  fs.writeFileSync(absolutePath, contents);
  return { relativePath: safeName, absolutePath };
};
