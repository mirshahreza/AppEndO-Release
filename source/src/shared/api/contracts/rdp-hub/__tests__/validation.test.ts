import { describe, expect, it } from 'vitest';
import {
  isWellFormedRdpHost,
  isWellFormedRdpUsername,
  parseRdpHubPort,
  parseRdpHubSecurity,
  sanitizeRdpHubConnectionKey,
  sanitizeRdpHubTags,
  validateRdpHubDomain,
  validateRdpHubHost,
  validateRdpHubUsername,
} from '../validation';

describe('rdp-hub validation', () => {
  it('accepts hostnames, IPv4, and bracketed IPv6', () => {
    expect(isWellFormedRdpHost('jump.internal.example')).toBe(true);
    expect(isWellFormedRdpHost('127.0.0.1')).toBe(true);
    expect(isWellFormedRdpHost('2001:db8::1')).toBe(true);
    expect(isWellFormedRdpHost('[2001:db8::1]')).toBe(true);
    expect(validateRdpHubHost('bad host')).toMatch(/valid hostname/i);
    expect(validateRdpHubHost('')).toMatch(/required/i);
  });

  it('accepts Windows usernames and UPN forms', () => {
    expect(isWellFormedRdpUsername('Administrator')).toBe(true);
    expect(isWellFormedRdpUsername('admin@corp.local')).toBe(true);
    expect(validateRdpHubUsername('root;id')).toMatch(/Username/i);
    expect(validateRdpHubUsername('a b')).toMatch(/Username/i);
  });

  it('parses ports, security, domain, and catalog fields', () => {
    expect(parseRdpHubPort(3389)).toBe(3389);
    expect(parseRdpHubPort('65535')).toBe(65535);
    expect(parseRdpHubPort(0)).toBeNull();
    expect(parseRdpHubSecurity('nla')).toBe('nla');
    expect(parseRdpHubSecurity('ssh')).toBeNull();
    expect(validateRdpHubDomain('CORP')).toBeNull();
    expect(validateRdpHubDomain('bad domain')).toMatch(/Domain/i);
    expect(sanitizeRdpHubConnectionKey('Win Jump')).toBe('winjump');
    expect(sanitizeRdpHubTags([' Prod ', 'prod', 'edge'])).toEqual(['Prod', 'edge']);
  });
});
