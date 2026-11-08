import { describe, expect, it } from 'vitest';
import { loadToolOutputArtifact, persistToolOutputArtifactIfLarge } from '../toolOutputArtifactStore';
import { MIN_COMPRESSIBLE_TOOL_CHARS } from '../toolObservationCompact';

describe('V5 P09 §15 — toolOutputArtifactStore', () => {
  it('does not persist a payload under the compaction threshold', () => {
    const artifactId = `obs:test-small-${Date.now()}`;
    const result = persistToolOutputArtifactIfLarge(artifactId, 'short text', { toolCallId: 'call-1', toolName: 'read_file' });
    expect(result).toBeUndefined();
    expect(loadToolOutputArtifact(artifactId)).toBeUndefined();
  });

  it('persists and reloads a large text payload with correct metadata', () => {
    const artifactId = `obs:test-large-text-${Date.now()}`;
    const longText = 'line content here\n'.repeat(Math.ceil(MIN_COMPRESSIBLE_TOOL_CHARS / 18) + 10);

    const meta = persistToolOutputArtifactIfLarge(artifactId, longText, { toolCallId: 'call-2', toolName: 'read_file' });
    expect(meta).toBeDefined();
    expect(meta!.contentType).toBe('text');
    expect(meta!.toolName).toBe('read_file');
    expect(meta!.toolCallId).toBe('call-2');
    expect(meta!.byteLength).toBeGreaterThan(0);
    expect(meta!.lineCount).toBeGreaterThan(1);
    expect(meta!.queryCapabilities).toContain('read_range');
    expect(meta!.queryCapabilities).toContain('tail');

    const reloaded = loadToolOutputArtifact(artifactId);
    expect(reloaded).toBeDefined();
    expect(reloaded!.content).toBe(longText);
    expect(reloaded!.meta.digest).toBe(meta!.digest);
  });

  it('persists a large JSON payload as contentType "json"', () => {
    const artifactId = `obs:test-large-json-${Date.now()}`;
    const bigArray = Array.from({ length: 500 }, (_, i) => ({ id: i, note: 'padding'.repeat(5) }));

    const meta = persistToolOutputArtifactIfLarge(artifactId, bigArray, { toolCallId: 'call-3', toolName: 'search_codebase' });
    expect(meta).toBeDefined();
    expect(meta!.contentType).toBe('json');
    expect(meta!.lineCount).toBeUndefined();

    const reloaded = loadToolOutputArtifact(artifactId);
    expect(JSON.parse(reloaded!.content)).toHaveLength(500);
  });

  it('flags error-looking content with the list_errors capability', () => {
    const artifactId = `obs:test-errors-${Date.now()}`;
    const output = `${'ok line\n'.repeat(200)}Error: something broke\nmore output\n`;

    const meta = persistToolOutputArtifactIfLarge(artifactId, output, { toolCallId: 'call-4', toolName: 'run_tests' });
    expect(meta!.queryCapabilities).toContain('list_errors');
  });

  it('returns undefined for an unknown artifactId', () => {
    expect(loadToolOutputArtifact('obs:does-not-exist-ever')).toBeUndefined();
  });
});
