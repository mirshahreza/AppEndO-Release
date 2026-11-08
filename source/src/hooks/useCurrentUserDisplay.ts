import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useClientContext } from '../contexts/ClientContextContext';
import { DEFAULT_ASSIGNABLE_ROLE } from '../shared/api/contracts/roles/constants';
import { resolveShellIdentityDisplay } from '../shared/sessionContext/resolveShellIdentityDisplay';

/**
 * Shell identity from clientContext — header and profile drawer share this path.
 * Prefers first name / last name / profile image from session context.
 */
export function useCurrentUserDisplay() {
  const { currentUser, isAuthenticated } = useAuth();
  const { clientContext } = useClientContext();

  const identity = useMemo(() => {
    if (!isAuthenticated) {
      return resolveShellIdentityDisplay({}, { fallbackUserId: null });
    }
    return resolveShellIdentityDisplay(clientContext, {
      fallbackUserId: currentUser?.id ?? null,
    });
  }, [clientContext, currentUser?.id, isAuthenticated]);

  const profile = useMemo(() => {
    if (!isAuthenticated) return null;
    return {
      id: identity.id,
      username: identity.username,
      email: identity.email,
      firstname: identity.firstname,
      lastname: identity.lastname,
      company_name: identity.company_name,
      person_type_code: identity.person_type_code,
      has_profile_image: identity.has_profile_image,
      has_profile_image_xs: identity.has_profile_image_xs,
      profile_updated_at: identity.profile_updated_at,
    };
  }, [identity, isAuthenticated]);

  return {
    currentUser,
    profile,
    displayName: isAuthenticated ? identity.displayName : 'User',
    avatarXs: isAuthenticated ? identity.avatarXs : null,
    avatarFull: isAuthenticated ? identity.avatarXs : null,
    avatarInitial: isAuthenticated ? identity.avatarInitial : '?',
    primaryRole: currentUser?.role || DEFAULT_ASSIGNABLE_ROLE,
    roles: currentUser?.roles ?? [],
  };
}
