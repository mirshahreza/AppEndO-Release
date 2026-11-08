import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';
import type { EdgeApiDefinition } from '../../../shared/api/contracts/data-api';
import type { ServerFunctionItem } from '../../../shared/api/contracts/server-functions/types';
import type { ConfigureFunctionApiMode } from '../components/ConfigureFunctionApiDialog';
import type { ConfigureDataApiTarget } from '../components/ConfigureDataApiDialog';
import type { DataStudioExplorerObjectRow } from '../types';
import {
  parseDataStudioObjectScopedPanelOverlay,
  resolveDataStudioActiveOverlayToken,
} from './dataStudioWorkspaceOverlay';

export const DATA_STUDIO_OVERLAY_DIALOG_SYNC_MODELS = 'dialog/sync-models';
const DATA_STUDIO_OVERLAY_DIALOG_DELETE_OBJECT_PREFIX = 'dialog/delete-object';
const DATA_STUDIO_OVERLAY_DIALOG_TRUNCATE_TABLE_PREFIX = 'dialog/truncate-table';
const DATA_STUDIO_OVERLAY_DIALOG_CONFIGURE_API_PREFIX = 'dialog/configure-api';
const DATA_STUDIO_OVERLAY_DIALOG_CONFIGURE_FUNCTION_API_PREFIX = 'dialog/configure-function-api';
const DATA_STUDIO_OVERLAY_DIALOG_DELETE_API_PREFIX = 'dialog/delete-api';

export function buildDataStudioDeleteObjectOverlayToken(
  objectKind: DataStudioExplorerObjectRow['objectKind'],
  objectName: string,
): string {
  return `${DATA_STUDIO_OVERLAY_DIALOG_DELETE_OBJECT_PREFIX}/${objectKind}/${objectName}`;
}

export function buildDataStudioTruncateTableOverlayToken(
  objectKind: DataStudioExplorerObjectRow['objectKind'],
  objectName: string,
): string {
  return `${DATA_STUDIO_OVERLAY_DIALOG_TRUNCATE_TABLE_PREFIX}/${objectKind}/${objectName}`;
}

export function buildDataStudioConfigureApiOverlayToken(target: ConfigureDataApiTarget): string {
  if (target.mode === 'create' || !target.definitionId) {
    return `${DATA_STUDIO_OVERLAY_DIALOG_CONFIGURE_API_PREFIX}/create`;
  }
  return `${DATA_STUDIO_OVERLAY_DIALOG_CONFIGURE_API_PREFIX}/${target.definitionId}`;
}

export function buildDataStudioConfigureFunctionApiOverlayToken(
  fnId: string,
  mode: ConfigureFunctionApiMode,
): string {
  return `${DATA_STUDIO_OVERLAY_DIALOG_CONFIGURE_FUNCTION_API_PREFIX}/${fnId}/${mode}`;
}

export function buildDataStudioDeleteApiOverlayToken(apiId: string): string {
  return `${DATA_STUDIO_OVERLAY_DIALOG_DELETE_API_PREFIX}/${apiId}`;
}

export function parseDataStudioDeleteObjectOverlayToken(token: string): {
  objectKind: DataStudioExplorerObjectRow['objectKind'];
  objectName: string;
} | null {
  return parseDataStudioObjectScopedPanelOverlay(token, DATA_STUDIO_OVERLAY_DIALOG_DELETE_OBJECT_PREFIX);
}

export function parseDataStudioTruncateTableOverlayToken(token: string): {
  objectKind: DataStudioExplorerObjectRow['objectKind'];
  objectName: string;
} | null {
  return parseDataStudioObjectScopedPanelOverlay(token, DATA_STUDIO_OVERLAY_DIALOG_TRUNCATE_TABLE_PREFIX);
}

export function parseDataStudioConfigureApiOverlayToken(token: string): string | 'create' | null {
  if (!token.startsWith(`${DATA_STUDIO_OVERLAY_DIALOG_CONFIGURE_API_PREFIX}/`)) {
    return null;
  }
  const rest = token.slice(`${DATA_STUDIO_OVERLAY_DIALOG_CONFIGURE_API_PREFIX}/`.length).trim();
  if (!rest) {
    return null;
  }
  return rest === 'create' ? 'create' : rest;
}

