import {
  ensurePersonalInboxSeenTable,
  getPersonalInboxItemSeenModel,
} from './personalInboxSeenSequelizeModels';

let tablesReady: Promise<void> | null = null;

const ensureSeenTableOnce = (): Promise<void> => {
  if (!tablesReady) {
    tablesReady = ensurePersonalInboxSeenTable().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  return tablesReady;
};

const normalizeUserId = (userId: number): number => Number(userId);

export class PersonalInboxSeenRepository {
  async markSeen(userId: number, itemKey: string): Promise<void> {
    await ensureSeenTableOnce();
    const trimmed = itemKey.trim();
    if (!trimmed) {
      return;
    }
    const uid = normalizeUserId(userId);
    const Seen = getPersonalInboxItemSeenModel();
    const now = new Date();
    await Seen.destroy({ where: { userId: uid, itemKey: trimmed } });
    await Seen.create({ userId: uid, itemKey: trimmed, seenAt: now });
  }

  async clearSeen(userId: number, itemKey: string): Promise<void> {
    await ensureSeenTableOnce();
    const trimmed = itemKey.trim();
    if (!trimmed) {
      return;
    }
    const Seen = getPersonalInboxItemSeenModel();
    await Seen.destroy({ where: { userId: normalizeUserId(userId), itemKey: trimmed } });
  }

  async listSeenItemKeys(userId: number): Promise<Set<string>> {
    await ensureSeenTableOnce();
    const Seen = getPersonalInboxItemSeenModel();
    const rows = await Seen.findAll({
      where: { userId: normalizeUserId(userId) },
      attributes: ['itemKey'],
    });
    return new Set(rows.map((row) => String(row.itemKey).trim()));
  }
}

export const personalInboxSeenRepository = new PersonalInboxSeenRepository();
