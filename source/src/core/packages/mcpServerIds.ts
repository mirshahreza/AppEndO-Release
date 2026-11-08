const MCP_SERVER_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const buildPackageMcpGlobalId = (packageId: string, localId: string): string => (
  `mcp-${packageId}-${localId}`
);

const isValidPackageMcpGlobalId = (globalId: string): boolean => (
  MCP_SERVER_SLUG_PATTERN.test(globalId)
);

export const validatePackageMcpGlobalId = (
  packageId: string,
  localId: string,
  field: string,
): string | null => {
  const globalId = buildPackageMcpGlobalId(packageId, localId);
  if (!isValidPackageMcpGlobalId(globalId)) {
    return `${field}: global MCP server id "${globalId}" must match ^[a-z0-9][a-z0-9-]{0,62}$.`;
  }
  return null;
};
