import { describe, expect, it } from 'vitest';
import {
  artifactListErrorsTool,
  artifactReadRangeTool,
  artifactSearchTool,
  artifactTailTool,
} from '../toolOutputArtifactTools';
import { persistToolOutputArtifactIfLarge } from '../../../agent/toolOutputArtifactStore';
import { MIN_COMPRESSIBLE_TOOL_CHARS } from '../../../agent/toolObservationCompact';

describe('V5 P09 §15 — artifact_read_range / artifact_tail / artifact_search / artifact_list_errors', () => {
  const seedArtifact = (id: string) => {
    const lines = Array.from({ length: 400 }, (_, i) => (
      i === 250 ? `${i + 1}: ERROR TypeError: cannot read property of undefined` : `${i + 1}: normal output line`
    ));
    const content = lines.join('\n');
    persistToolOutputArtifactIfLarge(id, content, { toolCallId: 'call-x', toolName: 'run_tests' });
    return content;
  };

  it('artifact_read_range returns the requested line window with correct numbering', async () => {
    const id = `obs:tool-test-range-${Date.now()}`;
    seedArtifact(id);

    const result = await artifactReadRangeTool.execute({ artifactId: id, startLine: 10, endLine: 12 }, {} as never);
    expect(result.ok).toBe(true);
    const data = (result as { data: { startLine: number; endLine: number; content: string } }).data;
    expect(data.startLine).toBe(10);
    expect(data.endLine).toBe(12);
    expect(data.content.split('\n')).toHaveLength(3);
    expect(data.content).toContain('10|10: normal output line');
  });

  it('artifact_tail returns the end of the content, not the start', async () => {
    const id = `obs:tool-test-tail-${Date.now()}`;
    const content = seedArtifact(id);

    const result = await artifactTailTool.execute({ artifactId: id, maxChars: 200 }, {} as never);
    expect(result.ok).toBe(true);
    const data = (result as { data: { content: string } }).data;
    expect(content.endsWith(data.content)).toBe(true);
    expect(data.content).not.toContain('1: normal output line\n2:');
  });

  it('artifact_search finds a specific line by substring, case-insensitively', async () => {
    const id = `obs:tool-test-search-${Date.now()}`;
    seedArtifact(id);

    const result = await artifactSearchTool.execute({ artifactId: id, query: 'typeerror' }, {} as never);
    expect(result.ok).toBe(true);
    const data = (result as { data: { matchCount: number; matches: { line: number; text: string }[] } }).data;
    expect(data.matchCount).toBe(1);
    expect(data.matches[0].line).toBe(251);
    expect(data.matches[0].text).toContain('TypeError');
  });

  it('artifact_list_errors surfaces the error-looking line', async () => {
    const id = `obs:tool-test-errors-${Date.now()}`;
    seedArtifact(id);

    const result = await artifactListErrorsTool.execute({ artifactId: id }, {} as never);
    expect(result.ok).toBe(true);
    const data = (result as { data: { matchCount: number } }).data;
    expect(data.matchCount).toBeGreaterThanOrEqual(1);
  });

  it('returns a clear not-found error for an unknown artifactId', async () => {
    const result = await artifactReadRangeTool.execute({ artifactId: 'obs:never-existed' }, {} as never);
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe('artifact_not_found');
  });

  it('requires artifactId', async () => {
    const result = await artifactTailTool.execute({}, {} as never);
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe('missing_artifact_id');
  });

  it('sanity: MIN_COMPRESSIBLE_TOOL_CHARS import resolves (shared threshold constant)', () => {
    expect(MIN_COMPRESSIBLE_TOOL_CHARS).toBeGreaterThan(0);
  });
});
