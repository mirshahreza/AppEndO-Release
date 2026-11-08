import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { aiManager } from '../../../../core/ai/AiManager';
import type { AiMcpServerConfig } from '../../../../shared/api/contracts/ai/types';
import { assertStdioCommandAllowed } from './mcpPolicy';
import { createSsrfGuardedFetch, validateMcpRemoteUrl } from './mcpUrlGuard';
import { sanitizeMcpToolOutput } from './mcpOutputSanitizer';

export const MCP_CONNECT_TIMEOUT_MS = 30_000;
export const MCP_TOOL_CALL_TIMEOUT_MS = 60_000;
export const MCP_STDIO_MAX_OUTPUT_BYTES = 1_048_576;

type ActiveConnection = {
  server: AiMcpServerConfig;
  client: Client;
  transport: Transport;
  initialized: boolean;
  connectedAt: number;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const createTransport = async (server: AiMcpServerConfig): Promise<Transport> => {
  if (server.transport === 'stdio') {
    const stdioAllowlist = aiManager.getSettings()?.mcp?.stdioAllowlist ?? [];
    assertStdioCommandAllowed(server.command || '', stdioAllowlist);
    return new StdioClientTransport({
      command: server.command || '',
      args: server.args,
      env: server.env,
      stderr: 'pipe',
    });
  }

  const guardedFetch = createSsrfGuardedFetch();
  const url = await validateMcpRemoteUrl(server.url || '');

  if (server.transport === 'sse') {
    return new SSEClientTransport(url, { fetch: guardedFetch });
  }

  return new StreamableHTTPClientTransport(url, { fetch: guardedFetch });
};

export class McpConnectionManager {
  private connections = new Map<string, ActiveConnection>();

  async connect(server: AiMcpServerConfig): Promise<Client> {
    const existing = this.connections.get(server.id);
    if (existing?.initialized) {
      return existing.client;
    }

    if (existing) {
      await this.disconnect(server.id);
    }

    const transport = await createTransport(server);
    const client = new Client({ name: 'appendo-agent', version: '1.0.0' });

    await withTimeout(client.connect(transport), MCP_CONNECT_TIMEOUT_MS, 'MCP connect');

    const connection: ActiveConnection = {
      server,
      client,
      transport,
      initialized: true,
      connectedAt: Date.now(),
    };
    this.connections.set(server.id, connection);
    return client;
  }

  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    this.connections.delete(serverId);
    try {
      await connection.client.close();
    } catch {
      // ignore close errors
    }
    try {
      await connection.transport.close();
    } catch {
      // ignore close errors
    }
  }

  async disconnectAll(): Promise<void> {
    const ids = [...this.connections.keys()];
    await Promise.all(ids.map((id) => this.disconnect(id)));
  }

  getConnection(serverId: string): ActiveConnection | undefined {
    return this.connections.get(serverId);
  }

  async testConnection(server: AiMcpServerConfig): Promise<{
    message: string;
    toolCount: number;
    toolNames: string[];
    latencyMs: number;
  }> {
    const startedAt = Date.now();
    const client = await this.connect(server);
    const tools = await withTimeout(client.listTools(), MCP_CONNECT_TIMEOUT_MS, 'MCP listTools');
    const toolNames = (tools.tools ?? []).map((tool) => tool.name).filter(Boolean);
    const toolCount = toolNames.length;
    const latencyMs = Date.now() - startedAt;
    await this.disconnect(server.id);

    const previewNames = toolNames.slice(0, 8).join(', ');
    const overflow = toolNames.length > 8 ? ` (+${toolNames.length - 8} more)` : '';
    const toolsLabel = toolCount > 0 ? `: ${previewNames}${overflow}` : '';

    return {
      message: `Connected to "${server.label}" in ${latencyMs}ms (${toolCount} tool${toolCount === 1 ? '' : 's'}${toolsLabel}).`,
      toolCount,
      toolNames,
      latencyMs,
    };
  }

  async listTools(server: AiMcpServerConfig) {
    const client = await this.connect(server);
    return withTimeout(client.listTools(), MCP_CONNECT_TIMEOUT_MS, 'MCP listTools');
  }

  async callTool(
    server: AiMcpServerConfig,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const connection = this.connections.get(server.id);
    const client = connection?.initialized
      ? connection.client
      : await this.connect(server);

    if (!this.connections.get(server.id)?.initialized) {
      throw new Error(`MCP server "${server.id}" is not initialized.`);
    }

    const result = await withTimeout(
      client.callTool({ name: toolName, arguments: args }),
      MCP_TOOL_CALL_TIMEOUT_MS,
      `MCP tool "${toolName}"`,
    );

    return sanitizeMcpToolOutput(result);
  }
}

export const mcpConnectionManager = new McpConnectionManager();
