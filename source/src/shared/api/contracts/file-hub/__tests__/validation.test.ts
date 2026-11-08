import { describe, expect, it } from 'vitest';
import {
  joinRemotePath,
  parentRemotePath,
  parseFileHubPort,
  parseFileHubProtocol,
  sanitizeFileHubConnectionKey,
  sanitizeFileHubTags,
  sanitizeRemoteEntryName,
  sanitizeRemotePath,
  validateFileHubHost,
  validateFileHubUsername,
} from '../validation';

describe('file-hub validation', () => {
  it('accepts hostnames and rejects injection-like usernames', () => {
    expect(validateFileHubHost('files.internal.example')).toBeNull();
    expect(validateFileHubHost('127.0.0.1')).toBeNull();
    expect(validateFileHubHost('bad host')).toMatch(/valid hostname/i);
    expect(validateFileHubUsername('deploy')).toBeNull();
    expect(validateFileHubUsername('root;id')).toMatch(/Username/i);
  });

  it('parses protocol and port', () => {
    expect(parseFileHubProtocol('sftp')).toBe('sftp');
    expect(parseFileHubProtocol('ftp')).toBe('ftp');
    expect(parseFileHubProtocol('ssh')).toBeNull();
    expect(parseFileHubPort(21)).toBe(21);
    expect(parseFileHubPort(0)).toBeNull();
    expect(sanitizeFileHubConnectionKey('Prod Files')).toBe('prodfiles');
    expect(sanitizeFileHubTags([' Prod ', 'prod', 'edge'])).toEqual(['Prod', 'edge']);
  });

  it('sanitizes remote paths and blocks traversal', () => {
    expect(sanitizeRemotePath('/var/www/html')).toBe('/var/www/html');
    expect(sanitizeRemotePath('/var/www/../html')).toBe('/var/html');
    expect(sanitizeRemotePath('/var/www/../../etc/passwd')).toBe('/etc/passwd');
    expect(sanitizeRemotePath('/')).toBe('/');
    expect(sanitizeRemotePath('')).toBe('/');
    expect(sanitizeRemotePath('../etc/passwd')).toBeNull();
    expect(sanitizeRemotePath('/tmp/file\0.txt')).toBeNull();
    expect(sanitizeRemotePath('C:\\Windows')).toBeNull();
    expect(sanitizeRemotePath('sftp://evil')).toBeNull();
    expect(sanitizeRemoteEntryName('../secret')).toBeNull();
    expect(sanitizeRemoteEntryName('readme.txt')).toBe('readme.txt');
    expect(joinRemotePath('/var/www', 'index.html')).toBe('/var/www/index.html');
    expect(joinRemotePath('/var/www', '../etc')).toBeNull();
    expect(parentRemotePath('/var/www/html')).toBe('/var/www');
    expect(parentRemotePath('/')).toBe('/');
  });
});
