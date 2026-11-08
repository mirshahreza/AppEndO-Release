import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';
import {
  buildZipEntryTree,
  deleteZipEntryTree,
  moveZipEntryToPath,
  renameZipEntryInArchive,
  validateZipInternalEntryPath,
} from '../zipArchive';

describe('zipArchive', () => {
  it('validates internal zip entry paths', () => {
    expect(validateZipInternalEntryPath('folder/file.txt')).toEqual({
      ok: true,
      normalized: 'folder/file.txt',
    });
    expect(validateZipInternalEntryPath('../escape.txt').ok).toBe(false);
  });

  it('builds a nested zip entry tree', () => {
    const zip = new AdmZip();
    zip.addFile('readme.txt', Buffer.from('hello'));
    zip.addFile('nested/child.txt', Buffer.from('child'));
    zip.addFile('nested/deep/grand.txt', Buffer.from('deep'));

    const tree = buildZipEntryTree(zip);
    expect(tree).toHaveLength(2);
    expect(tree.find((entry) => entry.name === 'nested')?.children).toHaveLength(2);
  });

  it('moves and renames entries inside a zip archive', () => {
    const zip = new AdmZip();
    zip.addFile('alpha.txt', Buffer.from('a'));
    zip.addFile('folder/beta.txt', Buffer.from('b'));

    const moved = moveZipEntryToPath(zip, 'alpha.txt', 'folder/alpha.txt');
    expect(moved.ok).toBe(true);
    expect(zip.getEntry('alpha.txt')).toBeNull();
    expect(zip.getEntry('folder/alpha.txt')?.getData().toString('utf8')).toBe('a');

    const renamed = renameZipEntryInArchive(zip, 'folder/beta.txt', 'gamma.txt');
    expect(renamed.ok).toBe(true);
    expect(zip.getEntry('folder/gamma.txt')?.getData().toString('utf8')).toBe('b');
  });

  it('deletes a folder subtree from a zip archive', () => {
    const zip = new AdmZip();
    zip.addFile('keep.txt', Buffer.from('keep'));
    zip.addFile('remove/me.txt', Buffer.from('gone'));
    zip.addFile('remove/nested/leaf.txt', Buffer.from('gone'));

    const removed = deleteZipEntryTree(zip, 'remove');
    expect(removed).toBeGreaterThan(0);
    expect(zip.getEntry('keep.txt')).not.toBeNull();
    expect(zip.getEntry('remove/me.txt')).toBeNull();
    expect(zip.getEntry('remove/nested/leaf.txt')).toBeNull();
  });
});
