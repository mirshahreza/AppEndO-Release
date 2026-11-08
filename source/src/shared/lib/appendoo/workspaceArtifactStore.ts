import { createHash } from 'node:crypto';
import { isActiveRootMutation } from './engineeringWorkspaceScaffold';

export type WorkspaceArtifactRecord = {
  path: string;
  content: string;
  contentType: string;
  fingerprint: string;
  writtenAt: string;
};

const fingerprint = (path: string, content: string): string => (
  createHash('sha256').update(`${path}:${content}`).digest('hex').slice(0, 16)
);

/** In-memory workspace artifact store — isolated from active runtime roots (Phase 15). */
export class WorkspaceArtifactStore {
  private artifacts = new Map<string, WorkspaceArtifactRecord>();

  write(input: { path: string; content: string; contentType: string }): WorkspaceArtifactRecord {
    const normalized = input.path.replace(/\\/g, '/');
    if (isActiveRootMutation(normalized)) {
      throw new Error(`Active-root workspace write rejected: ${normalized}`);
    }

    const record: WorkspaceArtifactRecord = {
      path: normalized,
      content: input.content,
      contentType: input.contentType,
      fingerprint: fingerprint(normalized, input.content),
      writtenAt: new Date().toISOString(),
    };
    this.artifacts.set(normalized, record);
    return record;
  }

  read(path: string): WorkspaceArtifactRecord | undefined {
    return this.artifacts.get(path.replace(/\\/g, '/'));
  }

  list(prefix: string): WorkspaceArtifactRecord[] {
    const normalizedPrefix = prefix.replace(/\\/g, '/');
    return [...this.artifacts.values()].filter((artifact) => artifact.path.startsWith(normalizedPrefix));
  }

  resetForTests(): void {
    this.artifacts.clear();
  }
}

export const workspaceArtifactStore = new WorkspaceArtifactStore();
