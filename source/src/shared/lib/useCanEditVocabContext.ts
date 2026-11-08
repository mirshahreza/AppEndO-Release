import { useAuth } from '../../contexts/AuthContext';

export function useCanEditVocabContext(): boolean {
  const { currentUser } = useAuth();
  if (!currentUser?.roles?.length) {
    return false;
  }
  const roles = currentUser.roles.map((role) => role.toUpperCase());
  return roles.includes('ADMIN') || roles.includes('DEVELOPER');
}
