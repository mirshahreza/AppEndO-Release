import { formatPackageCreatedBy } from '../../../shared/lib/formatPackageCreatedBy';
import { getUserProfileForApi } from '../../domain/users/userProfileRepository';

type SessionAuth = {
  userId: number;
  email: string;
};

export async function resolveSessionPackageCreatedBy(auth: SessionAuth): Promise<string> {
  const profile = await getUserProfileForApi(auth.userId).catch(() => null);
  const label = formatPackageCreatedBy({ email: auth.email }, profile);
  return label.trim() || auth.email.trim() || 'unknown';
}
