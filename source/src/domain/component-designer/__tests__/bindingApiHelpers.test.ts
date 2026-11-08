import { describe, expect, it } from 'vitest';
import {
  collectTemplateParamNames,
  extractUrlTemplateParamNames,
  isNestedPayloadPath,
} from '../bindingApiHelpers';

describe('bindingApiHelpers', () => {
  it('extracts URL template parameter names', () => {
    expect(extractUrlTemplateParamNames('/api/users/{userId}/orders/{orderId}')).toEqual(['userId', 'orderId']);
    expect(extractUrlTemplateParamNames('/api/v1/user/profile')).toEqual([]);
  });

  it('collects template params from endpoint and headers', () => {
    expect(collectTemplateParamNames('/api/users/{userId}', { Authorization: 'Bearer {token}' })).toEqual([
      'userId',
      'token',
    ]);
  });

  it('detects nested payload paths', () => {
    expect(isNestedPayloadPath('user.profile.email')).toBe(true);
    expect(isNestedPayloadPath('email')).toBe(false);
  });
});
