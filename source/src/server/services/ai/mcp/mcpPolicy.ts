import { AiValidationError } from '../../../../shared/api/contracts/ai/errors';
import type { AiMcpServerConfig } from '../../../../shared/api/contracts/ai/types';
import { validateMcpRemoteUrl } from './mcpUrlGuard';

const commandBasename = (command: string): string => {
  const trimmed = command.trim();
  const segments = trimmed.split(/[/\\]/);
  return segments[segments.length - 1] || trimmed;
};

export const isStdioCommandAllowed = (command: string, allowlist: string[]): boolean => {
  const normalized = command.trim();
  if (!normalized) return false;
  if (allowlist.length === 0) return false;

  const basename = commandBasename(normalized);
  return allowlist.some((entry) => {
    const allowed = entry.trim();
    if (!allowed) return false;
    return allowed === normalized || allowed === basename;
  });
};

export const assertStdioCommandAllowed = (command: string, allowlist: string[]): void => {
  if (isStdioCommandAllowed(command, allowlist)) return;
  if (allowlist.length === 0) {
    throw new Error('Stdio MCP servers are disabled until ai.mcp.stdioAllowlist is configured.');
  }
  throw new Error(`Stdio command "${command.trim()}" is not in ai.mcp.stdioAllowlist.`);
};

export const validateMcpServerPolicyAtSave = async (
  server: AiMcpServerConfig,
  stdioAllowlist: string[],
): Promise<void> => {
  if (server.transport === 'stdio') {
    if (!isStdioCommandAllowed(server.command || '', stdioAllowlist)) {
      if (stdioAllowlist.length === 0) {
        throw new AiValidationError(
          `MCP server "${server.id}" uses stdio transport but ai.mcp.stdioAllowlist is empty.`,
        );
      }
      throw new AiValidationError(
        `MCP server "${server.id}" command "${server.command}" is not allowed by ai.mcp.stdioAllowlist.`,
      );
    }
    return;
  }

  if (server.transport === 'sse' || server.transport === 'http') {
    try {
      await validateMcpRemoteUrl(server.url || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AiValidationError(`MCP server "${server.id}" URL rejected: ${message}`);
    }
  }
};
