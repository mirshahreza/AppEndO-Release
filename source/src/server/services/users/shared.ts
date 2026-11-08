import type { ActorContext } from '../../types/requestContext';

export const actorId = (actor: ActorContext) => Number(actor.userId || 0) || null;
