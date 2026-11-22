import { useCulture } from '../../../core/culture/CultureContext';
import { useExtxNavPageShellHeader } from '../../../oss/excludedModuleStub';

const PAGE_KEY = 'my-inbox';

/** Shell header parity with Portalx list pages — culture label + nav description; nav group comes from shell merge. */
export function usePersonalInboxShellHeader(): void {
  const culture = useCulture();
  useExtxNavPageShellHeader({
    pageKey: PAGE_KEY,
    cultureId: culture.cultureId,
    t: culture.t,
    fallbackLabel: 'Inbox',
    icon: 'Inbox',
  });
}
