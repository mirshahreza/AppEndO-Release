import type { McpGrantResourceKind } from '../../../shared/api/contracts/ai/mcpAccess';
import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';

export type RoleMcpGrantRow = {
  id: number;
  role_name: string;
  resource_kind: McpGrantResourceKind;
  resource_id: string;
};

export const buildSelectGrantsByRoleNamesSql = (roleCount: number): string => {
  const placeholders = Array.from({ length: roleCount }, () => '?').join(', ');
  return `
    SELECT id, role_name, resource_kind, resource_id
    FROM base_role_mcp_grants
    WHERE role_name IN (${placeholders})
    ORDER BY role_name ASC, resource_kind ASC, resource_id ASC
  `;
};

export const DELETE_GRANTS_FOR_ROLE_SQL = 'DELETE FROM base_role_mcp_grants WHERE role_name = ?';

export const INSERT_ROLE_MCP_GRANT_SQL = `
  INSERT INTO base_role_mcp_grants (
    role_name, resource_kind, resource_id, created_by, updated_by
  ) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (role_name, resource_kind, resource_id) DO NOTHING
`;

const mapGrantRow = (row: {
  id: bigint;
  roleName: string;
  resourceKind: string;
  resourceId: string;
}): RoleMcpGrantRow => ({
  id: fromUserId(row.id),
  role_name: row.roleName,
  resource_kind: row.resourceKind as McpGrantResourceKind,
  resource_id: row.resourceId,
});

export async function listRoleMcpGrantRows(roleNames: readonly string[]): Promise<RoleMcpGrantRow[]> {
  if (roleNames.length === 0) {
    return [];
  }

  const rows = await prisma().baseRoleMcpGrant.findMany({
    where: { roleName: { in: [...roleNames] } },
    orderBy: [{ roleName: 'asc' }, { resourceKind: 'asc' }, { resourceId: 'asc' }],
  });
  return rows.map(mapGrantRow);
}

export async function replaceRoleMcpGrants(
  roleName: string,
  grants: Array<{ resourceKind: McpGrantResourceKind; resourceId: string }>,
  actorId: number | null,
): Promise<void> {
  const actor = actorId !== null ? toUserId(actorId) : null;
  await prisma().$transaction(async (tx) => {
    await tx.baseRoleMcpGrant.deleteMany({ where: { roleName } });
    if (grants.length === 0) return;
    await tx.baseRoleMcpGrant.createMany({
      data: grants.map((grant) => ({
        roleName,
        resourceKind: grant.resourceKind,
        resourceId: grant.resourceId,
        createdBy: actor,
        updatedBy: actor,
      })),
      skipDuplicates: true,
    });
  });
}
