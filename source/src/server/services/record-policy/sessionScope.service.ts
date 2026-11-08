import type { PrismaClient } from '@prisma/client';
import { getPrismaControlPlane } from '../../db/prismaControlPlane';
import {
  isPresetScopeDimensionKey,
  PRESET_SCOPE_CONTEXT_KEYS,
  scopeContextKey,
} from '../../../shared/api/contracts/record-policy';
import { invalidateSessionContext } from '../attributes/sessionContextCache';
import {
  resolveScopeDimensionSnapshots,
  type ScopeDimensionSnapshot,
} from './resolveScopeMemberships';
import { listScopeDimensions } from './scopeDimensionStore';

export type { ScopeDimensionSnapshot };

export type SessionScopeSnapshot = {
  userId: number;
  email?: string | null;
  roles: string[];
  isAdmin: boolean;
  /** Full server session context — sole value source for Record Policy refs. */
  serverContext: Record<string, unknown>;
  /** Convenience projection of `user.*` keys (Explain / legacy helpers). */
  userAttrs: Record<string, unknown>;
  /** Convenience projection of `scope.*` keys (Explain panel). */
  scope: Record<string, ScopeDimensionSnapshot>;
  /** Stable fingerprint for cache keys (D8). */
  scopeHash: string;
};

const hashScope = (scope: Record<string, ScopeDimensionSnapshot>): string => {
  const keys = Object.keys(scope).sort();
  const payload = keys.map((key) => {
    const entry = scope[key];
    return `${key}:${entry.mode}:${[...entry.ids].sort().join(',')}`;
  }).join('|');
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(i);
    hash |= 0;
  }
  return `s${(hash >>> 0).toString(16)}`;
};

const readUserAttrsFromServerContext = (
  serverContext: Record<string, unknown>,
): Record<string, unknown> => {
  const attrs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(serverContext)) {
    if (key.startsWith('user.')) {
      attrs[key.slice('user.'.length)] = value;
    }
  }
  return attrs;
};

const readScopeFromServerContext = (
  serverContext: Record<string, unknown>,
): Record<string, ScopeDimensionSnapshot> => {
  const dimensions = listScopeDimensions().filter((dimension) => dimension.enabled);
  const scope: Record<string, ScopeDimensionSnapshot> = {};
  for (const dimension of dimensions) {
    const key = scopeContextKey(dimension.key);
    const raw = serverContext[key];
    const ids = Array.isArray(raw)
      ? raw.map((item) => String(item)).filter(Boolean)
      : [];
    scope[dimension.key] = {
      ids,
      mode: dimension.topology === 'tree' ? 'subtree' : 'exact',
    };
  }
  return scope;
};

/** True when built-in scope keys are present on serverContext (empty arrays count). */
export const serverContextHasRecordScopeKeys = (
  serverContext: Record<string, unknown> | null | undefined,
): boolean => {
  if (!serverContext || typeof serverContext !== 'object') return false;
  return (Object.keys(PRESET_SCOPE_CONTEXT_KEYS) as Array<keyof typeof PRESET_SCOPE_CONTEXT_KEYS>)
    .every((preset) => Object.prototype.hasOwnProperty.call(
      serverContext,
      PRESET_SCOPE_CONTEXT_KEYS[preset],
    ));
};

export type ResolveSessionScopeInput = {
  userId: number;
  roles: string[];
  isAdmin?: boolean;
  email?: string | null;
  /** serverContext map from sessionContext.service (includes scope.*). */
  serverContext?: Record<string, unknown>;
  prisma?: PrismaClient;
};

/**
 * Adapt auth + serverContext into the snapshot used by the policy compiler.
 * Scope memberships are expected to already live on serverContext (`scope.*`).
 * If missing (stale cache), recomputes once for this request.
 */
