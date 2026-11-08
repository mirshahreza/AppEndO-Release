export const buildMcpRegistryToolName = (serverId: string, toolName: string): string => (
  `mcp__${serverId}__${toolName}`
);

export const parseMcpRegistryToolName = (
  registryName: string,
): { serverId: string; toolName: string } | null => {
  const match = /^mcp__([a-z0-9][a-z0-9-]{0,62})__(.+)$/.exec(registryName);
  if (!match) return null;
  return { serverId: match[1], toolName: match[2] };
};
