import { describe, expect, it } from 'vitest';
import type { FeedbackBootPolicy } from '../../../shared/api/contracts/feedback/types';
import { resolveFeedbackShellVisibility } from '../feedbackShellVisibility';

const enabledPolicy = (patch: Partial<FeedbackBootPolicy> = {}): FeedbackBootPolicy => ({
  enabled: true,
  allowAuthenticated: true,
  allowAnonymous: false,
  showContactFieldsForAnonymous: true,
  requireSubject: true,
  allowAttachments: true,
  widgetPlacement: 'header-menu',
  showOnDashboard: true,
  pageKeyDenylist: ['auth', 'install'],
  subjects: [],
  ...patch,
});

describe('resolveFeedbackShellVisibility', () => {
  it('shows the header button on standard pages when feedback is enabled', () => {
    const result = resolveFeedbackShellVisibility(enabledPolicy(), 'users');
    expect(result.showHeaderButton).toBe(true);
    expect(result.showFab).toBe(false);
  });

  it('shows the header button on Settings so operators can verify the entry while configuring', () => {
    const result = resolveFeedbackShellVisibility(enabledPolicy(), 'settings');
    expect(result.showHeaderButton).toBe(true);
  });

  it('shows the header button even when placement is footer-link', () => {
    const result = resolveFeedbackShellVisibility(
      enabledPolicy({ widgetPlacement: 'footer-link' }),
      'dashboard',
    );
    expect(result.showHeaderButton).toBe(true);
    expect(result.showFab).toBe(false);
  });

  it('shows the floating button when placement is fab', () => {
    const result = resolveFeedbackShellVisibility(
      enabledPolicy({ widgetPlacement: 'fab' }),
      'dashboard',
    );
    expect(result.showHeaderButton).toBe(true);
    expect(result.showFab).toBe(true);
  });

  it('hides shell entry points on denylisted pages', () => {
    const result = resolveFeedbackShellVisibility(enabledPolicy(), 'auth');
    expect(result.showHeaderButton).toBe(false);
    expect(result.showFab).toBe(false);
  });

  it('hides shell entry for signed-out users when anonymous feedback is disabled', () => {
    const result = resolveFeedbackShellVisibility(enabledPolicy(), 'dashboard', { isAuthenticated: false });
    expect(result.showHeaderButton).toBe(false);
    expect(result.showFab).toBe(false);
  });

  it('shows shell entry for signed-in users when authenticated feedback is enabled', () => {
    const result = resolveFeedbackShellVisibility(enabledPolicy(), 'dashboard', { isAuthenticated: true });
    expect(result.showHeaderButton).toBe(true);
  });

  it('moves the shell entry to the FAB on phone and keeps the header button on tablet', () => {
    const phone = resolveFeedbackShellVisibility(enabledPolicy(), 'users', { viewportTier: 'phone' });
    expect(phone.showHeaderButton).toBe(false);
    expect(phone.showFab).toBe(true);

    const tablet = resolveFeedbackShellVisibility(enabledPolicy(), 'users', { viewportTier: 'tablet' });
    expect(tablet.showHeaderButton).toBe(true);
    expect(tablet.showFab).toBe(false);
  });
});
