import type { FunctionAccessControl } from '../../../../shared/api/contracts/server-functions/accessControl';
import {
  AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
  parseFunctionAccessControl,
} from '../../../../shared/api/contracts/server-functions/accessControl';
import type { McpGrantResourceKind } from '../../../../shared/api/contracts/ai/mcpAccess';
import type { McpGridRow } from './buildMcpGridRows';
import type { McpResourceAccessTarget } from './McpResourceAccessModal';

export const resolveMcpGridRowAccessControl = (
  row: McpGridRow,
  resourceAccessControl?: Record<string, FunctionAccessControl>,
): FunctionAccessControl => {
  if (row.kind === 'external-server' && row.server?.accessControl) {
    return parseFunctionAccessControl(row.server.accessControl);
  }

  const resourceId = row.kind === 'builtin-pack'
    ? row.packId
    : row.server?.id;

  if (resourceId && resourceAccessControl?.[resourceId]) {
    return parseFunctionAccessControl(resourceAccessControl[resourceId]);
  }

  return AUTHENTICATED_FUNCTION_ACCESS_CONTROL;
};

export const buildMcpResourceAccessTarget = (
  row: McpGridRow,
  resourceAccessControl?: Record<string, FunctionAccessControl>,
): McpResourceAccessTarget | null => {
  if (row.kind === 'inbound-host') {
    return null;
  }

  if (row.kind === 'builtin-pack' && row.packId) {
    return {
      resourceId: row.packId,
      resourceKind: 'builtin_pack',
      label: row.label,
      accessControl: resolveMcpGridRowAccessControl(row, resourceAccessControl),
    };
  }

  if (row.kind === 'external-server' && row.server) {
    return {
      resourceId: row.server.id,
      resourceKind: row.server.managedByPlugin ? 'plugin_mcp' : 'external_mcp',
      label: row.label,
      accessControl: resolveMcpGridRowAccessControl(row, resourceAccessControl),
    };
  }

  return null;
};

export const canConfigureMcpGridRowAccess = (row: McpGridRow): boolean => (
  row.kind === 'builtin-pack' || row.kind === 'external-server'
);

export type { McpGrantResourceKind };
