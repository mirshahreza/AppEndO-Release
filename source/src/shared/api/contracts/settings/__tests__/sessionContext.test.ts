import { describe, expect, it } from 'vitest';
import {
  attributeSessionSourceId,
  buildShellIdentitySourceEntries,
  buildSystemCapabilitySourceEntries,
  channelsFromVisibility,
  clientContextHasShellIdentity,
  parseAttributeSessionSourceId,
  parseProfileSessionSourceId,
  parseUserAccountSessionSourceId,
  visibilityFromChannels,
} from '../sessionContext';

describe('sessionContext contracts', () => {
  it('maps channel checkboxes to visibility', () => {
    expect(visibilityFromChannels(true, true)).toBe('BOTH');
    expect(visibilityFromChannels(true, false)).toBe('SERVER');
    expect(visibilityFromChannels(false, true)).toBe('CLIENT');
    expect(visibilityFromChannels(false, false)).toBe('NONE');
  });

  it('maps visibility back to channels', () => {
    expect(channelsFromVisibility('BOTH')).toEqual({ server: true, client: true });
    expect(channelsFromVisibility('SERVER')).toEqual({ server: true, client: false });
    expect(channelsFromVisibility('CLIENT')).toEqual({ server: false, client: true });
    expect(channelsFromVisibility('NONE')).toEqual({ server: false, client: false });
  });

  it('parses source ids', () => {
    expect(attributeSessionSourceId('USER', 'city')).toBe('attr:USER:city');
    expect(parseAttributeSessionSourceId('attr:ROLE:region')).toEqual({ scope: 'ROLE', key: 'region' });
    expect(parseProfileSessionSourceId('profile:firstname')).toBe('firstname');
    expect(parseUserAccountSessionSourceId('user:email')).toBe('email');
  });

  it('locks shell identity username, email, names, and profile image with both channels checked', () => {
    const entries = buildShellIdentitySourceEntries();
    const byKey = Object.fromEntries(entries.map((entry) => [entry.contextKey, entry]));

    for (const key of ['user.username', 'user.email', 'user.firstname', 'user.lastname', 'user.profile_image']) {
      expect(byKey[key]).toMatchObject({
        kind: 'shell_identity',
        locked: true,
        server: true,
        client: true,
        lockedReason: 'System identity',
      });
    }
    expect(buildSystemCapabilitySourceEntries().every((entry) => entry.locked && entry.server && entry.client)).toBe(true);
  });

  it('detects incomplete shell identity client context', () => {
    expect(clientContextHasShellIdentity({
      'sys.shellIdentityRev': 3,
      'user.id': 1,
      'user.username': 'ada',
      'user.email': 'ada@test',
      'user.firstname': 'Ada',
      'user.lastname': 'Lovelace',
      'user.profile_image': true,
      'user.has_profile_image_xs': true,
    })).toBe(true);
    expect(clientContextHasShellIdentity({
      'user.id': 1,
      'user.username': 'ada',
    })).toBe(false);
    expect(clientContextHasShellIdentity({
      'sys.shellIdentityRev': 2,
      'user.id': 1,
      'user.username': 'ada',
      'user.email': 'ada@test',
      'user.firstname': 'Ada',
      'user.lastname': 'Lovelace',
      'user.profile_image': true,
      'user.has_profile_image_xs': true,
    })).toBe(false);
  });
});
