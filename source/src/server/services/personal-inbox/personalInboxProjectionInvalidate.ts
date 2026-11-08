import { personalInboxProjectionRepository } from '../../domain/personal-inbox/personalInboxProjection.repository';

/** Mark cached inbox rows stale so the next read refreshes from live sources. */
export function invalidatePersonalInboxProjection(userId: number): void {
  void personalInboxProjectionRepository.markStale(userId).catch(() => undefined);
}
