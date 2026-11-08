import { describe, expect, it } from 'vitest';
import { classifyShellCommand } from '../classifyShellCommand';

describe('classifyShellCommand', () => {
  it('treats inspection commands as read', () => {
    expect(classifyShellCommand('ls -la')).toBe('read');
    expect(classifyShellCommand('df -h')).toBe('read');
    expect(classifyShellCommand('git status')).toBe('read');
    expect(classifyShellCommand('cd /var/www && ls')).toBe('read');
    expect(classifyShellCommand('sudo cat /etc/os-release')).toBe('read');
  });

  it('treats mutating commands as write', () => {
    expect(classifyShellCommand('rm -rf /tmp/old')).toBe('write');
    expect(classifyShellCommand('mkdir backup')).toBe('write');
    expect(classifyShellCommand('git commit -am "wip"')).toBe('write');
    expect(classifyShellCommand('systemctl restart nginx')).toBe('write');
    expect(classifyShellCommand('echo hi > out.txt')).toBe('write');
  });

  it('does not treat a quoted greater-than as a redirect', () => {
    expect(classifyShellCommand('echo "a > b"')).toBe('read');
  });

  it('marks a pipeline write if any statement writes', () => {
    expect(classifyShellCommand('ls | grep log && rm old.log')).toBe('write');
  });
});
