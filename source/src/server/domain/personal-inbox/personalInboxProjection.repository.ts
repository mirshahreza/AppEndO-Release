import type { Transaction } from 'sequelize';
import type {
  PersonalInboxAttention,
  PersonalInboxItem,
  PersonalInboxItemKind,
  PersonalInboxKindFilter,
} from '../../../shared/api/contracts/personal-inbox/types';
import {
  getPersonalInboxProjectionItemModel,
  getPersonalInboxProjectionMetaModel,
  type PersonalInboxProjectionItemModel,
} from './personalInboxProjectionSequelizeModels';
import { personalInboxSeenRepository } from './personalInboxSeen.repository';

const ATTENTION_ACTIVE: PersonalInboxAttention[] = ['action_required', 'unread'];

const mapRowToItem = (row: PersonalInboxProjectionItemModel): PersonalInboxItem => ({
  id: row.itemKey,
  kind: row.kind as PersonalInboxItemKind,
  origin: row.origin,
  originDetail: row.originDetail,
  title: row.title,
  summary: row.summary,
  surfacedAt: row.surfacedAt.toISOString(),
  attention: row.attention as PersonalInboxAttention,
  href: row.href,
  ref: {
    type: row.refType as PersonalInboxItem['ref']['type'],
    id: Number(row.refId),
  },
});

const itemToRow = (userId: number, item: PersonalInboxItem, now: Date) => ({
  userId,
  itemKey: item.id,
  kind: item.kind,
  origin: item.origin,
  originDetail: item.originDetail,
  title: item.title,
  summary: item.summary,
  surfacedAt: new Date(item.surfacedAt),
  attention: item.attention,
  href: item.href,
  refType: item.ref.type,
  refId: item.ref.id,
  createdAt: now,
  updatedAt: now,
});

export class PersonalInboxProjectionRepository {
  async getMeta(userId: number): Promise<{ refreshedAt: Date | null; itemCount: number } | null> {
    const Meta = getPersonalInboxProjectionMetaModel();
    const row = await Meta.findByPk(userId);
    if (!row) {
      return null;
    }
    return { refreshedAt: row.refreshedAt, itemCount: row.itemCount };
  }

  async markStale(userId: number): Promise<void> {
    const Meta = getPersonalInboxProjectionMetaModel();
    const existing = await Meta.findByPk(userId);
    if (!existing) {
      return;
    }
    await existing.update({ refreshedAt: null, updatedAt: new Date() });
  }

  async replaceUserItems(userId: number, items: PersonalInboxItem[]): Promise<void> {
    const Item = getPersonalInboxProjectionItemModel();
    const Meta = getPersonalInboxProjectionMetaModel();
    const now = new Date();
    const sequelize = Item.sequelize!;
    await sequelize.transaction(async (transaction: Transaction) => {
      const seenItemKeys = await personalInboxSeenRepository.listSeenItemKeys(userId);
      const mergedItems = items.map((item) => (
        seenItemKeys.has(item.id.trim())
          ? { ...item, attention: 'none' as PersonalInboxAttention }
          : item
      ));
      await Item.destroy({ where: { userId }, transaction });
      if (mergedItems.length > 0) {
        await Item.bulkCreate(
          mergedItems.map((item) => itemToRow(userId, item, now)),
          { transaction },
        );
      }
      await Meta.upsert(
        {
          userId,
          refreshedAt: now,
          itemCount: mergedItems.length,
          updatedAt: now,
        },
        { transaction },
      );
    });
  }

  async listUserItems(
    userId: number,
    options?: { kind?: PersonalInboxKindFilter; take?: number },
  ): Promise<{ items: PersonalInboxItem[]; total: number }> {
    const Item = getPersonalInboxProjectionItemModel();
    const where: Record<string, unknown> = { userId };
    if (options?.kind && options.kind !== 'all') {
      where.kind = options.kind;
    }
    const total = await Item.count({ where });
    const rows = await Item.findAll({
      where,
      order: [['surfacedAt', 'DESC']],
      limit: options?.take,
    });
    return { items: rows.map(mapRowToItem), total };
  }

  async listAttentionItems(userId: number, take: number): Promise<PersonalInboxItem[]> {
    const Item = getPersonalInboxProjectionItemModel();
    const rows = await Item.findAll({
      where: {
        userId,
        attention: ATTENTION_ACTIVE,
      },
      order: [['surfacedAt', 'DESC']],
      limit: take,
    });
    return rows.map(mapRowToItem);
  }

  async countAttention(userId: number): Promise<number> {
    const Item = getPersonalInboxProjectionItemModel();
    return Item.count({
      where: {
        userId,
        attention: ATTENTION_ACTIVE,
      },
    });
  }

  async countAttentionByKind(userId: number): Promise<{ workItems: number; feedback: number; alerts: number }> {
    const Item = getPersonalInboxProjectionItemModel();
    const baseWhere = { userId, attention: ATTENTION_ACTIVE };
    const [workItems, feedback, alerts] = await Promise.all([
      Item.count({ where: { ...baseWhere, kind: 'work_item' } }),
      Item.count({ where: { ...baseWhere, kind: 'feedback' } }),
      Item.count({ where: { ...baseWhere, kind: 'alert' } }),
    ]);
    return { workItems, feedback, alerts };
  }
}

export const personalInboxProjectionRepository = new PersonalInboxProjectionRepository();
