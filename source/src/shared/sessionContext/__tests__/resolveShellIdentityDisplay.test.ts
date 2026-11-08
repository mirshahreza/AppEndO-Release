import { describe, expect, it } from 'vitest';
import { resolveShellIdentityDisplay } from '../resolveShellIdentityDisplay';

describe('resolveShellIdentityDisplay', () => {
  it('prefers first name and last name for header label and builds avatar from image flag', () => {
    const identity = resolveShellIdentityDisplay({
      'user.id': 7,
      'user.username': 'ada',
      'user.email': 'ada@append.test',
      'user.firstname': 'Ada',
      'user.lastname': 'Lovelace',
      'user.profile_image': true,
      'user.has_profile_image_xs': true,
      'user.profile_updated_at': '2026-01-01T00:00:00.000Z',
    });

    expect(identity.displayName).toBe('Ada Lovelace');
    expect(identity.avatarInitial).toBe('A');
    expect(identity.avatarXs).toContain('/api/users/7/avatar-xs');
    expect(identity.firstname).toBe('Ada');
    expect(identity.lastname).toBe('Lovelace');
  });

  it('falls back to username only when names are absent', () => {
    const identity = resolveShellIdentityDisplay({
      'user.id': 3,
      'user.username': 'bot',
      'user.email': 'bot@append.test',
      'user.firstname': null,
      'user.lastname': null,
      'user.profile_image': false,
    });

    expect(identity.displayName).toBe('bot');
    expect(identity.avatarXs).toBeNull();
  });

  it('uses fallback user id for avatar when context id is missing but image is present', () => {
    const identity = resolveShellIdentityDisplay({
      'user.firstname': 'Ada',
      'user.lastname': 'Lovelace',
      'user.profile_image': true,
    }, { fallbackUserId: 9 });

    expect(identity.displayName).toBe('Ada Lovelace');
    expect(identity.avatarXs).toBe('/api/users/9/avatar-xs');
  });
});
