import { describe, expect, it } from 'vitest';
import { formatFileHubSnapshot, parseFileHubAiCommand } from '../fileHubAiCommands';

describe('parseFileHubAiCommand', () => {
  it('parses listing and navigation against the current folder', () => {
    expect(parseFileHubAiCommand('ls', '/var/www')).toEqual({
      ok: true,
      op: { kind: 'list', path: '/var/www' },
    });
    expect(parseFileHubAiCommand('cd logs', '/var/www')).toEqual({
      ok: true,
      op: { kind: 'cd', path: '/var/www/logs' },
    });
    expect(parseFileHubAiCommand('pwd', '/var/www')).toEqual({
      ok: true,
      op: { kind: 'pwd' },
    });
  });

  it('parses mutating file commands', () => {
    expect(parseFileHubAiCommand('mkdir backup', '/var/www')).toEqual({
      ok: true,
      op: { kind: 'mkdir', path: '/var/www/backup' },
    });
    expect(parseFileHubAiCommand('rm old.txt', '/var/www')).toEqual({
      ok: true,
      op: { kind: 'delete', path: '/var/www/old.txt' },
    });
    expect(parseFileHubAiCommand('rename a.txt b.txt', '/var/www')).toEqual({
      ok: true,
      op: { kind: 'rename', from: '/var/www/a.txt', to: '/var/www/b.txt' },
    });
  });

  it('rejects unknown verbs', () => {
    expect(parseFileHubAiCommand('put file.bin', '/')).toEqual({
      ok: false,
      error: 'Unsupported File Hub command: put',
    });
  });
});

describe('formatFileHubSnapshot', () => {
  it('renders protocol, path, and entries', () => {
    expect(formatFileHubSnapshot({
      protocol: 'sftp',
      path: '/var/www',
      items: [
        { name: 'html', type: 'directory', size: 0, modifyTime: null, permissions: '755' },
        { name: 'index.html', type: 'file', size: 12, modifyTime: null, permissions: '644' },
      ],
    })).toContain('d\thtml');
  });
});
