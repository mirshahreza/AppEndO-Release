import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The successful-EMAIL-send branch of `dispatchNotification` can't be exercised in a real-DB
 * integration test in this repo: doing so would require `bootstrapAuthE2eEnvironment`'s app-settings
 * cache init, which routes through a schema-push code path this repo's own CLI safety guard
 * (`controlPlaneSchemaPush.ts`) refuses to run for an AI agent — confirmed by hitting that refusal
 * while writing `notificationDispatch.test.ts` (see that file's own comment). This mocked unit test
 * — same style as `userNotification.service.test.ts` — covers exactly the one branch that leaves
 * uncovered otherwise: a successful `sendEmail` must short-circuit before the IN_APP fallback.
 */
const getUserNotificationPreference = vi.fn();
const queueNotificationDigestItem = vi.fn();
const createUserNotification = vi.fn();
const findUserIdEmail = vi.fn();
const sendEmail = vi.fn();
const listRoleMemberSummaries = vi.fn();
const createUserMessageDispatch = vi.fn(async () => ({ id: 1 }));

vi.mock('../userMessageDispatch.service', () => ({
  createUserMessageDispatch: (...args: unknown[]) => createUserMessageDispatch(...args),
  mergeDispatchMetadata: (metadata: unknown, link: { dispatchId: number; correlationId: string }) => ({
    ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
    msgiDispatchId: link.dispatchId,
    msgiCorrelationId: link.correlationId,
  }),
  newMessageDispatchCorrelationId: () => 'corr-test',
}));

vi.mock('../../../domain/users/userNotificationPreferenceRepository', () => ({
  getUserNotificationPreference: (...args: unknown[]) => getUserNotificationPreference(...args),
}));
vi.mock('../../../domain/users/userNotificationDigestRepository', () => ({
  queueNotificationDigestItem: (...args: unknown[]) => queueNotificationDigestItem(...args),
}));
vi.mock('../userNotification.service', () => ({
  createUserNotification: (...args: unknown[]) => createUserNotification(...args),
  parseNotificationUserId: (v: unknown) => (typeof v === 'number' ? v : null),
}));
vi.mock('../../../domain/users/userRepository', () => ({
  findUserIdEmail: (...args: unknown[]) => findUserIdEmail(...args),
}));
vi.mock('../../../domain/users/userRoleRepository', () => ({
  listRoleMemberSummaries: (...args: unknown[]) => listRoleMemberSummaries(...args),
}));
vi.mock('../../email/email.service', () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

import { dispatchNotification } from '../notificationDispatch';

describe('dispatchNotification — successful EMAIL send (mocked, HWF-4.2)', () => {
  beforeEach(() => {
    createUserNotification.mockResolvedValue({ id: 99 });
    createUserMessageDispatch.mockResolvedValue({ id: 1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('a successful sendEmail short-circuits before the IN_APP fallback', async () => {
    getUserNotificationPreference.mockResolvedValue({ channel: 'EMAIL', digest: false });
    findUserIdEmail.mockResolvedValue({ id: 7, email: 'user@example.test' });
    sendEmail.mockResolvedValue({ delivered: true, mode: 'smtp' });

    await dispatchNotification({ userId: 7, title: 'Hi', body: 'Body', eventType: 'workflow.comment' });

    expect(sendEmail).toHaveBeenCalledWith({ to: 'user@example.test', subject: 'Hi', text: 'Body' });
    expect(createUserNotification).not.toHaveBeenCalled();
    expect(queueNotificationDigestItem).not.toHaveBeenCalled();
    expect(createUserMessageDispatch).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      channel: 'EMAIL',
      deliveryStatus: 'sent',
    }));
  });

  it('a thrown sendEmail error still falls back to IN_APP (mocked equivalent of the real-DB failure test)', async () => {
    getUserNotificationPreference.mockResolvedValue({ channel: 'EMAIL', digest: false });
    findUserIdEmail.mockResolvedValue({ id: 7, email: 'user@example.test' });
    sendEmail.mockRejectedValue(new Error('SMTP auth failed'));

    await dispatchNotification({ userId: 7, title: 'Hi', body: 'Body', eventType: 'workflow.comment' });

    expect(createUserNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, title: 'Hi', body: 'Body', source: 'workflow.comment' }));
  });
});
