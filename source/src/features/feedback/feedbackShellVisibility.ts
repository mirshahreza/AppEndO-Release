import type { FeedbackBootPolicy } from '../../shared/api/contracts/feedback/types';
import type { ViewportTier } from '../../shared/lib/viewportTokens';

export type FeedbackShellVisibility = {
  isVisibleOnPage: boolean;
  canSubmit: boolean;
  showHeaderButton: boolean;
  showFab: boolean;
};

export function isFeedbackDeniedOnPage(
  policy: Pick<FeedbackBootPolicy, 'pageKeyDenylist'>,
  pageKey?: string | null,
): boolean {
  const key = pageKey?.trim();
  return Boolean(key && policy.pageKeyDenylist.includes(key));
}

export function resolveFeedbackShellVisibility(
  policy: FeedbackBootPolicy,
  pageKey?: string | null,
  options?: { isAuthenticated?: boolean; viewportTier?: ViewportTier },
): FeedbackShellVisibility {
  const deniedOnPage = isFeedbackDeniedOnPage(policy, pageKey);
  const isVisibleOnPage = policy.enabled && !deniedOnPage;
  const authKnown = options?.isAuthenticated != null;
  const canSubmit = authKnown
    ? policy.enabled && (
      (policy.allowAuthenticated && options.isAuthenticated)
      || (policy.allowAnonymous && !options.isAuthenticated)
    )
    : policy.enabled && (policy.allowAuthenticated || policy.allowAnonymous);
  const canShowShellEntry = isVisibleOnPage && canSubmit;
  const isPhone = options?.viewportTier === 'phone';

  return {
    isVisibleOnPage,
    canSubmit,
    showHeaderButton: canShowShellEntry && !isPhone,
    showFab: canShowShellEntry && (isPhone || policy.widgetPlacement === 'fab'),
  };
}
