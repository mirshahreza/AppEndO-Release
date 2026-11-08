import { QueryTypes } from 'sequelize';
import { isHwyMembershipUsernamePlaceholder } from '../../../domain/hwy/hwyMembershipUsername';
import { getControlPlaneSequelize } from '../../db/controlPlaneSequelize';
import { readControlPlaneProvider } from './prismaHelpers';

const CHUNK = 180;

export type HwyMemberUserLink = {
  userId: number;
  memberId: number;
  storedUsername: string | null;
};

const trimText = (value: unknown, max = 1000): string | null => {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
};

/** @deprecated Use {@link isHwyMembershipUsernamePlaceholder} from domain. */
export const isMemberIdPlaceholderUsername = (value: string, memberId: number): boolean => (
  isHwyMembershipUsernamePlaceholder(value, memberId)
);

const loadHwyMemberLinksForUserIds = async (userIds: number[]): Promise<HwyMemberUserLink[]> => {
  const unique = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (unique.length === 0 || readControlPlaneProvider() !== 'sqlserver') {
    return [];
  }

  const sequelize = getControlPlaneSequelize();
  const links: HwyMemberUserLink[] = [];

  try {
    for (let offset = 0; offset < unique.length; offset += CHUNK) {
      const chunk = unique.slice(offset, offset + CHUNK);
      const replacements: Record<string, number> = {};
      const placeholders = chunk.map((id, index) => {
        const key = `uid${index}`;
        replacements[key] = id;
        return `:${key}`;
      });
      const rows = await sequelize.query<{
        user_id: number;
        member_id: number;
        username: string | null;
      }>(
        `SELECT user_id, id AS member_id, username
         FROM dbo.hwy_members
         WHERE user_id IN (${placeholders.join(', ')})`,
        { replacements, type: QueryTypes.SELECT },
      );
      for (const row of rows) {
        const userId = Number(row.user_id);
        const memberId = Number(row.member_id);
        if (userId > 0 && memberId > 0) {
          links.push({
            userId,
            memberId,
            storedUsername: trimText(row.username),
          });
        }
      }
    }
  } catch {
    return links;
  }

  return links;
};

/**
 * Under-avatar label for Users grid: assigned legacy `UserName` stored on `hwy_members`
 * (via ETL / `hwy:etl:repair-usernames`). Never member Id / tracking placeholders.
 */
export async function resolveAvatarUsernamesForUserIds(
  users: Array<{ id: number; username: string }>,
): Promise<Map<number, string>> {
  if (!users.length) {
    return new Map();
  }

  const links = await loadHwyMemberLinksForUserIds(users.map((user) => user.id));
  const linkByUserId = new Map(links.map((link) => [link.userId, link]));

  const resolved = new Map<number, string>();
  for (const user of users) {
    const link = linkByUserId.get(user.id);
    if (link) {
      const stored = link.storedUsername?.trim();
      if (stored && !isMemberIdPlaceholderUsername(stored, link.memberId)) {
        resolved.set(user.id, stored);
      }
      continue;
    }

    const platform = trimText(user.username);
    if (!platform || platform === String(user.id)) {
      continue;
    }
    resolved.set(user.id, platform);
  }

  return resolved;
}

/** @deprecated Use {@link resolveAvatarUsernamesForUserIds}. */
export async function loadHwyMemberUsernamesForUserIds(
  userIds: number[],
): Promise<Map<number, string>> {
  const links = await loadHwyMemberLinksForUserIds(userIds);
  const map = new Map<number, string>();
  for (const link of links) {
    if (link.storedUsername) {
      map.set(link.userId, link.storedUsername);
    }
  }
  return map;
}
