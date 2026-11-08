import type { ActorContext } from '../../types/requestContext';
import { findChatSessionForUser } from '../../domain/ai/chatHistoryRepository';
import { listAgentTracesForSession } from '../../domain/ai/agentTraceRepository';
import { HttpError } from '../../errors/HttpError';

export class AgentTraceService {
  async listSessionTraces(actor: ActorContext, sessionId: number) {
    if (!Number.isInteger(sessionId) || sessionId < 1) {
      throw new HttpError(400, 'Invalid session id.');
    }

    const session = await findChatSessionForUser(sessionId, actor.userId);
    if (!session) {
      throw new HttpError(404, 'Chat session not found.');
    }

    const traces = await listAgentTracesForSession(sessionId, actor.userId);
    return {
      body: {
        sessionId,
        traces,
      },
    };
  }
}
