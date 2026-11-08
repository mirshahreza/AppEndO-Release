import { useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { isAdminUser, hasRequiredRole } from '../../../app/guards/roleAccess';

export function useStudioToolsGate(): boolean {
  const { currentUser } = useAuth();
  return useMemo(
    () => isAdminUser(currentUser) || hasRequiredRole(currentUser, ['DEVELOPER']),
    [currentUser],
  );
}
