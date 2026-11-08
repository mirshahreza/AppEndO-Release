import { useCulture } from '../../../core/culture/CultureContext';
import { useHwyNavPageShellHeader } from '../../../domain/vx/vxNavPageShellHeader';

const PAGE_KEY = 'my-inbox';

/** Shell header parity with Vertical list pages — title + nav description, no studio nav group prefix. */
export function usePersonalInboxShellHeader(): void {
  const culture = useCulture();
  useHwyNavPageShellHeader({
    pageKey: PAGE_KEY,
    cultureId: culture.cultureId,
    t: culture.t,
    fallbackLabel: 'Inbox',
    icon: 'Inbox',
  });
}
