import type {
  PersonalInboxPresetTitleOption,
  PersonalInboxTagOption,
} from '../../../shared/api/contracts/personal-inbox/types';
import {
  BASE_INFO_ROOT_INBOX_PRESET_TITLE,
  BASE_INFO_ROOT_INBOX_TAG,
} from '../../../shared/personal-inbox/inboxVocabConstants';
import { parseInboxPresetMetadata } from '../../../shared/personal-inbox/inboxPresetMetadata';
import { prisma } from '../../domain/users/prismaHelpers';

const resolveLabel = (row: { id: string; title: string | null }): string =>
  row.title?.trim() || row.id;

export class PersonalInboxVocabService {
  async listCorrespondenceVocab(): Promise<{
    presetTitles: PersonalInboxPresetTitleOption[];
    tags: PersonalInboxTagOption[];
  }> {
    const [tagRows, presetRows] = await Promise.all([
      prisma().baseInfo.findMany({
        where: { parentId: BASE_INFO_ROOT_INBOX_TAG, isActive: true },
        select: { id: true, title: true, uiColor: true },
        orderBy: [{ viewOrder: 'asc' }, { id: 'asc' }],
      }),
      prisma().baseInfo.findMany({
        where: { parentId: BASE_INFO_ROOT_INBOX_PRESET_TITLE, isActive: true },
        select: { id: true, title: true, metadata: true },
        orderBy: [{ viewOrder: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const tags: PersonalInboxTagOption[] = tagRows.map((row) => ({
      id: row.id,
      label: resolveLabel(row),
      color: row.uiColor?.trim() || null,
    }));

    const tagIdSet = new Set(tags.map((tag) => tag.id));
    const presetTitles: PersonalInboxPresetTitleOption[] = presetRows.map((row) => {
      const meta = parseInboxPresetMetadata(row.metadata);
      const tagIds = (meta.tagIds ?? []).filter((id) => tagIdSet.has(id));
      return {
        id: row.id,
        label: resolveLabel(row),
        defaultBody: meta.defaultBody?.trim() || null,
        tagIds,
      };
    });

    return { presetTitles, tags };
  }
}