export async function resolveSessionScope(
  input: ResolveSessionScopeInput,
): Promise<SessionScopeSnapshot> {
  const prisma = input.prisma ?? getPrismaControlPlane();
  let serverContext: Record<string, unknown> = { ...(input.serverContext ?? {}) };

  if (!serverContextHasRecordScopeKeys(serverContext)) {
    const snapshots = await resolveScopeDimensionSnapshots(input.userId, prisma);
    for (const [dimensionKey, entry] of Object.entries(snapshots)) {
      serverContext[scopeContextKey(dimensionKey)] = entry.ids;
    }
    for (const preset of Object.keys(PRESET_SCOPE_CONTEXT_KEYS)) {
      if (!isPresetScopeDimensionKey(preset)) continue;
      const key = PRESET_SCOPE_CONTEXT_KEYS[preset];
      if (!Object.prototype.hasOwnProperty.call(serverContext, key)) {
        serverContext[key] = [];
      }
    }
  }

  const scope = readScopeFromServerContext(serverContext);

  return {
    userId: input.userId,
    email: input.email ?? null,
    roles: input.roles,
    isAdmin: Boolean(input.isAdmin),
    serverContext,
    userAttrs: readUserAttrsFromServerContext(serverContext),
    scope,
    scopeHash: hashScope(scope),
  };
}

export async function listMembershipsForUser(userId: number, prisma?: PrismaClient) {
  const client = prisma ?? getPrismaControlPlane();
  return client.baseScopeMembership.findMany({
    where: { userId: BigInt(userId) },
    orderBy: [{ dimensionKey: 'asc' }, { nodeId: 'asc' }],
  });
}

export async function assignScopeMembership(input: {
  userId: number;
  dimensionKey: string;
  nodeId: string;
  actorUserId?: number | null;
  prisma?: PrismaClient;
}) {
  const prisma = input.prisma ?? getPrismaControlPlane();
  const row = await prisma.baseScopeMembership.upsert({
    where: {
      userId_dimensionKey_nodeId: {
        userId: BigInt(input.userId),
        dimensionKey: input.dimensionKey,
        nodeId: input.nodeId,
      },
    },
    create: {
      userId: BigInt(input.userId),
      dimensionKey: input.dimensionKey,
      nodeId: input.nodeId,
      createdBy: input.actorUserId != null ? BigInt(input.actorUserId) : null,
      updatedBy: input.actorUserId != null ? BigInt(input.actorUserId) : null,
    },
    update: {
      updatedBy: input.actorUserId != null ? BigInt(input.actorUserId) : null,
    },
  });
  await prisma.baseScopeMembershipEvent.create({
    data: {
      userId: BigInt(input.userId),
      dimensionKey: input.dimensionKey,
      nodeId: input.nodeId,
      eventType: 'assign',
      actorUserId: input.actorUserId != null ? BigInt(input.actorUserId) : null,
    },
  });
  await invalidateSessionContext(input.userId);
  const { emitUserScopeDiff } = await import('../../domain/record-events/userHistory');
  await emitUserScopeDiff({
    userId: input.userId,
    dimensionKey: input.dimensionKey,
    nodeId: input.nodeId,
    added: true,
  });
  return row;
}

export async function removeScopeMembership(input: {
  userId: number;
  dimensionKey: string;
  nodeId: string;
  actorUserId?: number | null;
  prisma?: PrismaClient;
}) {
  const prisma = input.prisma ?? getPrismaControlPlane();
  const deleted = await prisma.baseScopeMembership.deleteMany({
    where: {
      userId: BigInt(input.userId),
      dimensionKey: input.dimensionKey,
      nodeId: input.nodeId,
    },
  });
  if (deleted.count > 0) {
    await prisma.baseScopeMembershipEvent.create({
      data: {
        userId: BigInt(input.userId),
        dimensionKey: input.dimensionKey,
        nodeId: input.nodeId,
        eventType: 'remove',
        actorUserId: input.actorUserId != null ? BigInt(input.actorUserId) : null,
      },
    });
    await invalidateSessionContext(input.userId);
    const { emitUserScopeDiff } = await import('../../domain/record-events/userHistory');
    await emitUserScopeDiff({
      userId: input.userId,
      dimensionKey: input.dimensionKey,
      nodeId: input.nodeId,
      added: false,
    });
  }
  return deleted.count > 0;
}
