import { useCulture } from '../../../core/culture/CultureContext';
import { useHwyNavPageShellHeader } from '../../../domain/hwy/hwyNavPageShellHeader';

const PAGE_KEY = 'my-inbox';

/** Shell header parity with Hawiety list pages — culture label + nav description; nav group comes from shell merge. */
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
