import type { SessionContextMap } from '../api/contracts/attributes/types';
import { clientContextHasShellIdentity } from '../api/contracts/settings/sessionContext';

export const CLIENT_CONTEXT_STORAGE_KEY = 'appendo:client-context';

let currentClientContext: SessionContextMap = {};

export const setClientContextSnapshot = (context: SessionContextMap): void => {
  currentClientContext = context;
};

export const getClientContextSnapshot = (): SessionContextMap => currentClientContext;

export const clearClientContextSnapshot = (): void => {
  currentClientContext = {};
};

export const persistClientContextToStorage = (context: SessionContextMap): void => {
  setClientContextSnapshot(context);
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem(CLIENT_CONTEXT_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Ignore quota or serialization errors.
  }
};

export const readClientContextFromStorage = (): SessionContextMap | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(CLIENT_CONTEXT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const context = parsed as SessionContextMap;
      // Drop pre-shell-identity caches so Auth boot refetches a complete context.
      if (!clientContextHasShellIdentity(context)) {
        sessionStorage.removeItem(CLIENT_CONTEXT_STORAGE_KEY);
        return null;
      }
      return context;
    }
  } catch {
    // Ignore parse errors.
  }
  return null;
};

export const clearClientContextStorage = (): void => {
  clearClientContextSnapshot();
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.removeItem(CLIENT_CONTEXT_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
};
