import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it } from 'vitest';
import { packageBlobToken } from '../../../../core/packages/packageDbBlobPayload';
import {
  expandPackageDbScriptSql,
  loadBlobsFromArtifact,
  readSqlFromArtifact,
} from '../packageDbScripts.service';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('package DB blob install restore', () => {
  it('expands ZIP blob tokens to the original file bytes', () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const blobEntry = 'db/blobs/files/cms_content_assets_file_id=1.bin';
    const installSql = [
      'CREATE TABLE cms_content_assets (id INTEGER PRIMARY KEY, file BLOB NOT NULL);',
      `INSERT INTO cms_content_assets (id, file) VALUES (1, ${packageBlobToken(blobEntry)});`,
    ].join('\n');

    const zip = new AdmZip();
    zip.addFile('db/install.sql', Buffer.from(installSql, 'utf8'));
    zip.addFile(blobEntry, bytes);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-blob-install-'));
    tempDirs.push(dir);
    const artifactPath = path.join(dir, 'cms.zip');
    zip.writeZip(artifactPath);

    const blobs = loadBlobsFromArtifact(artifactPath);
    const sql = readSqlFromArtifact(artifactPath, 'db/install.sql');
    expect(sql).toBeTruthy();
    const expanded = expandPackageDbScriptSql(sql!, blobs, 'sqlite');
    expect(expanded).not.toContain('{{package_blob:');
    const hex = expanded.match(/X'([0-9a-f]+)'/i)?.[1];
    expect(hex).toBe('89504e47');
    expect(Buffer.from(hex ?? '', 'hex')).toEqual(bytes);

    const postgres = expandPackageDbScriptSql(sql!, blobs, 'postgres');
    expect(postgres).toContain("decode('89504e47', 'hex')");
  });
});
