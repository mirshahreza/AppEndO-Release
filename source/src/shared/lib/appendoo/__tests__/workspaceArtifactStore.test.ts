import { describe, expect, it, beforeEach } from 'vitest';
import { workspaceArtifactStore } from '../workspaceArtifactStore';

describe('workspaceArtifactStore', () => {
  beforeEach(() => {
    workspaceArtifactStore.resetForTests();
  });

  it('writes and reads workspace-scoped artifacts', () => {
    const record = workspaceArtifactStore.write({
      path: 'appendoo/ws/cs-store-1/runtime/config/demo.json',
      content: '{"enabled":true}',
      contentType: 'application/json',
    });

    expect(record.fingerprint).toHaveLength(16);
    expect(workspaceArtifactStore.read(record.path)?.content).toContain('enabled');
  });

  it('rejects active-root mutation paths', () => {
    expect(() => workspaceArtifactStore.write({
      path: 'src/server/services/demo.ts',
      content: 'export {}',
      contentType: 'text/typescript',
    })).toThrow(/Active-root workspace write rejected/);
  });
});
