import type { AuthRequestContext } from '../../middleware/auth.middleware';
import { countUnseenNotifications } from '../notifications/userNotification.service';
import type {
  PersonalInboxAttention,
  PersonalInboxItem,
  PersonalInboxKindFilter,
  PersonalInboxListResult,
  PersonalInboxSummary,
  PersonalInboxUserFolder,
  PersonalInboxViewFilter,
} from '../../../shared/api/contracts/personal-inbox/types';
import type { FeedbackService } from '../feedback/feedback.service';
import { personalInboxProjectionRepository, PersonalInboxProjectionRepository } from '../../domain/personal-inbox/personalInboxProjection.repository';
import { personalInboxFolderRepository } from '../../domain/personal-inbox/personalInboxFolder.repository';
import { personalInboxSeenRepository } from '../../domain/personal-inbox/personalInboxSeen.repository';
import { collectPersonalInboxItems, collectPersonalInboxItemsUnfiltered } from './personalInboxLiveCollector';
import { findPersonalInboxDispatchItem, listPersonalInboxDispatchItems } from './personalInboxDispatchItems';
import {
  PERSONAL_INBOX_PROJECTION_TTL_MS,
  resolvePersonalInboxReadMode,
  type PersonalInboxReadMode,
} from './personalInboxProjectionConfig';
import {
  canonicalPersonalInboxItemKey,
  dismissPersonalInboxAttention,
  markPersonalInboxUnread,
  parsePersonalInboxItemRef,
} from './personalInboxItemActions.service';
import { patchPersonalInboxProjectionAttention } from './personalInboxProjectionSync';
import {
  attachFolderRefsToItems,
  filterPersonalInboxItemsByFolderScope,
  shouldHideFromInboxSummary,
  type PersonalInboxFolderListScope,
} from './personalInboxFolderFilters';
import { setPersonalInboxItemFolderRefs } from './personalInboxFolderTags.service';
import { parsePersonalInboxFolderFilterToken } from '../../../shared/personal-inbox/personalInboxFolderRefs';
import { enrichPersonalInboxAttachmentCounts } from './personalInboxAttachmentCounts';
import { enrichPersonalInboxCorrespondence } from './personalInboxCorrespondenceEnrich';

const DEFAULT_TAKE = 50;
const MAX_TAKE = 100;
const PREVIEW_TAKE = 8;

const applyKindFilter = (items: PersonalInboxItem[], kind: PersonalInboxKindFilter | undefined): PersonalInboxItem[] => {
  if (!kind || kind === 'all') return items;
  return items.filter((item) => item.kind === kind);
};

const countAttention = (items: PersonalInboxItem[]): number =>
  items.filter((item) => item.attention === 'action_required' || item.attention === 'unread').length;

const sortItems = (items: PersonalInboxItem[]): PersonalInboxItem[] =>
  [...items].sort((a, b) => Date.parse(b.surfacedAt) - Date.parse(a.surfacedAt));

const isProjectionFresh = (refreshedAt: Date | null): boolean => {
  if (!refreshedAt) {
    return false;
  }
  return Date.now() - refreshedAt.getTime() < PERSONAL_INBOX_PROJECTION_TTL_MS;
};

const resolveFolderScope = (
  folder?: string,
  view?: PersonalInboxViewFilter,
): PersonalInboxFolderListScope => {
  if (folder?.trim()) {
    const parsed = parsePersonalInboxFolderFilterToken(folder);
    if (parsed.scope === 'user') {
      return { scope: 'user', folderId: parsed.folderId };
    }
    return { scope: 'system', slug: parsed.slug };
  }
  if (view === 'archived') {
    return { scope: 'system', slug: 'archived' };
  }
  if (view === 'all') {
    return { scope: 'system', slug: 'all' };
  }
  return { scope: 'system', slug: 'inbox' };
};

export type PersonalInboxServiceOptions = {
  readMode?: PersonalInboxReadMode;
  projectionRepository?: PersonalInboxProjectionRepository;
};

export class PersonalInboxService {
  private readonly readMode: PersonalInboxReadMode;
  private readonly projection: PersonalInboxProjectionRepository;

  constructor(
    private readonly feedbackService: FeedbackService,
    options?: PersonalInboxServiceOptions,
  ) {
    this.readMode = options?.readMode ?? resolvePersonalInboxReadMode();
    this.projection = options?.projectionRepository ?? personalInboxProjectionRepository;
  }

