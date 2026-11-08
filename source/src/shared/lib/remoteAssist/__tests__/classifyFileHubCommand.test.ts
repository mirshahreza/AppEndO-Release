import { describe, expect, it } from 'vitest';
import { classifyFileHubCommand } from '../classifyFileHubCommand';

describe('classifyFileHubCommand', () => {
  it('treats listing and navigation as read', () => {
    expect(classifyFileHubCommand('ls -la /var/www')).toBe('read');
    expect(classifyFileHubCommand('pwd')).toBe('read');
    expect(classifyFileHubCommand('cd logs')).toBe('read');
  });

  it('treats mkdir, rm, and rename as write', () => {
    expect(classifyFileHubCommand('mkdir backup')).toBe('write');
    expect(classifyFileHubCommand('rm old.txt')).toBe('write');
    expect(classifyFileHubCommand('rename a.txt b.txt')).toBe('write');
  });
});
