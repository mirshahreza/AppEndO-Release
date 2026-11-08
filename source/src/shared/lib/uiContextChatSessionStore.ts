import { generateChatTitleFromMessage } from '../api/contracts/ai/chatHistoryValidators';

export type UiContextChatStoredMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  commands?: Array<{
    id: string;
    command: string;
    language: string;
    effect: 'read' | 'write';
    status: 'pending' | 'running' | 'ran' | 'failed' | 'skipped';
  }>;
};

export type UiContextChatStoredSession = {
  id: string;
  title: string;
  modelId: string;
  messages: UiContextChatStoredMessage[];
  createdAt: string;
  updatedAt: string;
};

export type UiContextChatSessionStore = {
  activeSessionId: string | null;
  sessions: UiContextChatStoredSession[];
};

const STORAGE_PREFIX = 'appendo:ui-context-chat:';
const MAX_SESSIONS = 50;

const emptyStore = (): UiContextChatSessionStore => ({
  activeSessionId: null,
  sessions: [],
});

export const buildUiContextChatSessionStorageKey = (
  surfaceKey: string,
  userId?: number | null,
): string => {
  const normalizedUser = Number.isInteger(Number(userId)) && Number(userId) > 0
    ? String(userId)
    : 'anon';
  return `${STORAGE_PREFIX}${normalizedUser}:${surfaceKey}`;
};

const isStoredMessage = (value: unknown): value is UiContextChatStoredMessage => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string'
    && (record.role === 'assistant' || record.role === 'user')
    && typeof record.text === 'string'
  );
};

const isStoredSession = (value: unknown): value is UiContextChatStoredSession => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string'
    && typeof record.title === 'string'
    && typeof record.modelId === 'string'
    && typeof record.createdAt === 'string'
    && typeof record.updatedAt === 'string'
    && Array.isArray(record.messages)
    && record.messages.every(isStoredMessage)
  );
};

export const readUiContextChatSessionStore = (
  surfaceKey: string,
  userId?: number | null,
): UiContextChatSessionStore => {
  if (typeof window === 'undefined' || !surfaceKey.trim()) {
    return emptyStore();
  }
  try {
    const raw = window.localStorage.getItem(buildUiContextChatSessionStorageKey(surfaceKey, userId));
    if (!raw) {
      return emptyStore();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return emptyStore();
    }
    const record = parsed as Record<string, unknown>;
    const sessions = Array.isArray(record.sessions)
      ? record.sessions.filter(isStoredSession)
      : [];
    const activeSessionId = typeof record.activeSessionId === 'string'
      ? record.activeSessionId
      : null;
    return {
      activeSessionId: activeSessionId && sessions.some((session) => session.id === activeSessionId)
        ? activeSessionId
        : null,
      sessions,
    };
  } catch {
    return emptyStore();
  }
};

export const writeUiContextChatSessionStore = (
  surfaceKey: string,
  userId: number | null | undefined,
  store: UiContextChatSessionStore,
): void => {
  if (typeof window === 'undefined' || !surfaceKey.trim()) {
    return;
  }
  try {
    window.localStorage.setItem(
      buildUiContextChatSessionStorageKey(surfaceKey, userId),
      JSON.stringify(store),
    );
  } catch {
    // Quota / private mode — ignore.
  }
};

const createSessionId = (): string => (
  `ucs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
);

const sortByUpdatedDesc = (sessions: UiContextChatStoredSession[]): UiContextChatStoredSession[] => (
  [...sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
);

export const resolveLatestUiContextChatSession = (
  store: UiContextChatSessionStore,
): UiContextChatStoredSession | null => {
  if (store.activeSessionId) {
    const active = store.sessions.find((session) => session.id === store.activeSessionId);
    if (active) {
      return active;
    }
  }
  const sorted = sortByUpdatedDesc(store.sessions);
  return sorted[0] ?? null;
};

export const upsertUiContextChatSession = (
  store: UiContextChatSessionStore,
  input: {
    sessionId: string | null;
    modelId: string;
    messages: UiContextChatStoredMessage[];
  },
): { store: UiContextChatSessionStore; session: UiContextChatStoredSession } => {
  const now = new Date().toISOString();
  const firstUserText = input.messages.find((message) => message.role === 'user')?.text ?? '';
  const existing = input.sessionId
    ? store.sessions.find((session) => session.id === input.sessionId)
    : undefined;

  const session: UiContextChatStoredSession = existing
    ? {
      ...existing,
      modelId: input.modelId || existing.modelId,
      messages: input.messages,
      title: existing.title === 'New Chat' && firstUserText
        ? generateChatTitleFromMessage(firstUserText)
        : existing.title,
      updatedAt: now,
    }
    : {
      id: createSessionId(),
      title: generateChatTitleFromMessage(firstUserText),
      modelId: input.modelId,
      messages: input.messages,
      createdAt: now,
      updatedAt: now,
    };

  const withoutCurrent = store.sessions.filter((item) => item.id !== session.id);
  const nextSessions = sortByUpdatedDesc([session, ...withoutCurrent]).slice(0, MAX_SESSIONS);

  return {
    store: {
      activeSessionId: session.id,
      sessions: nextSessions,
    },
    session,
  };
};

export const deleteUiContextChatSession = (
  store: UiContextChatSessionStore,
  sessionId: string,
): UiContextChatSessionStore => {
  const sessions = store.sessions.filter((session) => session.id !== sessionId);
  return {
    activeSessionId: store.activeSessionId === sessionId ? null : store.activeSessionId,
    sessions,
  };
};

export const setActiveUiContextChatSessionId = (
  store: UiContextChatSessionStore,
  sessionId: string | null,
): UiContextChatSessionStore => ({
  ...store,
  activeSessionId: sessionId,
});
