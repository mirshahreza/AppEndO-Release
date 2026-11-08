import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiGet,
  apiPost,
  registerAuthFailureListener,
  restoreBrowserSession,
} from '../shared/api/client';
import type { SessionContextMap } from '../shared/api/contracts/attributes/types';
import { clientContextHasShellIdentity } from '../shared/api/contracts/settings/sessionContext';
import { queryClient } from '../shared/api/queryClient';
import { resetProfileQueriesOnAuthChange } from '../shared/api/queries/profile';
import { resetAiChatHistoryQueriesOnAuthChange } from '../shared/api/queries/aiChatHistory';
import { dataSourcesQueryKeys } from '../shared/api/queries/data-sources';
import { serverFunctionsQueryKeys } from '../shared/api/queries/server-functions';
import {
  clearClientContextStorage,
  persistClientContextToStorage,
  readClientContextFromStorage,
  setClientContextSnapshot,
} from '../shared/sessionContext/sessionContextStore';
import { ClientContextProvider } from './ClientContextContext';
import { resetAppEndooSessionSurface } from '../shared/ui/shell/resetAppEndooSessionSurface';

const invalidateEdgeCatalogQueries = () => {
  void queryClient.invalidateQueries({ queryKey: dataSourcesQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: serverFunctionsQueryKeys.catalog() });
};

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: { id: number; email: string; role: string; roles: string[] } | null;
  login: (identifier: string, password: string, otp?: { challengeId: number; otpCode: string }) => Promise<{ success: boolean; error?: string; requiresOtp?: boolean; challengeId?: number; message?: string; maskedTarget?: string }>;
  loginAs: (userId: number) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

type AuthUserPayload = {
  id: number | string;
  email: string;
  role?: string;
  roles?: unknown[];
};

type AuthSessionResponse = {
  success?: boolean;
  requiresOtp?: boolean;
  challengeId?: number;
  message?: string;
  maskedTarget?: string;
  user?: AuthUserPayload;
  clientContext?: SessionContextMap;
  error?: string;
  code?: string;
};

type AuthContextResponse = {
  success?: boolean;
  clientContext?: SessionContextMap;
};

const EMPTY_CLIENT_CONTEXT: SessionContextMap = {};

const mapAuthUser = (user?: AuthUserPayload | null) => {
  if (!user) {
    return null;
  }

  return {
    id: Number(user.id),
    email: String(user.email),
    role: String(user.role ?? ''),
    roles: Array.isArray(user.roles)
      ? user.roles.map((role) => String(role).toUpperCase()).filter(Boolean)
      : user.role
        ? [String(user.role).toUpperCase()]
        : [],
  };
};

const mapClientContext = (context?: SessionContextMap | null): SessionContextMap =>
  context && typeof context === 'object' ? context : EMPTY_CLIENT_CONTEXT;

const isEmptyClientContext = (context: SessionContextMap): boolean =>
  Object.keys(context).length === 0;

