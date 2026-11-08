import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PersonalInboxItem } from '../../../../shared/api/contracts/personal-inbox/types';
import { PersonalInboxProjectionRepository } from '../personalInboxProjection.repository';
import {
  configurePersonalInboxProjectionSequelizeForTests,
  ensurePersonalInboxProjectionTables,
  resetPersonalInboxProjectionModelCacheForTests,
} from '../personalInboxProjectionSequelizeModels';

const sampleItem = (overrides?: Partial<PersonalInboxItem>): PersonalInboxItem => ({
  id: 'work_item:1',
  kind: 'work_item',
  origin: 'Workflow',
  originDetail: 'APPROVAL',
  title: 'Task',
  summary: null,
  surfacedAt: '2026-10-01T10:00:00.000Z',
  attention: 'action_required',
  href: 'my-inbox?workItemId=1',
  ref: { type: 'work_item', id: 1 },
  ...overrides,
});

describe('PersonalInboxProjectionRepository', () => {
  let sequelize: Sequelize;
  let repo: PersonalInboxProjectionRepository;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    configurePersonalInboxProjectionSequelizeForTests(sequelize);
    await ensurePersonalInboxProjectionTables(sequelize);
    repo = new PersonalInboxProjectionRepository();
  });

  afterEach(async () => {
    configurePersonalInboxProjectionSequelizeForTests(null);
    resetPersonalInboxProjectionModelCacheForTests();
    await sequelize.close();
  });

  it('replaces rows and reads them back sorted by surfacedAt', async () => {
    await repo.replaceUserItems(9, [
      sampleItem({ id: 'work_item:1', surfacedAt: '2026-10-01T10:00:00.000Z' }),
      sampleItem({
        id: 'feedback:2',
        kind: 'feedback',
        attention: 'unread',
        ref: { type: 'feedback', id: 2 },
        surfacedAt: '2026-10-03T10:00:00.000Z',
      }),
    ]);

    const meta = await repo.getMeta(9);
    expect(meta?.itemCount).toBe(2);
    expect(meta?.refreshedAt).toBeTruthy();

    const { items, total } = await repo.listUserItems(9, { take: 10 });
    expect(total).toBe(2);
    expect(items.map((i) => i.id)).toEqual(['feedback:2', 'work_item:1']);
    expect(await repo.countAttention(9)).toBe(2);
  });

  it('markStale forces refresh on next ensure path', async () => {
    await repo.replaceUserItems(3, [sampleItem()]);
    await repo.markStale(3);
    const meta = await repo.getMeta(3);
    expect(meta?.refreshedAt).toBeNull();
  });

  it('replaceUserItems removes prior rows for the user', async () => {
    await repo.replaceUserItems(1, [sampleItem({ id: 'work_item:1' })]);
    await repo.replaceUserItems(1, [sampleItem({ id: 'work_item:2', ref: { type: 'work_item', id: 2 } })]);
    const { items, total } = await repo.listUserItems(1);
    expect(total).toBe(1);
    expect(items[0]?.id).toBe('work_item:2');
  });

  it('filters by kind and counts attention by kind', async () => {
    await repo.replaceUserItems(5, [
      sampleItem({ id: 'work_item:1', attention: 'action_required' }),
      sampleItem({
        id: 'alert:1',
        kind: 'alert',
        attention: 'unread',
        ref: { type: 'notification', id: 1 },
      }),
      sampleItem({
        id: 'feedback:1',
        kind: 'feedback',
        attention: 'none',
        ref: { type: 'feedback', id: 1 },
      }),
    ]);

    const alerts = await repo.listUserItems(5, { kind: 'alert' });
    expect(alerts.total).toBe(1);

    const breakdown = await repo.countAttentionByKind(5);
    expect(breakdown).toEqual({ workItems: 1, feedback: 0, alerts: 1 });

    const attentionPreview = await repo.listAttentionItems(5, 5);
    expect(attentionPreview.map((i) => i.id).sort()).toEqual(['alert:1', 'work_item:1']);
  });

  it('isolates rows per user', async () => {
    await repo.replaceUserItems(10, [sampleItem({ id: 'work_item:10' })]);
    await repo.replaceUserItems(11, [sampleItem({ id: 'work_item:11' })]);
    expect((await repo.listUserItems(10)).total).toBe(1);
    expect((await repo.listUserItems(11)).total).toBe(1);
    expect((await repo.listUserItems(10)).items[0]?.id).toBe('work_item:10');
  });
});
