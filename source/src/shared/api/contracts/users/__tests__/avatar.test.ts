import { describe, expect, it } from 'vitest';
import {
  buildUserAvatarXsPath,
  resolveListUserAvatarSrc,
  resolveUserAvatarCacheBust,
  resolveUserAvatarXsSrc,
} from '../avatar';

describe('buildUserAvatarXsPath', () => {
  it('returns the base avatar path without cache busting', () => {
    expect(buildUserAvatarXsPath(7)).toBe('/api/users/7/avatar-xs');
  });

  it('appends a version query param when cache bust is provided', () => {
    expect(buildUserAvatarXsPath(7, 12_345)).toBe('/api/users/7/avatar-xs?v=12345');
  });

  it('omits the version query param for empty cache bust values', () => {
    expect(buildUserAvatarXsPath(7, null)).toBe('/api/users/7/avatar-xs');
    expect(buildUserAvatarXsPath(7, '')).toBe('/api/users/7/avatar-xs');
  });
});

describe('resolveUserAvatarCacheBust', () => {
  it('prefers profile_updated_at over profile_image_size', () => {
    expect(resolveUserAvatarCacheBust({
      profile_updated_at: '2026-07-19T12:34:56.789Z',
      profile_image_size: 42,
    })).toBe(Date.parse('2026-07-19T12:34:56.789Z'));
  });

  it('falls back to profile_image_size when updated_at is missing', () => {
    expect(resolveUserAvatarCacheBust({ profile_image_size: 99 })).toBe(99);
  });
});

describe('resolveListUserAvatarSrc', () => {
  it('prefers the inline list preview over the remote avatar url', () => {
    expect(resolveListUserAvatarSrc({
      id: 4,
      has_profile_image_xs: true,
      list_avatar_preview: 'data:image/jpeg;base64,abc',
      profile_updated_at: '2026-07-19T12:34:56.789Z',
    })).toBe('data:image/jpeg;base64,abc');
  });

  it('prefers avatar_url over recomputing from flags', () => {
    expect(resolveListUserAvatarSrc({
      id: 4,
      has_profile_image_xs: false,
      avatar_url: '/api/users/4/avatar-xs?v=1',
    })).toBe('/api/users/4/avatar-xs?v=1');
  });
});

describe('resolveUserAvatarXsSrc', () => {
  it('returns null when the user has no xs avatar', () => {
    expect(resolveUserAvatarXsSrc({ id: 3, has_profile_image_xs: false })).toBeNull();
  });

  it('builds a versioned avatar url when xs avatar exists', () => {
    const updatedAt = '2026-07-19T12:34:56.789Z';
    expect(resolveUserAvatarXsSrc({
      id: 3,
      has_profile_image_xs: true,
      profile_updated_at: updatedAt,
    })).toBe(`/api/users/3/avatar-xs?v=${Date.parse(updatedAt)}`);
  });
});
