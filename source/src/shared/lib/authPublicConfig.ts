import { useEffect, useState } from 'react';
import { apiGet } from '../api/client';

export type AuthPublicConfig = {
  login?: { allowUsername?: boolean; allowEmail?: boolean; allowMobile?: boolean };
  registration?: { enabled?: boolean; requireTerms?: boolean; defaultRole?: string };
  otp?: { enabled?: boolean; channelEmail?: boolean };
  verification?: { emailVerifyEnabled?: boolean; emailVerifyRequired?: boolean };
  identityProviders?: Array<{ id: string; kind: string; label: string }>;
};

type AuthPublicConfigResponse = {
  config?: AuthPublicConfig;
};

export const isPublicRegistrationEnabled = (
  config: AuthPublicConfig | null | undefined,
): boolean => config?.registration?.enabled === true;

export async function fetchAuthPublicConfig(): Promise<AuthPublicConfig> {
  const { data } = await apiGet<AuthPublicConfigResponse>('/api/auth/config', {
    cache: 'no-store',
  });
  return data.config ?? {};
}

export function useAuthPublicConfig() {
  const [config, setConfig] = useState<AuthPublicConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextConfig = await fetchAuthPublicConfig();
        if (!cancelled) {
          setConfig(nextConfig);
        }
      } catch {
        if (!cancelled) {
          setConfig({});
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    config,
    isLoading,
    registrationEnabled: isPublicRegistrationEnabled(config),
  };
}
