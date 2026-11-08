import type { PersonalInboxAttention } from '../../../shared/api/contracts/personal-inbox/types';
import { getPersonalInboxProjectionItemModel } from '../../domain/personal-inbox/personalInboxProjectionSequelizeModels';

/** Keep bell/summary in sync without waiting for projection TTL refresh. */
export async function patchPersonalInboxProjectionAttention(
  userId: number,
  itemKey: string,
  attention: PersonalInboxAttention,
): Promise<void> {
  const Item = getPersonalInboxProjectionItemModel();
  const row = await Item.findOne({ where: { userId, itemKey } });
  if (!row) {
    return;
  }
  await row.update({ attention, updatedAt: new Date() });
}

export async function removePersonalInboxProjectionItem(userId: number, itemKey: string): Promise<void> {
  const Item = getPersonalInboxProjectionItemModel();
  await Item.destroy({ where: { userId, itemKey } });
}