const fetchAuthContextFallback = async (): Promise<SessionContextMap> => {
  const { data, response } = await apiGet<AuthContextResponse>('/api/auth/context');
  if (!response.ok) {
    return EMPTY_CLIENT_CONTEXT;
  }
  return mapClientContext(data.clientContext);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; role: string; roles: string[] } | null>(null);
  const [clientContext, setClientContext] = useState<SessionContextMap>(() => {
    const cached = readClientContextFromStorage();
    if (cached) {
      setClientContextSnapshot(cached);
      return cached;
    }
    return EMPTY_CLIENT_CONTEXT;
  });

  useEffect(() => registerAuthFailureListener(() => {
    clearClientContextStorage();
    setCurrentUser(null);
    setClientContext(EMPTY_CLIENT_CONTEXT);
    setIsAuthenticated(false);
    resetAppEndooSessionSurface();
    resetProfileQueriesOnAuthChange(queryClient);
    resetAiChatHistoryQueriesOnAuthChange(queryClient);
  }), []);

  useEffect(() => {
    setClientContextSnapshot(clientContext);
  }, [clientContext]);

  const applyClientContext = useCallback((context?: SessionContextMap | null) => {
    const mapped = mapClientContext(context);
    setClientContext(mapped);
    persistClientContextToStorage(mapped);
    return mapped;
  }, []);

  const patchClientContext = useCallback((patch: SessionContextMap) => {
    setClientContext((previous) => {
      const next = { ...previous, ...patch };
      persistClientContextToStorage(next);
      return next;
    });
  }, []);

  const resolveClientContextAfterAuth = useCallback(async (context?: SessionContextMap | null) => {
    const mapped = applyClientContext(context);
    if (isEmptyClientContext(mapped) || !clientContextHasShellIdentity(mapped)) {
      const fallback = await fetchAuthContextFallback();
      if (!isEmptyClientContext(fallback)) {
        applyClientContext(fallback);
      }
    }
  }, [applyClientContext]);

  const clearAuthState = useCallback(() => {
    clearClientContextStorage();
    setCurrentUser(null);
    setClientContext(EMPTY_CLIENT_CONTEXT);
    setIsAuthenticated(false);
    resetAppEndooSessionSurface();
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const cachedContext = readClientContextFromStorage();
      if (cachedContext) {
        setClientContext(cachedContext);
        setClientContextSnapshot(cachedContext);
      }

      const session = await restoreBrowserSession();
      if (session.status === 'anonymous') {
        clearAuthState();
        return;
      }

      setCurrentUser(mapAuthUser(session.me.user));
      setIsAuthenticated(true);
      await resolveClientContextAfterAuth(session.me.clientContext as SessionContextMap | undefined);
    } catch {
      clearAuthState();
    } finally {
      setIsLoading(false);
    }
  }, [applyClientContext, clearAuthState, resolveClientContextAfterAuth]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const login = useCallback(async (
    identifier: string,
    password: string,
    otp?: { challengeId: number; otpCode: string },
  ) => {
    try {
      const payload = otp
        ? { identifier, password, challengeId: otp.challengeId, otpCode: otp.otpCode }
        : { identifier, password, email: identifier.includes('@') ? identifier : undefined };

      const { data, response } = await apiPost<AuthSessionResponse>('/api/auth/login', payload);

      if (response.ok && data.success && data.requiresOtp) {
        return {
          success: false,
          requiresOtp: true,
          challengeId: data.challengeId,
          message: data.message,
          maskedTarget: data.maskedTarget,
        };
      }

      if (response.ok && data.success && data.user) {
        setCurrentUser(mapAuthUser(data.user));
        await resolveClientContextAfterAuth(data.clientContext);
        setIsAuthenticated(true);
        resetProfileQueriesOnAuthChange(queryClient);
        resetAiChatHistoryQueriesOnAuthChange(queryClient);
        invalidateEdgeCatalogQueries();
        return { success: true };
      }

      return {
        success: false,
        error: typeof data.error === 'string' && data.error.trim()
          ? data.error
          : 'Invalid credentials. Please try again.',
      };
    } catch (error) {
      console.error('Login failed', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }, [resolveClientContextAfterAuth]);

  const loginAs = useCallback(async (userId: number) => {
    try {
      const { data } = await apiPost<AuthSessionResponse>(`/api/auth/loginas/${userId}`);

      if (data.success && data.user) {
        setCurrentUser(mapAuthUser(data.user));
        await resolveClientContextAfterAuth(data.clientContext);
        setIsAuthenticated(true);
        resetProfileQueriesOnAuthChange(queryClient);
        resetAiChatHistoryQueriesOnAuthChange(queryClient);
        invalidateEdgeCatalogQueries();
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }, [resolveClientContextAfterAuth]);

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/auth/logout');
    } catch {
      // Best effort logout
    }
    clearAuthState();
    resetProfileQueriesOnAuthChange(queryClient);
    resetAiChatHistoryQueriesOnAuthChange(queryClient);
  }, [clearAuthState]);

  const refreshSession = useCallback(async () => {
    await checkSession();
  }, [checkSession]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      currentUser,
      login,
      loginAs,
      logout,
      refreshSession,
    }),
    [currentUser, isAuthenticated, isLoading, login, loginAs, logout, refreshSession],
  );

  return (
    <AuthContext.Provider value={value}>
      <ClientContextProvider clientContext={clientContext} patchClientContext={patchClientContext}>
        {children}
      </ClientContextProvider>
    </AuthContext.Provider>
  );
};

export { useClientContext, usePatchClientContext } from './ClientContextContext';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
