import type { UserProfileRecord } from '../api/queries/profile';

type PackageCreatedByUser = { email: string } | null | undefined;

export function formatPackageCreatedBy(
  user: PackageCreatedByUser,
  profile: UserProfileRecord | null | undefined,
): string {
  const first = profile?.firstname?.trim();
  const last = profile?.lastname?.trim();
  const fullName = [first, last].filter(Boolean).join(' ');
  const email = profile?.email?.trim() || user?.email?.trim() || '';
  const username = profile?.username?.trim();

  if (fullName && email) {
    return `${fullName} <${email}>`;
  }
  if (fullName) {
    return fullName;
  }
  if (username && email) {
    return `${username} <${email}>`;
  }
  if (username) {
    return username;
  }
  return email;
}
