import { prisma, toUserId } from '../users/prismaHelpers';
import type { SessionContextBlob } from '../../../shared/api/contracts/settings/sessionContext';
import { SESSION_CONTEXT_SECTION_KEY } from '../../../shared/api/contracts/settings/sessionContext';

const EMPTY_BLOB: SessionContextBlob = {
  version: 1,
  userAccount: {},
};

const parseBlob = (raw: string | null | undefined): SessionContextBlob => {
  if (!raw) return { ...EMPTY_BLOB, userAccount: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<SessionContextBlob>;
    if (!parsed || typeof parsed !== 'object') {
      return { ...EMPTY_BLOB, userAccount: {} };
    }
    const userAccount: SessionContextBlob['userAccount'] = {};
    if (parsed.userAccount && typeof parsed.userAccount === 'object') {
      for (const [field, value] of Object.entries(parsed.userAccount)) {
        if (!value || typeof value !== 'object') continue;
        userAccount[field] = {
          server: value.server === true,
          client: value.client === true,
        };
      }
    }
    return { version: 1, userAccount };
  } catch {
    return { ...EMPTY_BLOB, userAccount: {} };
  }
};

export async function getSessionContextBlob(): Promise<SessionContextBlob> {
  const row = await prisma().baseSettingsSection.findUnique({
    where: { sectionKey: SESSION_CONTEXT_SECTION_KEY },
    select: { value: true },
  });
  return parseBlob(row?.value);
}

export async function upsertSessionContextBlob(
  blob: SessionContextBlob,
  actorId: number | null,
): Promise<SessionContextBlob> {
  const actor = actorId !== null ? toUserId(actorId) : null;
  const value = JSON.stringify({
    version: 1 as const,
    userAccount: blob.userAccount,
  });

  await prisma().baseSettingsSection.upsert({
    where: { sectionKey: SESSION_CONTEXT_SECTION_KEY },
    create: {
      sectionKey: SESSION_CONTEXT_SECTION_KEY,
      value,
      createdBy: actor,
      updatedBy: actor,
    },
    update: {
      value,
      updatedBy: actor,
      updatedAt: new Date(),
    },
  });

  return {
    version: 1,
    userAccount: { ...blob.userAccount },
  };
}
