import {
  AiChatHistoryValidationError,
  normalizeCreatePayload,
  normalizeUpdatePayload,
} from '../../../shared/api/contracts/ai/chatHistoryValidators';
import type {
  AiChatSessionCreatePayload,
  AiChatSessionDetail,
  AiChatSessionSummary,
  AiChatSessionUpdatePayload,
} from '../../../shared/api/contracts/ai/chatHistoryTypes';
import type { ChatSessionListQuery } from '../../../shared/api/contracts/ai/chatHistoryListQuery';
import type { AiAgentCapabilityScope } from '../../../shared/api/contracts/ai/capabilityPacks';
import type { ActorContext } from '../../types/requestContext';
import { HttpError } from '../../errors/HttpError';
import { actorId } from '../users/shared';
import {
  createChatSession,
  deleteChatSession,
  deleteChatSessionById,
  findChatSessionById,
  findChatSessionForUser,
  listAllChatSessions,
  listChatSessionsForUser,
  updateChatSession,
} from '../../domain/ai/chatHistoryRepository';
import {
  clampSessionAgentCapabilityScope,
  resolveDefaultAgentCapabilityScope,
  resolveEffectiveMcpAccessForUser,
} from './mcpAccess.service';
import { aiManager } from '../../../core/ai/AiManager';

const resolveMcpAccessOptions = () => {
  const settings = aiManager.getSettings();
  return { settingsMcpServers: settings?.mcpServers ?? [] };
};

const clampSessionDetailForActor = async (
  session: AiChatSessionDetail,
  actor: ActorContext,
): Promise<AiChatSessionDetail> => ({
  ...session,
  agentCapabilityScope: await clampSessionAgentCapabilityScope(
    actor.userId,
    session.agentCapabilityScope,
    { fallbackRole: actor.role, ...resolveMcpAccessOptions() },
  ),
});

const clampSessionDetailForUser = async (
  session: AiChatSessionDetail,
  userId: number,
): Promise<AiChatSessionDetail> => ({
  ...session,
  agentCapabilityScope: await clampSessionAgentCapabilityScope(
    userId,
    session.agentCapabilityScope,
    resolveMcpAccessOptions(),
  ),
});

const clampSessionSummaryForActor = async (
  session: AiChatSessionSummary,
  actor: ActorContext,
): Promise<AiChatSessionSummary> => ({
  ...session,
  agentCapabilityScope: await clampSessionAgentCapabilityScope(
    actor.userId,
    session.agentCapabilityScope,
    { fallbackRole: actor.role, ...resolveMcpAccessOptions() },
  ),
});

const resolveInitialAgentCapabilityScope = async (
  actor: ActorContext,
  requested?: AiAgentCapabilityScope,
) => {
  const access = await resolveEffectiveMcpAccessForUser(actor.userId, {
    fallbackRole: actor.role,
    ...resolveMcpAccessOptions(),
  });
  if (requested) {
    return clampSessionAgentCapabilityScope(actor.userId, requested, {
      fallbackRole: actor.role,
      ...resolveMcpAccessOptions(),
    });
  }
  return resolveDefaultAgentCapabilityScope(access);
};

export class AiChatHistoryService {
  async listSessions(actor: ActorContext) {
    const userId = Number(actor.userId || 0);
    if (!userId) {
      throw new HttpError(401, 'Unauthorized.');
    }

    const items = await listChatSessionsForUser(userId);
    const clamped = await Promise.all(items.map((item) => clampSessionSummaryForActor(item, actor)));
    return { body: { success: true as const, items: clamped } };
  }

  async getSession(actor: ActorContext, sessionId: number) {
    const userId = Number(actor.userId || 0);
    if (!userId) {
      throw new HttpError(401, 'Unauthorized.');
    }

    const session = await findChatSessionForUser(sessionId, userId);
    if (!session) {
      throw new HttpError(404, 'Chat session was not found.');
    }

    return { body: { success: true as const, session: await clampSessionDetailForActor(session, actor) } };
  }

  async createSession(actor: ActorContext, payload: AiChatSessionCreatePayload) {
    const userId = Number(actor.userId || 0);
    if (!userId) {
      throw new HttpError(401, 'Unauthorized.');
    }

    try {
      const normalized = normalizeCreatePayload(payload);
      const agentCapabilityScope = await resolveInitialAgentCapabilityScope(
        actor,
        normalized.agentCapabilityScope,
      );
      const session = await createChatSession({
        userId,
        actorId: actorId(actor),
        title: normalized.title,
        modelId: normalized.modelId,
        messages: normalized.messages,
        agentCapabilityScope,
      });

      return {
        statusCode: 201,
        body: { success: true as const, session: await clampSessionDetailForActor(session, actor) },
      };
    } catch (error) {
      if (error instanceof AiChatHistoryValidationError) {
        throw new HttpError(400, error.message);
      }
      throw error;
    }
  }

  async updateSession(
    actor: ActorContext,
    sessionId: number,
    payload: AiChatSessionUpdatePayload,
  ) {
    const userId = Number(actor.userId || 0);
    if (!userId) {
      throw new HttpError(401, 'Unauthorized.');
    }

    try {
      const normalized = normalizeUpdatePayload(payload);
      const agentCapabilityScope = normalized.agentCapabilityScope !== undefined
        ? await resolveInitialAgentCapabilityScope(actor, normalized.agentCapabilityScope)
        : undefined;
      const session = await updateChatSession({
        sessionId,
        userId,
        actorId: actorId(actor),
        title: normalized.title,
        modelId: normalized.modelId,
        messages: normalized.messages,
        agentCapabilityScope,
      });

      if (!session) {
        throw new HttpError(404, 'Chat session was not found.');
      }

      return { body: { success: true as const, session: await clampSessionDetailForActor(session, actor) } };
    } catch (error) {
      if (error instanceof AiChatHistoryValidationError) {
        throw new HttpError(400, error.message);
      }
      throw error;
    }
  }

  async deleteSession(actor: ActorContext, sessionId: number) {
    const userId = Number(actor.userId || 0);
    if (!userId) {
      throw new HttpError(401, 'Unauthorized.');
    }

    const deleted = await deleteChatSession(sessionId, userId, actorId(actor));
    if (!deleted) {
      throw new HttpError(404, 'Chat session was not found.');
    }

    return { body: { success: true as const } };
  }

  async listAllSessions(actor: ActorContext, query: ChatSessionListQuery = {}) {
    if (!actor.isAdmin) {
      throw new HttpError(403, 'Forbidden.');
    }

    const result = await listAllChatSessions(query);
    return {
      body: {
        success: true as const,
        items: result.items,
        totalCount: result.totalCount,
        page: result.page,
        pageSize: result.pageSize,
      },
    };
  }

  async getSessionAdmin(actor: ActorContext, sessionId: number) {
    if (!actor.isAdmin) {
      throw new HttpError(403, 'Forbidden.');
    }

    const session = await findChatSessionById(sessionId);
    if (!session) {
      throw new HttpError(404, 'Chat session was not found.');
    }

    return {
      body: {
        success: true as const,
        session: await clampSessionDetailForUser(session, session.userId),
      },
    };
  }

  async deleteSessionAdmin(actor: ActorContext, sessionId: number) {
    if (!actor.isAdmin) {
      throw new HttpError(403, 'Forbidden.');
    }

    const deleted = await deleteChatSessionById(sessionId);
    if (!deleted) {
      throw new HttpError(404, 'Chat session was not found.');
    }

    return { body: { success: true as const } };
  }
}
