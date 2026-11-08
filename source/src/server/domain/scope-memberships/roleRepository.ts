import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';

export type ScopeRoleMembershipRow = {
  id: number;
  roleName: string;
  dimensionKey: string;
  nodeId: string;
};

export type ScopeRoleMembershipEventRow = {
  id: number;
  dimensionKey: string;
  nodeId: string;
  roleName: string;
  eventType: string;
  actorUserId: number | null;
  createdAt: string | null;
  actorDisplayName: string | null;
};

const toDisplayName = (
  username: string,
  firstname: string | null | undefined,
  lastname: string | null | undefined,
): string => {
  const full = [firstname, lastname].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
  return full || username;
};

export async function listScopeRoleMembershipsByNode(dimensionKey: string, nodeId: string) {
  const rows = await prisma().baseScopeRoleMembership.findMany({
    where: { dimensionKey, nodeId },
    orderBy: [{ roleName: 'asc' }, { id: 'asc' }],
  });
  return rows.map((row): ScopeRoleMembershipRow => ({
    id: fromUserId(row.id),
    roleName: row.roleName,
    dimensionKey: row.dimensionKey,
    nodeId: row.nodeId,
  }));
}

export async function findScopeRoleMembershipById(id: number) {
  const row = await prisma().baseScopeRoleMembership.findUnique({
    where: { id: toUserId(id) },
  });
  if (!row) return null;
  return {
    id: fromUserId(row.id),
    roleName: row.roleName,
    dimensionKey: row.dimensionKey,
    nodeId: row.nodeId,
  } satisfies ScopeRoleMembershipRow;
}

export async function findScopeRoleMembershipUnique(
  roleName: string,
  dimensionKey: string,
  nodeId: string,
) {
  const row = await prisma().baseScopeRoleMembership.findUnique({
    where: {
      roleName_dimensionKey_nodeId: {
        roleName,
        dimensionKey,
        nodeId,
      },
    },
  });
  if (!row) return null;
  return {
    id: fromUserId(row.id),
    roleName: row.roleName,
    dimensionKey: row.dimensionKey,
    nodeId: row.nodeId,
  } satisfies ScopeRoleMembershipRow;
}

export async function createScopeRoleMembership(input: {
  roleName: string;
  dimensionKey: string;
  nodeId: string;
  actorId: number | null;
}) {
  const row = await prisma().baseScopeRoleMembership.create({
    data: {
      roleName: input.roleName,
      dimensionKey: input.dimensionKey,
      nodeId: input.nodeId,
      createdBy: input.actorId !== null ? toUserId(input.actorId) : null,
      updatedBy: input.actorId !== null ? toUserId(input.actorId) : null,
    },
  });
  return {
    id: fromUserId(row.id),
    roleName: row.roleName,
    dimensionKey: row.dimensionKey,
    nodeId: row.nodeId,
  } satisfies ScopeRoleMembershipRow;
}

export async function deleteScopeRoleMembership(id: number) {
  await prisma().baseScopeRoleMembership.delete({ where: { id: toUserId(id) } });
}

export async function deleteScopeRoleMembershipsByNodeId(nodeId: string) {
  await prisma().baseScopeRoleMembership.deleteMany({ where: { nodeId } });
}

export async function roleExists(roleName: string) {
  const row = await prisma().baseRole.findUnique({
    where: { name: roleName },
    select: { name: true },
  });
  return Boolean(row);
}

export async function listUserIdsForRole(roleName: string): Promise<number[]> {
  const rows = await prisma().baseUserRole.findMany({
    where: { roleName },
    select: { userId: true },
  });
  return rows.map((row) => fromUserId(row.userId));
}

export async function listScopeRoleMembershipsForRoles(roleNames: string[]) {
  if (roleNames.length === 0) return [];
  return prisma().baseScopeRoleMembership.findMany({
    where: { roleName: { in: roleNames } },
    select: { dimensionKey: true, nodeId: true, roleName: true },
  });
}

export async function createScopeRoleMembershipEvent(input: {
  dimensionKey: string;
  nodeId: string;
  roleName: string;
  eventType: string;
  actorUserId: number | null;
}) {
  await prisma().baseScopeRoleMembershipEvent.create({
    data: {
      dimensionKey: input.dimensionKey,
      nodeId: input.nodeId,
      roleName: input.roleName,
      eventType: input.eventType,
      actorUserId: input.actorUserId !== null ? toUserId(input.actorUserId) : null,
    },
  });
}

export async function listScopeRoleMembershipEventsByNode(
  dimensionKey: string,
  nodeId: string,
  limit = 50,
) {
  const rows = await prisma().baseScopeRoleMembershipEvent.findMany({
    where: { dimensionKey, nodeId },
    include: {
      actor: {
        select: {
          username: true,
          profile: { select: { firstname: true, lastname: true } },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: Math.min(200, Math.max(1, limit)),
  });

  return rows.map((row): ScopeRoleMembershipEventRow => {
    const actorFirst = row.actor?.profile?.firstname ?? null;
    const actorLast = row.actor?.profile?.lastname ?? null;
    return {
      id: fromUserId(row.id),
      dimensionKey: row.dimensionKey,
      nodeId: row.nodeId,
      roleName: row.roleName,
      eventType: row.eventType,
      actorUserId: row.actorUserId != null ? fromUserId(row.actorUserId) : null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      actorDisplayName: row.actor
        ? toDisplayName(row.actor.username, actorFirst, actorLast)
        : null,
    };
  });
}
