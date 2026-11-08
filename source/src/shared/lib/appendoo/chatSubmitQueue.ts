/** F.5 — immediate user echo + queued submits while agent is busy. */

export type ChatSubmitDispatch = 'queue' | 'execute';

export const resolveChatSubmitDispatch = (isProcessing: boolean): ChatSubmitDispatch => (
  isProcessing ? 'queue' : 'execute'
);

export const enqueueSubmitTurn = <T>(queue: readonly T[], turn: T): T[] => (
  [...queue, turn]
);

export const dequeueSubmitTurn = <T>(queue: readonly T[]): { queue: T[]; turn: T | undefined } => {
  if (queue.length === 0) {
    return { queue: [], turn: undefined };
  }
  const [turn, ...rest] = queue;
  return { queue: rest, turn };
};

export const formatQueuedSubmitPlaceholder = (
  queuedCount: number,
  idlePlaceholder = 'Ask AppEndO...',
): string => (
  queuedCount > 0
    ? `${queuedCount} message${queuedCount === 1 ? '' : 's'} queued…`
    : idlePlaceholder
);

export const appendImmediateUserEcho = <TMessage>(
  messages: readonly TMessage[],
  userMessage: TMessage,
): { nextMessages: TMessage[]; userMessageIndex: number } => {
  const userMessageIndex = messages.length;
  return {
    nextMessages: [...messages, userMessage],
    userMessageIndex,
  };
};
