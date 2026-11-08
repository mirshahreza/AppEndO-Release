import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  configureUserMessageDispatchSequelizeForTests,
  ensureUserMessageDispatchTables,
  resetUserMessageDispatchModelCacheForTests,
} from '../../../domain/user-message-dispatches/userMessageDispatchSequelizeModels';
import {
  createUserMessageDispatch,
  listUserMessageDispatches,
  markUserMessageDispatchesSentForDigestItems,
  newMessageDispatchCorrelationId,
} from '../userMessageDispatch.service';

let sequelize: Sequelize;

beforeEach(async () => {
  resetUserMessageDispatchModelCacheForTests();
  sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  configureUserMessageDispatchSequelizeForTests(sequelize);
  await ensureUserMessageDispatchTables(sequelize);
});

afterEach(async () => {
  configureUserMessageDispatchSequelizeForTests(null);
  resetUserMessageDispatchModelCacheForTests();
  await sequelize.close();
});

describe('userMessageDispatch.service', () => {
  it('creates and lists dispatches for the recipient', async () => {
    const correlationId = newMessageDispatchCorrelationId();
    await createUserMessageDispatch({
      userId: 3,
      correlationId,
      eventType: 'workflow.comment',
      channel: 'IN_APP',
      deliveryStatus: 'sent',
      title: 'Hi',
      body: 'Body text',
      inAppNotificationId: 9,
    });
    const items = await listUserMessageDispatches(3);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      channel: 'IN_APP',
      deliveryStatus: 'sent',
      title: 'Hi',
      inAppNotificationId: 9,
    });
  });

  it('marks digest-linked rows sent with a batch id', async () => {
    const { id } = await createUserMessageDispatch({
      userId: 5,
      correlationId: newMessageDispatchCorrelationId(),
      eventType: 'workflow',
      channel: 'EMAIL',
      deliveryStatus: 'digest_pending',
      title: 'Queued',
      body: 'Waiting',
    });
    const updated = await markUserMessageDispatchesSentForDigestItems(
      [{ userId: 5, metadataJson: JSON.stringify({ msgiDispatchId: id }) }],
      'batch-abc',
    );
    expect(updated).toBe(1);
    const items = await listUserMessageDispatches(5);
    expect(items[0].deliveryStatus).toBe('sent');
    expect(items[0].digestBatchId).toBe('batch-abc');
  });
});
