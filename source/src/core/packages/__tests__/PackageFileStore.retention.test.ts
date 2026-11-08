import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-filestore-retention-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

const writeRuntimeSettings = (runtime: Record<string, unknown>) => {
  fs.writeFileSync(
    path.join(tmpDir, 'settings.json'),
    JSON.stringify({ runtime }, null, 2),
    'utf8',
  );
};

async function loadStore() {
  return import('../PackageFileStore');
}

describe('PackageFileStore retention and audit event format', () => {
  it('writes standardized audit fields for events', async () => {
    const store = await loadStore();
    store.ensurePackageStorageDirs();

    store.appendPackageEvent({
      type: 'package.install.succeeded',
      actor: 'admin@example.com',
      packageId: 'ecommerce-core',
      version: '1.0.0',
      payload: { sample: true },
    });

    const eventsDir = path.join(tmpDir, 'packages-storage', 'events');
    const files = fs.readdirSync(eventsDir);
    expect(files.length).toBe(1);

    const line = fs.readFileSync(path.join(eventsDir, files[0]), 'utf8').trim().split('\n')[0];
    const evt = JSON.parse(line) as Record<string, unknown>;

    expect(evt.schema).toBe('package-event');
    expect(evt.schemaVersion).toBe('1.1.0');
    expect(evt.category).toBe('package-platform');
    expect(evt.retentionClass).toBe('audit');
    expect(evt.level).toBe('info');
    expect(evt.outcome).toBe('success');
  });

  it('prunes old monthly event logs by retention month count', async () => {
    const store = await loadStore();
    store.ensurePackageStorageDirs();

    const eventsDir = path.join(tmpDir, 'packages-storage', 'events');
    fs.mkdirSync(eventsDir, { recursive: true });
    fs.writeFileSync(path.join(eventsDir, 'events-2026-01.jsonl'), '{"x":1}\n', 'utf8');
    fs.writeFileSync(path.join(eventsDir, 'events-2026-02.jsonl'), '{"x":1}\n', 'utf8');
    fs.writeFileSync(path.join(eventsDir, 'events-2026-03.jsonl'), '{"x":1}\n', 'utf8');

    writeRuntimeSettings({
      packageEventRetentionMonths: 2,
      packageEventRetentionMaxTotalBytes: 20 * 1024 * 1024,
    });

    const result = store.enforcePackageEventRetention();

    const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith('.jsonl')).sort();
    expect(files).toContain('events-2026-02.jsonl');
    expect(files).toContain('events-2026-03.jsonl');
    expect(files).not.toContain('events-2026-01.jsonl');
    expect(result.deletedFiles).toContain('events-2026-01.jsonl');
  });
});
