import studioNav from '../../../config/platform-registry/navigation/studio.json';
import type { NavigationManifest } from '../../api/contracts/platform/navigation';
import { collectExcludedAccessAssistantPageKeys } from './excludedNavPageKeys';

const EXCLUDED_PAGE_KEYS = collectExcludedAccessAssistantPageKeys(
  studioNav as NavigationManifest,
);

export function isAccessAssistantPageEligible(pageKey: string): boolean {
  const key = pageKey.trim();
  return key.length > 0 && !EXCLUDED_PAGE_KEYS.has(key);
}

export function accessAssistantIneligibleReason(pageKey: string): string | undefined {
  if (!pageKey.trim()) {
    return 'No page context.';
  }
  if (!isAccessAssistantPageEligible(pageKey)) {
    return 'Not available on developer or extension admin pages.';
  }
  return undefined;
}
