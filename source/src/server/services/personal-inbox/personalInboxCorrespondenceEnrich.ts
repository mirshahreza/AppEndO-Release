import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import { personalInboxCorrespondenceRepository } from '../../domain/personal-inbox/personalInboxCorrespondence.repository';

export async function enrichPersonalInboxCorrespondence(
  userId: number,
  items: PersonalInboxItem[],
): Promise<PersonalInboxItem[]> {
  if (items.length === 0) {
    return items;
  }
  const flags = await personalInboxCorrespondenceRepository.listFlagsForUser(
    userId,
    items.map((item) => item.id),
  );
  return items.map((item) => {
    const correspondence = flags.get(item.id.trim());
    if (!correspondence?.replied && !correspondence?.forwarded) {
      return item;
    }
    return {
      ...item,
      correspondence: {
        replied: correspondence.replied,
        forwarded: correspondence.forwarded,
      },
    };
  });
}
