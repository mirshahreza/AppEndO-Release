import {
  ensurePersonalInboxCorrespondenceTable,
  getPersonalInboxCorrespondenceModel,
} from './personalInboxCorrespondenceSequelizeModels';

export type PersonalInboxCorrespondenceFlags = {
  replied: boolean;
  forwarded: boolean;
};

let tablesReady: Promise<void> | null = null;

const ensureOnce = (): Promise<void> => {
  if (!tablesReady) {
    tablesReady = ensurePersonalInboxCorrespondenceTable().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  return tablesReady;
};

export class PersonalInboxCorrespondenceRepository {
  async markReplied(userId: number, itemKey: string): Promise<void> {
    await ensureOnce();
    const Model = getPersonalInboxCorrespondenceModel();
    const now = new Date();
    const trimmed = itemKey.trim();
    const existing = await Model.findOne({ where: { userId, itemKey: trimmed } });
    if (existing) {
      await existing.update({ repliedAt: now, updatedAt: now });
      return;
    }
    await Model.create({
      userId,
      itemKey: trimmed,
      repliedAt: now,
      forwardedAt: null,
      updatedAt: now,
    });
  }

  async markForwarded(userId: number, itemKey: string): Promise<void> {
    await ensureOnce();
    const Model = getPersonalInboxCorrespondenceModel();
    const now = new Date();
    const trimmed = itemKey.trim();
    const existing = await Model.findOne({ where: { userId, itemKey: trimmed } });
    if (existing) {
      await existing.update({ forwardedAt: now, updatedAt: now });
      return;
    }
    await Model.create({
      userId,
      itemKey: trimmed,
      repliedAt: null,
      forwardedAt: now,
      updatedAt: now,
    });
  }

  async listFlagsForUser(userId: number, itemKeys: string[]): Promise<Map<string, PersonalInboxCorrespondenceFlags>> {
    await ensureOnce();
    const result = new Map<string, PersonalInboxCorrespondenceFlags>();
    if (itemKeys.length === 0) {
      return result;
    }
    const trimmed = [...new Set(itemKeys.map((key) => key.trim()).filter(Boolean))];
    const Model = getPersonalInboxCorrespondenceModel();
    const rows = await Model.findAll({
      where: { userId, itemKey: trimmed },
    });
    for (const row of rows) {
      result.set(String(row.itemKey).trim(), {
        replied: row.repliedAt != null,
        forwarded: row.forwardedAt != null,
      });
    }
    return result;
  }

  async clearForUserItem(userId: number, itemKey: string): Promise<void> {
    await ensureOnce();
    const Model = getPersonalInboxCorrespondenceModel();
    await Model.destroy({ where: { userId, itemKey: itemKey.trim() } });
  }
}

export const personalInboxCorrespondenceRepository = new PersonalInboxCorrespondenceRepository();
