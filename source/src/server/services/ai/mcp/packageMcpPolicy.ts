import type { PackageManifest } from '../../../../core/packages/PackageManifestValidator';
import { aiManager } from '../../../../core/ai/AiManager';
import { assertStdioCommandAllowed } from './mcpPolicy';
import { validateMcpRemoteUrlHostname } from './mcpUrlGuard';
import { manifestMcpServerToConfig } from './packageMcpRegistry';

export const validatePluginMcpServersAtInstall = (
  packageId: string,
  manifest: PackageManifest,
): string | null => {
  const allowlist = aiManager.getSettings()?.mcp?.stdioAllowlist ?? [];
  for (const server of manifest.capabilities.mcp_servers) {
    const config = manifestMcpServerToConfig(packageId, server);
    try {
      if (config.transport === 'stdio') {
        assertStdioCommandAllowed(config.command || '', allowlist);
      } else {
        validateMcpRemoteUrlHostname(config.url || '');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Plugin MCP server "${config.id}": ${message}`;
    }
  }
  return null;
};