  async list(
    auth: AuthRequestContext,
    query?: {
      kind?: PersonalInboxKindFilter;
      folder?: string;
      view?: PersonalInboxViewFilter;
      take?: number;
      dispatchChannel?: string;
      dispatchStatus?: string;
    },
  ): Promise<PersonalInboxListResult> {
    const take = Math.min(Math.max(query?.take ?? DEFAULT_TAKE, 1), MAX_TAKE);
    const folderScope = resolveFolderScope(query?.folder, query?.view);
    if (query?.kind === 'message_dispatch') {
      const dispatchResult = await listPersonalInboxDispatchItems(auth.userId, {
        channel: query.dispatchChannel,
        deliveryStatus: query.dispatchStatus,
        take,
        folderScope,
      });
      const inboxAttentionCount = await this.inboxAttentionCount(auth);
      const items = await enrichPersonalInboxAttachmentCounts(dispatchResult.items);
      return { ...dispatchResult, items, inboxAttentionCount };
    }
    const tagIndex = await personalInboxFolderRepository.listTagIndex(auth.userId);
    const allItems = await this.loadScopedInboxItems(auth, {
      kind: 'all',
      folderScope,
    });
    const visibleInbox = allItems.filter(
      (item) => !shouldHideFromInboxSummary(tagIndex.get(item.id) ?? []),
    );
    const inboxAttentionCount = countAttention(visibleInbox);
    const filtered = applyKindFilter(allItems, query?.kind);
    const unreadTotal = countAttention(filtered);
    return {
      items: filtered.slice(0, take),
      total: filtered.length,
      unreadTotal,
      inboxAttentionCount,
    };
  }

  private async inboxAttentionCount(auth: AuthRequestContext): Promise<number> {
    const summary = await this.summary(auth);
    return summary.attentionCount;
  }

  private async loadScopedInboxItems(
    auth: AuthRequestContext,
    options: {
      kind?: PersonalInboxKindFilter;
      folderScope: PersonalInboxFolderListScope;
    },
  ): Promise<PersonalInboxItem[]> {
    const tagIndex = await personalInboxFolderRepository.listTagIndex(auth.userId);
    const { folderScope } = options;
    const useUnfilteredSource = folderScope.scope === 'system'
      ? folderScope.slug !== 'inbox'
      : true;

    let items: PersonalInboxItem[];
    if (this.readMode === 'live' || useUnfilteredSource) {
      const source = useUnfilteredSource
        ? await collectPersonalInboxItemsUnfiltered(auth, this.feedbackService)
        : await collectPersonalInboxItems(auth, this.feedbackService);
      items = applyKindFilter(source, options.kind);
      items = filterPersonalInboxItemsByFolderScope(items, tagIndex, folderScope);
    } else {
      await this.ensureFreshProjection(auth);
      const listed = await this.projection.listUserItems(auth.userId, {
        kind: options.kind,
      });
      items = filterPersonalInboxItemsByFolderScope(listed.items, tagIndex, folderScope);
    }

    if (folderScope.scope === 'system' && (folderScope.slug === 'archived' || folderScope.slug === 'deleted')) {
      items = items.map((item) => ({ ...item, attention: 'none' as const }));
    }
    const withFolders = attachFolderRefsToItems(
      await this.applyInboxSeenAttentionOverlay(auth.userId, items),
      tagIndex,
    );
    const withAttachments = await enrichPersonalInboxAttachmentCounts(withFolders);
    return enrichPersonalInboxCorrespondence(auth.userId, withAttachments);
  }

  async findItemForUser(auth: AuthRequestContext, itemKey: string): Promise<PersonalInboxItem | undefined> {
    const canonicalKey = canonicalPersonalInboxItemKey(itemKey);
    const ref = parsePersonalInboxItemRef(canonicalKey);
    if (ref?.type === 'message_dispatch') {
      return findPersonalInboxDispatchItem(auth.userId, ref.id);
    }
    const listed = await this.list(auth, { kind: 'all', take: 200, folder: 'inbox' });
    const fromInbox = listed.items.find((row) => row.id === canonicalKey);
    if (fromInbox) {
      return fromInbox;
    }
    const fromAllFolders = (await this.list(auth, { kind: 'all', take: 200, view: 'all' }))
      .items.find((row) => row.id === canonicalKey);
    if (fromAllFolders) {
      return fromAllFolders;
    }
    const merged = await collectPersonalInboxItemsUnfiltered(auth, this.feedbackService);
    const found = merged.find((row) => row.id === canonicalKey);
    if (!found) {
      return undefined;
    }
    const tagIndex = await personalInboxFolderRepository.listTagIndex(auth.userId);
    const withFolders = attachFolderRefsToItems([found], tagIndex);
    const [withAttachments] = await enrichPersonalInboxAttachmentCounts(withFolders);
    const [enriched] = await enrichPersonalInboxCorrespondence(auth.userId, [withAttachments]);
    return enriched;
  }

  private async refreshProjectionAfterMutation(auth: AuthRequestContext): Promise<void> {
    await this.projection.markStale(auth.userId);
    const items = await collectPersonalInboxItems(auth, this.feedbackService);
    await this.projection.replaceUserItems(auth.userId, items);
  }

  private async applyInboxSeenAttentionOverlay(
    userId: number,
    items: PersonalInboxItem[],
  ): Promise<PersonalInboxItem[]> {
    const seenKeys = await personalInboxSeenRepository.listSeenItemKeys(userId);
    if (seenKeys.size === 0) {
      return items;
    }
    return items.map((item) => (
      seenKeys.has(item.id.trim())
        ? { ...item, attention: 'none' as const }
        : item
    ));
  }

