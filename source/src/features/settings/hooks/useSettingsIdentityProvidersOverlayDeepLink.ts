import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';

export function buildIdentityProviderConfigOverlayToken(kind: string): string {
  return `dialog/config/${kind.trim()}`;
}

type Args = {
  formOpen: boolean;
  activeKind: string | null;
  providerKinds: string[];
  openConfigByKind: (kind: string) => void;
};

export function useSettingsIdentityProvidersOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => (
      args.formOpen && args.activeKind
        ? buildIdentityProviderConfigOverlayToken(args.activeKind)
        : null
    ),
    [args.activeKind, args.formOpen],
  );

  const openFromUrl = useCallback((token: string) => {
    const prefix = 'dialog/config/';
    if (!token.startsWith(prefix)) {
      return;
    }
    const kind = token.slice(prefix.length).trim();
    if (kind && args.providerKinds.includes(kind)) {
      args.openConfigByKind(kind);
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({ enabled: true, activeToken, openFromUrl });
}
