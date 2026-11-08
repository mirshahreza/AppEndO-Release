import { describe, expect, it } from 'vitest';
import {
  applyFastApplyPatch,
  parseFastApplyBlocks,
} from '../fastApplyPatch';

const samplePatch = [
  '<<<<<<< ORIGINAL',
  'const x = 1;',
  '=======',
  'const x = 2;',
  '>>>>>>> UPDATED',
].join('\n');

describe('fastApplyPatch', () => {
  it('parses a single fast-apply block', () => {
    const blocks = parseFastApplyBlocks(samplePatch);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.original).toBe('const x = 1;');
    expect(blocks[0]?.updated).toBe('const x = 2;');
  });

  it('applies a replacement to source content', () => {
    const source = 'line one\nconst x = 1;\nline three\n';
    const result = applyFastApplyPatch(source, samplePatch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toBe('line one\nconst x = 2;\nline three\n');
      expect(result.blockCount).toBe(1);
    }
  });

  it('fails when original snippet is missing', () => {
    const result = applyFastApplyPatch('unrelated content', samplePatch);
    expect(result.ok).toBe(false);
  });

  const multiLinePatch = [
    '<<<<<<< ORIGINAL',
    'const a = 1;',
    'const b = 2;',
    '=======',
    'const a = 10;',
    'const b = 2;',
    '>>>>>>> UPDATED',
  ].join('\n');

  it('heals an internal trailing-whitespace mismatch when the match is unique', () => {
    const source = 'line one\nconst a = 1;   \nconst b = 2;\nline three\n';
    const result = applyFastApplyPatch(source, multiLinePatch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toBe('line one\nconst a = 10;\nconst b = 2;\nline three\n');
      expect(result.healedBlockCount).toBe(1);
    }
  });

  it('heals a CRLF vs LF mismatch when the match is unique', () => {
    const source = 'line one\r\nconst a = 1;\r\nconst b = 2;\r\nline three\r\n';
    const result = applyFastApplyPatch(source, multiLinePatch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('const a = 10;');
      expect(result.healedBlockCount).toBe(1);
    }
  });

  it('rejects healing when the whitespace-tolerant match is ambiguous', () => {
    const source = 'const a = 1; \nconst b = 2;\nmiddle\nconst a = 1;\t\nconst b = 2;\n';
    const result = applyFastApplyPatch(source, multiLinePatch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('multiple locations');
    }
  });

  it('reports no healedBlockCount for exact matches', () => {
    const source = 'const x = 1;\n';
    const result = applyFastApplyPatch(source, samplePatch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.healedBlockCount).toBeUndefined();
    }
  });

  it('heals multi-line blocks with mixed indentation drift', () => {
    const patch = [
      '<<<<<<< ORIGINAL',
      'function add(a, b) {',
      '  return a + b;',
      '}',
      '=======',
      'function add(a, b) {',
      '  return a + b + 0;',
      '}',
      '>>>>>>> UPDATED',
    ].join('\n');
    const source = 'function add(a, b) { \n  return a + b;\t\n}\nrest\n';
    const result = applyFastApplyPatch(source, patch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('return a + b + 0;');
      expect(result.content).toContain('rest');
    }
  });
});
