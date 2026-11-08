import { describe, expect, it } from 'vitest';
import { embedTextLocally, cosineSimilarity, localLexicalVectorProvider } from '../localLexicalVectorProvider';

describe('V5 P05 § V5-7 Stage F — localLexicalVectorProvider', () => {
  it('produces an L2-normalized vector of the fixed dimension', () => {
    const vector = embedTextLocally('AgentOrchestrator run loop');
    expect(vector).toHaveLength(256);
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it('gives near-identical text a high cosine similarity', () => {
    const a = embedTextLocally('resolve task contract from routing');
    const b = embedTextLocally('resolve task contract from routing signal');
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.5);
  });

  it('gives lexically unrelated text a low similarity', () => {
    const a = embedTextLocally('agent orchestrator tool loop iteration');
    const b = embedTextLocally('purple elephant swimming ocean waves');
    expect(cosineSimilarity(a, b)).toBeLessThan(0.2);
  });

  it('the empty string produces a zero vector without throwing', () => {
    const vector = embedTextLocally('');
    expect(vector.every((v) => v === 0)).toBe(true);
  });

  it('VectorProvider interface is implemented and callable', () => {
    const vector = localLexicalVectorProvider.embed('hypothesis ledger reject rule');
    expect(vector).toHaveLength(256);
  });
});