export function parseDataStudioConfigureFunctionApiOverlayToken(token: string): {
  fnId: string;
  mode: ConfigureFunctionApiMode;
} | null {
  if (!token.startsWith(`${DATA_STUDIO_OVERLAY_DIALOG_CONFIGURE_FUNCTION_API_PREFIX}/`)) {
    return null;
  }
  const rest = token.slice(`${DATA_STUDIO_OVERLAY_DIALOG_CONFIGURE_FUNCTION_API_PREFIX}/`.length);
  const slash = rest.lastIndexOf('/');
  if (slash <= 0) {
    return null;
  }
  const fnId = rest.slice(0, slash).trim();
  const mode = rest.slice(slash + 1).trim() as ConfigureFunctionApiMode;
  if (!fnId || (mode !== 'settings' && mode !== 'access' && mode !== 'hooks')) {
    return null;
  }
  return { fnId, mode };
}

export function parseDataStudioDeleteApiOverlayToken(token: string): string | null {
  const prefix = `${DATA_STUDIO_OVERLAY_DIALOG_DELETE_API_PREFIX}/`;
  if (!token.startsWith(prefix)) {
    return null;
  }
  const id = token.slice(prefix.length).trim();
  return id || null;
}

function resolveDataStudioConfirmOverlayToken(input: {
  syncModelsOpen: boolean;
  deleteApiTarget: EdgeApiDefinition | null;
  deleteObjectTarget: DataStudioExplorerObjectRow | null;
  truncateTableTarget: DataStudioExplorerObjectRow | null;
  configureApiTarget: ConfigureDataApiTarget | null;
  configureFunctionApiTarget: { fn: ServerFunctionItem; mode: ConfigureFunctionApiMode } | null;
}): string | null {
  return resolvePriorityOverlayToken([
    {
      token: input.deleteApiTarget
        ? buildDataStudioDeleteApiOverlayToken(input.deleteApiTarget.id)
        : `${DATA_STUDIO_OVERLAY_DIALOG_DELETE_API_PREFIX}/0`,
      isOpen: Boolean(input.deleteApiTarget),
      priority: 620,
    },
    {
      token: input.deleteObjectTarget
        ? buildDataStudioDeleteObjectOverlayToken(
          input.deleteObjectTarget.objectKind,
          input.deleteObjectTarget.name,
        )
        : `${DATA_STUDIO_OVERLAY_DIALOG_DELETE_OBJECT_PREFIX}/TABLE/x`,
      isOpen: Boolean(input.deleteObjectTarget),
      priority: 610,
    },
    {
      token: input.truncateTableTarget
        ? buildDataStudioTruncateTableOverlayToken(
          input.truncateTableTarget.objectKind,
          input.truncateTableTarget.name,
        )
        : `${DATA_STUDIO_OVERLAY_DIALOG_TRUNCATE_TABLE_PREFIX}/TABLE/x`,
      isOpen: Boolean(input.truncateTableTarget),
      priority: 600,
    },
    {
      token: input.configureApiTarget
        ? buildDataStudioConfigureApiOverlayToken(input.configureApiTarget)
        : `${DATA_STUDIO_OVERLAY_DIALOG_CONFIGURE_API_PREFIX}/0`,
      isOpen: Boolean(input.configureApiTarget),
      priority: 590,
    },
    {
      token: input.configureFunctionApiTarget
        ? buildDataStudioConfigureFunctionApiOverlayToken(
          input.configureFunctionApiTarget.fn.id,
          input.configureFunctionApiTarget.mode,
        )
        : `${DATA_STUDIO_OVERLAY_DIALOG_CONFIGURE_FUNCTION_API_PREFIX}/0/settings`,
      isOpen: Boolean(input.configureFunctionApiTarget),
      priority: 580,
    },
    {
      token: DATA_STUDIO_OVERLAY_DIALOG_SYNC_MODELS,
      isOpen: input.syncModelsOpen,
      priority: 570,
    },
  ]);
}

export function resolveDataStudioWorkspaceOverlayToken(input: Parameters<typeof resolveDataStudioActiveOverlayToken>[0] & {
  syncModelsOpen: boolean;
  deleteApiTarget: EdgeApiDefinition | null;
  deleteObjectTarget: DataStudioExplorerObjectRow | null;
  truncateTableTarget: DataStudioExplorerObjectRow | null;
  configureApiTarget: ConfigureDataApiTarget | null;
  configureFunctionApiTarget: { fn: ServerFunctionItem; mode: ConfigureFunctionApiMode } | null;
}): string | null {
  const confirm = resolveDataStudioConfirmOverlayToken(input);
  if (confirm) {
    return confirm;
  }
  return resolveDataStudioActiveOverlayToken(input);
}
