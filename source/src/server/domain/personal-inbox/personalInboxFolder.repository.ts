import type { PersonalInboxUserFolder } from '../../../shared/api/contracts/personal-inbox/types';
import {
  encodePersonalInboxUserFolderRef,
  parsePersonalInboxFolderRef,
  PERSONAL_INBOX_SYSTEM_FOLDER_TAG_REFS,
} from '../../../shared/personal-inbox/personalInboxFolderRefs';
import {
  ensurePersonalInboxFolderTables,
  getPersonalInboxItemFolderTagModel,
  getPersonalInboxUserFolderModel,
} from './personalInboxFolderSequelizeModels';

let folderTablesReady: Promise<void> | null = null;

const ensureFolderTablesOnce = (): Promise<void> => {
  if (!folderTablesReady) {
    folderTablesReady = ensurePersonalInboxFolderTables().catch((error) => {
      folderTablesReady = null;
      throw error;
    });
  }
  return folderTablesReady;
};

const isAllowedFolderRef = async (userId: number, folderRef: string): Promise<boolean> => {
  if ((PERSONAL_INBOX_SYSTEM_FOLDER_TAG_REFS as readonly string[]).includes(folderRef)) {
    return true;
  }
  const parsed = parsePersonalInboxFolderRef(folderRef);
  if (!parsed || parsed.kind !== 'user') {
    return false;
  }
  await ensureFolderTablesOnce();
  const Folder = getPersonalInboxUserFolderModel();
  const row = await Folder.findOne({ where: { id: parsed.folderId, userId } });
  return row != null;
};

export class PersonalInboxFolderRepository {
  async listUserFolders(userId: number): Promise<PersonalInboxUserFolder[]> {
    await ensureFolderTablesOnce();
    const Folder = getPersonalInboxUserFolderModel();
    const rows = await Folder.findAll({
      where: { userId },
      order: [['name', 'ASC']],
    });
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      folderRef: encodePersonalInboxUserFolderRef(Number(row.id)),
    }));
  }

  async createUserFolder(userId: number, name: string): Promise<PersonalInboxUserFolder> {
    await ensureFolderTablesOnce();
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Folder name is required.');
    }
    const Folder = getPersonalInboxUserFolderModel();
    const row = await Folder.create({
      userId,
      name: trimmed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const id = Number(row.id);
    return {
      id,
      name: trimmed,
      folderRef: encodePersonalInboxUserFolderRef(id),
    };
  }

  async listTagIndex(userId: number): Promise<Map<string, Set<string>>> {
    await ensureFolderTablesOnce();
    const Tag = getPersonalInboxItemFolderTagModel();
    const rows = await Tag.findAll({ where: { userId } });
    const index = new Map<string, Set<string>>();
    for (const row of rows) {
      const key = row.itemKey;
      const set = index.get(key) ?? new Set<string>();
      set.add(row.folderRef);
      index.set(key, set);
    }
    return index;
  }

  async getItemFolderRefs(userId: number, itemKey: string): Promise<string[]> {
    await ensureFolderTablesOnce();
    const Tag = getPersonalInboxItemFolderTagModel();
    const rows = await Tag.findAll({ where: { userId, itemKey } });
    return rows.map((row) => row.folderRef);
  }

  async renameUserFolder(userId: number, folderId: number, name: string): Promise<PersonalInboxUserFolder | null> {
    await ensureFolderTablesOnce();
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Folder name is required.');
    }
    const Folder = getPersonalInboxUserFolderModel();
    const row = await Folder.findOne({ where: { id: folderId, userId } });
    if (!row) {
      return null;
    }
    await row.update({ name: trimmed, updatedAt: new Date() });
    return {
      id: folderId,
      name: trimmed,
      folderRef: encodePersonalInboxUserFolderRef(folderId),
    };
  }

  async deleteUserFolder(userId: number, folderId: number): Promise<boolean> {
    await ensureFolderTablesOnce();
    const Folder = getPersonalInboxUserFolderModel();
    const Tag = getPersonalInboxItemFolderTagModel();
    const folderRef = encodePersonalInboxUserFolderRef(folderId);
    const deleted = await Folder.destroy({ where: { id: folderId, userId } });
    if (deleted === 0) {
      return false;
    }
    await Tag.destroy({ where: { userId, folderRef } });
    return true;
  }

  async setItemFolderRefs(userId: number, itemKey: string, folderRefs: string[]): Promise<string[]> {
    await ensureFolderTablesOnce();
    const unique = [...new Set(folderRefs.map((ref) => ref.trim()).filter(Boolean))];
    for (const ref of unique) {
      if (!(await isAllowedFolderRef(userId, ref))) {
        throw new Error(`Invalid folder: ${ref}`);
      }
    }
    const Tag = getPersonalInboxItemFolderTagModel();
    const now = new Date();
    await Tag.destroy({ where: { userId, itemKey } });
    if (unique.length > 0) {
      await Tag.bulkCreate(
        unique.map((folderRef) => ({
          userId,
          itemKey,
          folderRef,
          taggedAt: now,
        })),
      );
    }
    return unique;
  }
}

export const personalInboxFolderRepository = new PersonalInboxFolderRepository();
