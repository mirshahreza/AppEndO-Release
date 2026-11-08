import {
  AGENT_CAPABILITY_UI_PACKS,
  type AiCapabilityPackId,
} from '../../../../shared/api/contracts/ai/capabilityPacks';
import {
  INBOUND_MCP_HOST_ROW_ID,
  type McpGridBuildInput,
  type McpGridRow,
} from './mcpGridTypes';

export { INBOUND_MCP_HOST_ROW_ID };
export type { McpGridRow };

const isBuiltinPackEnabled = (
  packId: AiCapabilityPackId,
  input: McpGridBuildInput,
): boolean => {
  if (packId === 'appendo-web') {
    return input.webSearchProvider !== 'disabled';
  }
  if (packId === 'appendo-http') {
    return true;
  }
  return input.defaultPackIds.includes(packId);
};

export const buildMcpGridRows = (input: McpGridBuildInput): McpGridRow[] => {
  const builtinRows: McpGridRow[] = AGENT_CAPABILITY_UI_PACKS.map((pack) => ({
    id: pack.id,
    kind: 'builtin-pack',
    label: pack.label,
    subtitle: pack.id,
    sourceLabel: 'Built-in',
    packId: pack.id,
    pack,
    enabled: isBuiltinPackEnabled(pack.id, input),
    toolSummary: `${pack.toolNames.length} tool${pack.toolNames.length === 1 ? '' : 's'}`,
    hasWriteTools: pack.hasWriteTools,
  }));

  const inboundRow: McpGridRow = {
    id: INBOUND_MCP_HOST_ROW_ID,
    kind: 'inbound-host',
    label: 'Inbound MCP Host',
    subtitle: 'GET/POST /api/mcp',
    sourceLabel: 'Inbound',
    enabled: input.inboundHostEnabled,
    toolSummary: 'External MCP clients',
  };

  const externalRows: McpGridRow[] = input.servers.map((server) => ({
    id: server.id,
    kind: 'external-server',
    label: server.label,
    subtitle: server.managedByPlugin && server.sourcePluginId
      ? `${server.id} · package ${server.sourcePluginId}`
      : server.id,
    sourceLabel: server.managedByPlugin ? 'Package' : 'External',
    server,
    enabled: server.enabled,
    toolSummary: server.allowedTools && server.allowedTools.length > 0
      ? server.allowedTools.join(', ')
      : 'All tools',
    transport: server.transport,
  }));

  return [...builtinRows, inboundRow, ...externalRows];
};

export const filterMcpGridRows = (rows: McpGridRow[], query: string): McpGridRow[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;

  return rows.filter((row) => (
    row.label.toLowerCase().includes(normalized)
    || row.subtitle.toLowerCase().includes(normalized)
    || row.sourceLabel.toLowerCase().includes(normalized)
    || row.toolSummary.toLowerCase().includes(normalized)
    || (row.transport?.toLowerCase().includes(normalized) ?? false)
  ));
};

// Re-export build input type for consumers
export type { McpGridBuildInput };
