import type { PrismaClient } from '@prisma/client';
import { getPrismaControlPlane } from '../../db/prismaControlPlane';
import { expandSubtreeIds } from './subtreeExpand';
import { getScopeDimension, listScopeDimensions } from './scopeDimensionStore';

export type ScopeDimensionSnapshot = {
  ids: string[];
  mode: 'exact' | 'subtree';
};

/**
 * Resolve user + role↔node memberships into expanded dimension id sets.
 * Projected into serverContext as `scope.<dimensionKey>` (Record Policy value source).
 */
export async function resolveScopeDimensionSnapshots(
  userId: number,
  prisma?: PrismaClient,
): Promise<Record<string, ScopeDimensionSnapshot>> {
  const client = prisma ?? getPrismaControlPlane();
  const memberships = await client.baseScopeMembership.findMany({
    where: { userId: BigInt(userId) },
  });

  const userRoles = await client.baseUserRole.findMany({
    where: { userId: BigInt(userId) },
    select: { roleName: true },
  });
  const roleNames = userRoles.map((row) => row.roleName);
  const roleMemberships = roleNames.length === 0
    ? []
    : await client.baseScopeRoleMembership.findMany({
      where: { roleName: { in: roleNames } },
      select: { dimensionKey: true, nodeId: true },
    });

  const dimensions = listScopeDimensions().filter((dimension) => dimension.enabled);
  const dimensionByKey = new Map(dimensions.map((dimension) => [dimension.key, dimension]));

  const byDimension = new Map<string, string[]>();
  for (const row of memberships) {
    const list = byDimension.get(row.dimensionKey) ?? [];
    list.push(row.nodeId);
    byDimension.set(row.dimensionKey, list);
  }
  for (const row of roleMemberships) {
    const list = byDimension.get(row.dimensionKey) ?? [];
    list.push(row.nodeId);
    byDimension.set(row.dimensionKey, list);
  }

  const scope: Record<string, ScopeDimensionSnapshot> = {};
  for (const [dimensionKey, nodeIds] of byDimension.entries()) {
    const def = dimensionByKey.get(dimensionKey) ?? getScopeDimension(dimensionKey);
    if (def?.topology === 'tree') {
      const ids = await expandSubtreeIds(client, nodeIds);
      scope[dimensionKey] = { ids, mode: 'subtree' };
    } else {
      scope[dimensionKey] = { ids: [...new Set(nodeIds)], mode: 'exact' };
    }
  }

  for (const dimension of dimensions) {
    if (!scope[dimension.key]) {
      scope[dimension.key] = {
        ids: [],
        mode: dimension.topology === 'tree' ? 'subtree' : 'exact',
      };
    }
  }

  return scope;
}
