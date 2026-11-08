import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';

export const createUserIdentity = async (input: {
  userId: number;
  providerId: string;
  providerKind: string;
  subject: string;
  email?: string | null;
  emailVerified?: boolean;
  profileJson?: string | null;
  actorId?: number | null;
}) => {
  await prisma().baseUserIdentity.create({
    data: {
      userId: toUserId(input.userId),
      providerId: input.providerId,
      providerKind: input.providerKind,
      subject: input.subject,
      email: input.email ?? null,
      emailVerified: input.emailVerified ?? false,
      profileJson: input.profileJson ?? null,
      createdBy: input.actorId != null ? toUserId(input.actorId) : null,
      updatedBy: input.actorId != null ? toUserId(input.actorId) : null,
    },
  });
};

export const touchUserIdentityLogin = async (identityId: number) => {
  const now = new Date();
  await prisma().baseUserIdentity.update({
    where: { id: toUserId(identityId) },
    data: { lastLoginAt: now, updatedAt: now },
  });
};

export const findUserIdentityRowByProviderSubject = async (providerId: string, subject: string) => {
  const row = await prisma().baseUserIdentity.findUnique({
    where: { providerId_subject: { providerId, subject } },
    select: {
      id: true,
      userId: true,
      providerId: true,
      providerKind: true,
      subject: true,
      email: true,
      emailVerified: true,
      profileJson: true,
      linkedAt: true,
      lastLoginAt: true,
    },
  });
  if (!row) return undefined;
  return {
    id: fromUserId(row.id),
    user_id: fromUserId(row.userId),
    provider_id: row.providerId,
    provider_kind: row.providerKind,
    subject: row.subject,
    email: row.email,
    email_verified: row.emailVerified,
    profile_json: row.profileJson,
    linked_at: row.linkedAt,
    last_login_at: row.lastLoginAt,
  };
};

export const listUserIdentitiesForUser = async (userId: number) => {
  const rows = await prisma().baseUserIdentity.findMany({
    where: { userId: toUserId(userId) },
    orderBy: { linkedAt: 'asc' },
    select: {
      id: true,
      userId: true,
      providerId: true,
      providerKind: true,
      subject: true,
      email: true,
      emailVerified: true,
      profileJson: true,
      linkedAt: true,
      lastLoginAt: true,
    },
  });
  return rows.map((row) => ({
    id: fromUserId(row.id),
    user_id: fromUserId(row.userId),
    provider_id: row.providerId,
    provider_kind: row.providerKind,
    subject: row.subject,
    email: row.email,
    email_verified: row.emailVerified,
    profile_json: row.profileJson,
    linked_at: row.linkedAt,
    last_login_at: row.lastLoginAt,
  }));
};

export const deleteUserIdentitiesForUser = async (userId: number) => {
  await prisma().baseUserIdentity.deleteMany({ where: { userId: toUserId(userId) } });
};

export const deleteUserIdentitiesForProvider = async (providerId: string) => {
  await prisma().baseUserIdentity.deleteMany({ where: { providerId } });
};

export const upsertUserIdentity = async (input: {
  userId: number;
  providerId: string;
  providerKind: string;
  subject: string;
  email?: string | null;
  emailVerified?: boolean;
  profileJson?: string | null;
  actorId?: number | null;
}) => {
  await prisma().baseUserIdentity.upsert({
    where: {
      providerId_subject: {
        providerId: input.providerId,
        subject: input.subject,
      },
    },
    create: {
      userId: toUserId(input.userId),
      providerId: input.providerId,
      providerKind: input.providerKind,
      subject: input.subject,
      email: input.email ?? null,
      emailVerified: input.emailVerified ?? false,
      profileJson: input.profileJson ?? null,
      createdBy: input.actorId != null ? toUserId(input.actorId) : null,
      updatedBy: input.actorId != null ? toUserId(input.actorId) : null,
    },
    update: {
      userId: toUserId(input.userId),
      email: input.email ?? null,
      emailVerified: input.emailVerified ?? false,
      profileJson: input.profileJson ?? null,
      lastLoginAt: new Date(),
      updatedBy: input.actorId != null ? toUserId(input.actorId) : null,
      updatedAt: new Date(),
    },
  });
};

export const findUserIdentityByProviderSubject = async (providerId: string, subject: string) => {
  const row = await prisma().baseUserIdentity.findUnique({
    where: { providerId_subject: { providerId, subject } },
    select: { userId: true, subject: true },
  });
  if (!row) return undefined;
  return { user_id: fromUserId(row.userId), subject: row.subject };
};

export const findUserIdentityUserIdByProviderSubject = async (providerId: string, subject: string) => {
  const row = await prisma().baseUserIdentity.findUnique({
    where: { providerId_subject: { providerId, subject } },
    select: { userId: true },
  });
  if (!row) return undefined;
  return { user_id: fromUserId(row.userId) };
};
