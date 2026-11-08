import { ensurePersonalInboxArchivedTables, getPersonalInboxArchivedItemModel } from './personalInboxArchivedSequelizeModels';

let archivedTablesReady: Promise<void> | null = null;

const ensureArchivedTablesOnce = (): Promise<void> => {
  if (!archivedTablesReady) {
    archivedTablesReady = ensurePersonalInboxArchivedTables().catch((error) => {
      archivedTablesReady = null;
      throw error;
    });
  }
  return archivedTablesReady;
};

export class PersonalInboxArchivedRepository {
  async listItemKeys(userId: number): Promise<Set<string>> {
    await ensureArchivedTablesOnce();
    const Model = getPersonalInboxArchivedItemModel();
    const rows = await Model.findAll({
      where: { userId },
      attributes: ['itemKey'],
    });
    return new Set(rows.map((row) => row.itemKey));
  }

  async archive(userId: number, itemKey: string): Promise<void> {
    await ensureArchivedTablesOnce();
    const Model = getPersonalInboxArchivedItemModel();
    const now = new Date();
    const existing = await Model.findOne({ where: { userId, itemKey } });
    if (existing) {
      await existing.update({ archivedAt: now });
      return;
    }
    await Model.create({ userId, itemKey, archivedAt: now });
  }

  async remove(userId: number, itemKey: string): Promise<void> {
    await ensureArchivedTablesOnce();
    const Model = getPersonalInboxArchivedItemModel();
    await Model.destroy({ where: { userId, itemKey } });
  }
}

export const personalInboxArchivedRepository = new PersonalInboxArchivedRepository();
