import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthRequestContext } from '../../../middleware/auth.middleware';
import type { PersonalInboxItem } from '../../../../shared/api/contracts/personal-inbox/types';
import { PersonalInboxProjectionRepository } from '../../../domain/personal-inbox/personalInboxProjection.repository';
import {
  configurePersonalInboxArchivedSequelizeForTests,
  ensurePersonalInboxArchivedTables,
  resetPersonalInboxArchivedModelCacheForTests,
} from '../../../domain/personal-inbox/personalInboxArchivedSequelizeModels';
import {
  configurePersonalInboxProjectionSequelizeForTests,
  ensurePersonalInboxProjectionTables,
  getPersonalInboxProjectionMetaModel,
  resetPersonalInboxProjectionModelCacheForTests,
} from '../../../domain/personal-inbox/personalInboxProjectionSequelizeModels';
import { PersonalInboxService } from '../personalInbox.service';
import type { FeedbackService } from '../../feedback/feedback.service';

vi.mock('../personalInboxLiveCollector', () => ({
  collectPersonalInboxItems: vi.fn(),
}));

vi.mock('../personalInboxAttachmentCounts', () => ({
  enrichPersonalInboxAttachmentCounts: vi.fn(async (items: unknown[]) => items),
}));

import { collectPersonalInboxItems } from '../personalInboxLiveCollector';

const auth: AuthRequestContext = { userId: 42, roles: ['USER'], username: 'u42' };

const feedbackService = {} as FeedbackService;

const liveItems = (): PersonalInboxItem[] => [
  {
    id: 'work_item:1',
    kind: 'work_item',
    origin: 'Workflow',
    originDetail: 'TASK',
    title: 'Do thing',
    summary: null,
    surfacedAt: '2026-10-05T12:00:00.000Z',
    attention: 'action_required',
    href: 'my-inbox?workItemId=1',
    ref: { type: 'work_item', id: 1 },
  },
  {
    id: 'alert:9',
    kind: 'alert',
    origin: 'Alert',
    originDetail: 'agent',
    title: 'Ping',
    summary: 'Body',
    surfacedAt: '2026-10-04T08:00:00.000Z',
    attention: 'unread',
    href: 'my-inbox',
    ref: { type: 'notification', id: 9 },
  },
  {
    id: 'feedback:3',
    kind: 'feedback',
    origin: 'Feedback',
    originDetail: 'Mine',
    title: 'Ticket',
    summary: 'Hi',
    surfacedAt: '2026-10-03T08:00:00.000Z',
    attention: 'none',
    href: 'my-feedback?ticket=3',
    ref: { type: 'feedback', id: 3 },
  },
];

describe('PersonalInboxService (projection mode)', () => {
  let sequelize: Sequelize;
  let repo: PersonalInboxProjectionRepository;
  let service: PersonalInboxService;

  beforeEach(async () => {
    vi.mocked(collectPersonalInboxItems).mockReset();
    vi.mocked(collectPersonalInboxItems).mockResolvedValue(liveItems());

    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    configurePersonalInboxProjectionSequelizeForTests(sequelize);
    configurePersonalInboxArchivedSequelizeForTests(sequelize);
    await ensurePersonalInboxProjectionTables(sequelize);
    await ensurePersonalInboxArchivedTables(sequelize);
    repo = new PersonalInboxProjectionRepository();
    service = new PersonalInboxService(feedbackService, {
      readMode: 'projection',
      projectionRepository: repo,
    });
  });

  afterEach(async () => {
    configurePersonalInboxProjectionSequelizeForTests(null);
    configurePersonalInboxArchivedSequelizeForTests(null);
    resetPersonalInboxProjectionModelCacheForTests();
    resetPersonalInboxArchivedModelCacheForTests();
    await sequelize.close();
  });

  it('refreshes from live collector on first read and serves stored rows', async () => {
    const list = await service.list(auth, { take: 10 });
    expect(collectPersonalInboxItems).toHaveBeenCalledTimes(1);
    expect(list.total).toBe(3);
    expect(list.items.map((i) => i.id)).toEqual(['work_item:1', 'alert:9', 'feedback:3']);

    vi.mocked(collectPersonalInboxItems).mockClear();
    vi.mocked(collectPersonalInboxItems).mockResolvedValue([]);

    const cached = await service.list(auth, { take: 10 });
    expect(collectPersonalInboxItems).not.toHaveBeenCalled();
    expect(cached.total).toBe(3);
  });

  it('re-collects after projection meta is marked stale', async () => {
    await service.list(auth);
    vi.mocked(collectPersonalInboxItems).mockClear();

    await repo.markStale(auth.userId);
    vi.mocked(collectPersonalInboxItems).mockResolvedValue([
      liveItems()[0],
    ]);

    const list = await service.list(auth);
    expect(collectPersonalInboxItems).toHaveBeenCalledTimes(1);
    expect(list.total).toBe(1);
    expect(list.items[0]?.id).toBe('work_item:1');
  });

  it('filters by kind from projection without re-running live collector when fresh', async () => {
    await service.list(auth);
    vi.mocked(collectPersonalInboxItems).mockClear();

    const feedbackOnly = await service.list(auth, { kind: 'feedback' });
    expect(collectPersonalInboxItems).not.toHaveBeenCalled();
    expect(feedbackOnly.total).toBe(1);
    expect(feedbackOnly.items[0]?.kind).toBe('feedback');
  });

  it('summary uses projection counts and preview', async () => {
    const summary = await service.summary(auth);
    expect(collectPersonalInboxItems).toHaveBeenCalledTimes(1);
    expect(summary.attentionCount).toBe(2);
    expect(summary.breakdown).toEqual({ workItems: 1, feedback: 0, alerts: 1 });
    expect(summary.preview.map((p) => p.id)).toEqual(['work_item:1', 'alert:9', 'feedback:3']);
  });

  it('re-collects when refreshed_at is older than TTL', async () => {
    await service.list(auth);
    const Meta = getPersonalInboxProjectionMetaModel(sequelize);
    const stale = new Date(Date.now() - 60_000);
    await Meta.update({ refreshedAt: stale }, { where: { userId: auth.userId } });

    vi.mocked(collectPersonalInboxItems).mockClear();
    vi.mocked(collectPersonalInboxItems).mockResolvedValue(liveItems());

    await service.list(auth);
    expect(collectPersonalInboxItems).toHaveBeenCalledTimes(1);
  });
});
