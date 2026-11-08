import { describe, expect, it } from 'vitest';
import { isAccessAssistantPageEligible } from '../pageEligibility';

describe('isAccessAssistantPageEligible', () => {
  it('allows Records pages like users', () => {
    expect(isAccessAssistantPageEligible('users')).toBe(true);
    expect(isAccessAssistantPageEligible('roles')).toBe(true);
  });

  it('blocks Development and Extensions nav pages', () => {
    expect(isAccessAssistantPageEligible('data-studio')).toBe(false);
    expect(isAccessAssistantPageEligible('server-functions')).toBe(false);
    expect(isAccessAssistantPageEligible('package-manager')).toBe(false);
  });
});