  async dismissAttention(auth: AuthRequestContext, itemKey: string): Promise<{ dismissed: boolean }> {
    const canonicalKey = canonicalPersonalInboxItemKey(itemKey);
    const ref = parsePersonalInboxItemRef(canonicalKey);
    if (ref?.type === 'feedback') {
      await this.persistInboxItemSeen(auth, canonicalKey);
    }
    const result = await dismissPersonalInboxAttention(auth, canonicalKey, this.feedbackService);
    if (!result.dismissed) {
      return result;
    }
    if (ref?.type !== 'feedback') {
      await this.persistInboxItemSeen(auth, canonicalKey);
    }
    await this.refreshProjectionAfterMutation(auth);
    return result;
  }

  async markUnread(auth: AuthRequestContext, itemKey: string): Promise<{ updated: boolean }> {
    const canonicalKey = canonicalPersonalInboxItemKey(itemKey);
    const result = await markPersonalInboxUnread(auth, canonicalKey, this.feedbackService);
    if (!result.updated) {
      return result;
    }
    await this.refreshProjectionAfterMutation(auth);
    return result;
  }

  private async persistInboxItemSeen(auth: AuthRequestContext, itemKey: string): Promise<void> {
    const canonicalKey = canonicalPersonalInboxItemKey(itemKey);
    await personalInboxSeenRepository.markSeen(auth.userId, canonicalKey);
    await patchPersonalInboxProjectionAttention(auth.userId, canonicalKey, 'none');
  }

  async setItemFolderRefs(
    auth: AuthRequestContext,
    itemKey: string,
    folderRefs: string[],
  ): Promise<{ folderRefs: string[] }> {
    const result = await setPersonalInboxItemFolderRefs(auth, itemKey, folderRefs);
    await this.refreshProjectionAfterMutation(auth);
    return result;
  }

  async permanentDeleteItem(auth: AuthRequestContext, itemKey: string): Promise<{ deleted: boolean }> {
    const { permanentDeletePersonalInboxItem } = await import('./personalInboxPermanentDelete.service');
    const result = await permanentDeletePersonalInboxItem(auth, itemKey);
    await this.refreshProjectionAfterMutation(auth);
    return result;
  }

  async listFolders(auth: AuthRequestContext): Promise<{ userFolders: PersonalInboxUserFolder[] }> {
    const userFolders = await personalInboxFolderRepository.listUserFolders(auth.userId);
    return { userFolders };
  }

  async createFolder(auth: AuthRequestContext, name: string): Promise<PersonalInboxUserFolder> {
    return personalInboxFolderRepository.createUserFolder(auth.userId, name);
  }

  async renameFolder(
    auth: AuthRequestContext,
    folderId: number,
    name: string,
  ): Promise<PersonalInboxUserFolder | null> {
    return personalInboxFolderRepository.renameUserFolder(auth.userId, folderId, name);
  }

  async deleteFolder(auth: AuthRequestContext, folderId: number): Promise<{ deleted: boolean }> {
    const deleted = await personalInboxFolderRepository.deleteUserFolder(auth.userId, folderId);
    return { deleted };
  }

  async summary(auth: AuthRequestContext): Promise<PersonalInboxSummary> {
    const tagIndex = await personalInboxFolderRepository.listTagIndex(auth.userId);
    const items = await this.loadScopedInboxItems(auth, {
      kind: 'all',
      folderScope: { scope: 'system', slug: 'inbox' },
    });
    return this.buildSummaryFromItems(items, tagIndex);
  }

  async unseenNotificationCount(userId: number): Promise<number> {
    return countUnseenNotifications(userId);
  }

  private async ensureFreshProjection(auth: AuthRequestContext): Promise<void> {
    const meta = await this.projection.getMeta(auth.userId);
    if (meta && isProjectionFresh(meta.refreshedAt)) {
      return;
    }
    const items = await collectPersonalInboxItems(auth, this.feedbackService);
    await this.projection.replaceUserItems(auth.userId, items);
  }

  private buildSummaryFromItems(
    items: PersonalInboxItem[],
    tagIndex: Map<string, Set<string>>,
  ): PersonalInboxSummary {
    const visible = items.filter((item) => !shouldHideFromInboxSummary(tagIndex.get(item.id) ?? []));
    const attentionItems = visible.filter(
      (item): item is PersonalInboxItem & { attention: PersonalInboxAttention } =>
        item.attention === 'action_required' || item.attention === 'unread',
    );
    const breakdown = {
      workItems: attentionItems.filter((i) => i.kind === 'work_item').length,
      feedback: attentionItems.filter((i) => i.kind === 'feedback').length,
      alerts: attentionItems.filter((i) => i.kind === 'alert').length,
    };
    const preview = sortItems(attentionItems).slice(0, PREVIEW_TAKE);
    if (preview.length < PREVIEW_TAKE) {
      const filler = sortItems(visible.filter((i) => i.attention === 'none')).slice(0, PREVIEW_TAKE - preview.length);
      preview.push(...filler);
    }
    return {
      attentionCount: countAttention(visible),
      breakdown,
      preview,
    };
  }
}
