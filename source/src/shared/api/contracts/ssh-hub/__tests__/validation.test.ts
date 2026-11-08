import { describe, expect, it } from 'vitest';
import {
  buildSshInitialCdInput,
  isWellFormedSshHost,
  isWellFormedSshUsername,
  parseSshHubPort,
  sanitizeSshHubConnectionKey,
  sanitizeSshHubTags,
  sanitizeSshInitialPath,
  validateSshHubHost,
  validateSshHubUsername,
} from '../validation';

describe('ssh-hub validation', () => {
  it('accepts hostnames, IPv4, and bracketed IPv6', () => {
    expect(isWellFormedSshHost('db.internal.example')).toBe(true);
    expect(isWellFormedSshHost('127.0.0.1')).toBe(true);
    expect(isWellFormedSshHost('2001:db8::1')).toBe(true);
    expect(isWellFormedSshHost('[2001:db8::1]')).toBe(true);
    expect(validateSshHubHost('bad host')).toMatch(/valid hostname/i);
    expect(validateSshHubHost('')).toMatch(/required/i);
  });

  it('rejects usernames that could be used for injection', () => {
    expect(isWellFormedSshUsername('deploy')).toBe(true);
    expect(isWellFormedSshUsername('deploy_user')).toBe(true);
    expect(validateSshHubUsername('root;id')).toMatch(/Username/i);
    expect(validateSshHubUsername('a b')).toMatch(/Username/i);
  });

  it('parses ports and sanitizes catalog fields', () => {
    expect(parseSshHubPort(22)).toBe(22);
    expect(parseSshHubPort('65535')).toBe(65535);
    expect(parseSshHubPort(0)).toBeNull();
    expect(sanitizeSshHubConnectionKey('Prod DB')).toBe('proddb');
    expect(sanitizeSshHubTags([' Prod ', 'prod', 'edge'])).toEqual(['Prod', 'edge']);
  });

  it('sanitizes the default working directory and builds a quoted cd command', () => {
    expect(sanitizeSshInitialPath('')).toBe('');
    expect(sanitizeSshInitialPath('~')).toBe('~');
    expect(sanitizeSshInitialPath('~/projects')).toBe('~/projects');
    expect(sanitizeSshInitialPath('/var/www/html')).toBe('/var/www/html');
    expect(sanitizeSshInitialPath('/var/www/../html')).toBe('/var/html');
    expect(sanitizeSshInitialPath('relative/path')).toBe('');
    expect(sanitizeSshInitialPath('/tmp\nid')).toBe('');
    expect(buildSshInitialCdInput('')).toBeNull();
    expect(buildSshInitialCdInput('~')).toBeNull();
    expect(buildSshInitialCdInput('/var/www')).toBe("cd -- '/var/www'\n");
    expect(buildSshInitialCdInput('~/proj')).toBe("cd -- ~/'proj'\n");
    expect(buildSshInitialCdInput('/tmp;id')).toBe("cd -- '/tmp;id'\n");
    expect(buildSshInitialCdInput("/tmp/o'reilly")).toBe("cd -- '/tmp/o'\\''reilly'\n");
  });
});
