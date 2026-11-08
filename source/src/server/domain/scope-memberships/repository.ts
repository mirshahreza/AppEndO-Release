import { resolveUserAvatarXsSrc } from '../../../shared/api/contracts/users/avatar';
import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';

export type ScopeMembershipRow = {
  id: number;
  userId: number;
  dimensionKey: string;
  nodeId: string;
  username: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

const toDisplayName = (
  username: string,
  firstname: string | null | undefined,
  lastname: string | null | undefined,
): string => {
  const full = [firstname, lastname].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
  return full || username;
};

const mapRow = (row: {
  id: bigint;
  userId: bigint;
  dimensionKey: string;
  nodeId: string;
  user: {
    username: string;
    email: string | null;
    profile: {
      firstname: string | null;
      lastname: string | null;
      profileImageMime: string | null;
      profileImageSize: number | null;
      updatedAt: Date | null;
    } | null;
  };
}): ScopeMembershipRow => {
  const userId = fromUserId(row.userId);
  const firstname = row.user.profile?.firstname ?? null;
  const lastname = row.user.profile?.lastname ?? null;
  const username = row.user.username;
  const mime = row.user.profile?.profileImageMime ?? null;
  return {
    id: fromUserId(row.id),
    userId,
    dimensionKey: row.dimensionKey,
    nodeId: row.nodeId,
    username,
    firstname,
    lastname,
    email: row.user.email,
    displayName: toDisplayName(username, firstname, lastname),
    avatarUrl: resolveUserAvatarXsSrc({
      id: userId,
      has_profile_image_xs: Boolean(mime?.trim()),
      profile_image_size: row.user.profile?.profileImageSize ?? null,
      profile_updated_at: row.user.profile?.updatedAt?.toISOString() ?? null,
    }),
  };
};

const membershipInclude = {
  user: {
    select: {
      username: true,
      email: true,
      profile: {
        select: {
          firstname: true,
          lastname: true,
          profileImageMime: true,
          profileImageSize: true,
          updatedAt: true,
        },
      },
    },
  },
} as const;

export async function listScopeMembershipsByNode(dimensionKey: string, nodeId: string) {
  const rows = await prisma().baseScopeMembership.findMany({
    where: { dimensionKey, nodeId },
    include: membershipInclude,
    orderBy: [{ id: 'asc' }],
  });
  return rows.map(mapRow);
}

export async function listScopeMembershipsByDimension(dimensionKey: string) {
  const rows = await prisma().baseScopeMembership.findMany({
    where: { dimensionKey },
    include: membershipInclude,
    orderBy: [{ nodeId: 'asc' }, { id: 'asc' }],
  });
  return rows.map(mapRow);
}

export async function listScopeMembershipsByUser(dimensionKey: string, userId: number) {
  const rows = await prisma().baseScopeMembership.findMany({
    where: { dimensionKey, userId: toUserId(userId) },
    include: membershipInclude,
    orderBy: [{ nodeId: 'asc' }, { id: 'asc' }],
  });
  return rows.map(mapRow);
}

export async function findScopeMembershipById(id: number) {
  const row = await prisma().baseScopeMembership.findUnique({
    where: { id: toUserId(id) },
    include: membershipInclude,
  });
  return row ? mapRow(row) : null;
}

export async function findScopeMembershipUnique(
  userId: number,
  dimensionKey: string,
  nodeId: string,
) {
  const row = await prisma().baseScopeMembership.findUnique({
    where: {
      userId_dimensionKey_nodeId: {
        userId: toUserId(userId),
        dimensionKey,
        nodeId,
      },
    },
    include: membershipInclude,
  });
  return row ? mapRow(row) : null;
}

export async function createScopeMembership(input: {
  userId: number;
  dimensionKey: string;
  nodeId: string;
  actorId: number | null;
}) {
  const row = await prisma().baseScopeMembership.create({
    data: {
      userId: toUserId(input.userId),
      dimensionKey: input.dimensionKey,
      nodeId: input.nodeId,
      createdBy: input.actorId !== null ? toUserId(input.actorId) : null,
      updatedBy: input.actorId !== null ? toUserId(input.actorId) : null,
    },
    include: membershipInclude,
  });
  return mapRow(row);
}

export async function deleteScopeMembership(id: number) {
  await prisma().baseScopeMembership.delete({ where: { id: toUserId(id) } });
}

export async function deleteScopeMembershipsByNodeId(nodeId: string) {
  await prisma().baseScopeMembership.deleteMany({ where: { nodeId } });
}

export type ScopeMembershipEventRow = {
  id: number;
  dimensionKey: string;
  nodeId: string;
  userId: number;
  eventType: string;
  actorUserId: number | null;
  createdAt: string | null;
  displayName: string;
  actorDisplayName: string | null;
};

const eventUserSelect = {
  username: true,
  profile: {
    select: {
      firstname: true,
      lastname: true,
    },
  },
} as const;

export async function createScopeMembershipEvent(input: {
  dimensionKey: string;
  nodeId: string;
  userId: number;
  eventType: string;
  actorUserId: number | null;
}) {
  await prisma().baseScopeMembershipEvent.create({
    data: {
      dimensionKey: input.dimensionKey,
      nodeId: input.nodeId,
      userId: toUserId(input.userId),
      eventType: input.eventType,
      actorUserId: input.actorUserId !== null ? toUserId(input.actorUserId) : null,
    },
  });
}

export async function listScopeMembershipEventsByNode(
  dimensionKey: string,
  nodeId: string,
  limit = 50,
) {
  const rows = await prisma().baseScopeMembershipEvent.findMany({
    where: { dimensionKey, nodeId },
    include: {
      user: { select: eventUserSelect },
      actor: { select: eventUserSelect },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: Math.min(200, Math.max(1, limit)),
  });

  return rows.map((row): ScopeMembershipEventRow => {
    const firstname = row.user.profile?.firstname ?? null;
    const lastname = row.user.profile?.lastname ?? null;
    const actorFirst = row.actor?.profile?.firstname ?? null;
    const actorLast = row.actor?.profile?.lastname ?? null;
    return {
      id: fromUserId(row.id),
      dimensionKey: row.dimensionKey,
      nodeId: row.nodeId,
      userId: fromUserId(row.userId),
      eventType: row.eventType,
      actorUserId: row.actorUserId != null ? fromUserId(row.actorUserId) : null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      displayName: toDisplayName(row.user.username, firstname, lastname),
      actorDisplayName: row.actor
        ? toDisplayName(row.actor.username, actorFirst, actorLast)
        : null,
    };
  });
}

export async function userExists(userId: number) {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: { id: true },
  });
  return Boolean(row);
}
