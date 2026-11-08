export const UI_CONTEXT_CHAT_AGENCY_MODES = ['ask', 'read-only', 'agentic'] as const;

export type UiContextChatAgencyMode = (typeof UI_CONTEXT_CHAT_AGENCY_MODES)[number];

export const DEFAULT_CHAT_AGENCY_MODE: UiContextChatAgencyMode = 'ask';

const STORAGE_PREFIX = 'appendo.chat-agency.v1:';

export function isUiContextChatAgencyMode(value: unknown): value is UiContextChatAgencyMode {
  return (UI_CONTEXT_CHAT_AGENCY_MODES as readonly unknown[]).includes(value);
}

export function resolveChatAgencyMode(
  value: unknown,
  allowed: readonly UiContextChatAgencyMode[] = UI_CONTEXT_CHAT_AGENCY_MODES,
  fallback?: UiContextChatAgencyMode,
): UiContextChatAgencyMode {
  const modes = allowed.length > 0 ? allowed : UI_CONTEXT_CHAT_AGENCY_MODES;
  if (isUiContextChatAgencyMode(value) && modes.includes(value)) {
    return value;
  }
  if (fallback !== undefined && isUiContextChatAgencyMode(fallback) && modes.includes(fallback)) {
    return fallback;
  }
  return modes[0] ?? DEFAULT_CHAT_AGENCY_MODE;
}

export function shouldAutoRunChatCommand(
  effect: 'read' | 'write',
  mode: UiContextChatAgencyMode,
): boolean {
  if (mode === 'ask') {
    return false;
  }
  if (mode === 'read-only') {
    return effect === 'read';
  }
  return true;
}

export function readChatAgencyMode(
  surface: string,
  allowed: readonly UiContextChatAgencyMode[] = UI_CONTEXT_CHAT_AGENCY_MODES,
  fallback?: UiContextChatAgencyMode,
): UiContextChatAgencyMode {
  if (typeof window === 'undefined') {
    return resolveChatAgencyMode(undefined, allowed, fallback);
  }
  try {
    return resolveChatAgencyMode(window.localStorage.getItem(`${STORAGE_PREFIX}${surface}`), allowed, fallback);
  } catch {
    return resolveChatAgencyMode(undefined, allowed, fallback);
  }
}

export function persistChatAgencyMode(surface: string, mode: UiContextChatAgencyMode): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${surface}`, mode);
  } catch {
    // ignore quota / privacy errors
  }
}
