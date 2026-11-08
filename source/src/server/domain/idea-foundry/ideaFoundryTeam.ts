import { QueryTypes } from 'sequelize';
import { buildUserAvatarXsPath } from '../../../shared/api/contracts/users/avatar';
import type { IdeaTeamPerson } from '../../../shared/api/contracts/idea-foundry/types';
import { formatProfileDisplayName } from '../../../shared/profile/profileDisplayName';
import { getControlPlaneSequelize } from '../../db/controlPlaneSequelize';

type UserTeamRow = {
  id: number | string;
  username: string | null;
  firstname?: string | null;
  lastname?: string | null;
  person_type_code?: string | null;
  has_xs?: number | boolean | string | null;
  profile_updated_at?: Date | string | null;
};

const asUserId = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const hasXsImage = (value: unknown): boolean => (
  value === true || value === 1 || value === '1'
);

export const loadIdeaTeamPeopleByIds = async (userIds: number[]): Promise<Map<number, IdeaTeamPerson>> => {
  const ids = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) {
    return new Map();
  }
  const placeholders = ids.map((_, index) => `:user${index}`).join(', ');
  const replacements = Object.fromEntries(ids.map((id, index) => [`user${index}`, id]));
  const rows = await getControlPlaneSequelize().query<UserTeamRow>(
    `SELECT u.id,
            u.username,
            p.firstname,
            p.lastname,
            p.person_type_code,
            CASE WHEN p.profile_image_body_xs IS NULL THEN 0 ELSE 1 END AS has_xs,
            p.updated_at AS profile_updated_at
     FROM base_users u
     LEFT JOIN base_user_profiles p ON p.user_id = u.id
     WHERE u.id IN (${placeholders})`,
    { replacements, type: QueryTypes.SELECT },
  );

  const people = new Map<number, IdeaTeamPerson>();
  for (const row of rows) {
    const userId = asUserId(row.id);
    const username = String(row.username ?? '').trim();
    if (!userId || !username) continue;
    const displayName = formatProfileDisplayName({
      firstname: row.firstname,
      lastname: row.lastname,
      person_type_code: row.person_type_code,
    }) || username;
    const cacheBust = row.profile_updated_at
      ? (row.profile_updated_at instanceof Date
        ? row.profile_updated_at.getTime()
        : Date.parse(String(row.profile_updated_at)))
      : null;
    people.set(userId, {
      userId,
      displayName,
      username,
      avatarUrl: hasXsImage(row.has_xs)
        ? buildUserAvatarXsPath(userId, Number.isFinite(cacheBust) ? cacheBust : null)
        : null,
    });
  }
  return people;
};
