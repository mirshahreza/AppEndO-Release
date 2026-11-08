import { useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppBootQuery } from '../../../shared/api/queries/boot';
import type { FeedbackBootPolicy } from '../../../shared/api/contracts/feedback/types';
import { DEFAULT_PLATFORM_FEEDBACK_POLICY } from '../../../shared/api/contracts/feedback/constants';
import { useViewportTier } from '../../../shared/lib/useViewportTier';
import { resolveFeedbackShellVisibility } from '../feedbackShellVisibility';

const DISABLED_POLICY: FeedbackBootPolicy = {
  enabled: false,
  allowAuthenticated: false,
  allowAnonymous: false,
  showContactFieldsForAnonymous: false,
  requireSubject: false,
  allowAttachments: false,
  widgetPlacement: 'header-menu',
  showOnDashboard: false,
  pageKeyDenylist: [],
  subjects: [],
};

export function useFeedbackPolicy(pageKey?: string | null) {
  const bootQuery = useAppBootQuery();
  const { currentUser } = useAuth();
  const viewportTier = useViewportTier();
  const policy = bootQuery.data?.feedbackPolicy ?? DISABLED_POLICY;

  const visibility = useMemo(
    () => resolveFeedbackShellVisibility(policy, pageKey, {
      isAuthenticated: Boolean(currentUser),
      viewportTier,
    }),
    [currentUser, pageKey, policy, viewportTier],
  );

  return {
    policy,
    isLoading: bootQuery.isLoading,
    isVisibleOnPage: visibility.isVisibleOnPage,
    canSubmit: visibility.canSubmit,
    showHeaderButton: visibility.showHeaderButton,
    showFab: visibility.showFab,
    showOnDashboard: policy.enabled && policy.showOnDashboard,
  };
}

export function useFeedbackPolicyDefaults(): FeedbackBootPolicy {
  const policy = DEFAULT_PLATFORM_FEEDBACK_POLICY;
  return {
    enabled: policy.enabled,
    allowAuthenticated: policy.allowAuthenticated,
    allowAnonymous: policy.allowAnonymous,
    showContactFieldsForAnonymous: policy.showContactFieldsForAnonymous,
    requireSubject: policy.requireSubject,
    allowAttachments: policy.allowAttachments,
    widgetPlacement: policy.widgetPlacement,
    showOnDashboard: policy.showOnDashboard,
    pageKeyDenylist: [...policy.pageKeyDenylist],
    subjects: [],
  };
}
