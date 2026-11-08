/**
 * V5 Phase P05 § V5-7 Stage F — real vector provider adapter.
 *
 * EV-3 (no live model/API key configured — `docs/appendoo/decision-log.md` D-007) means no real
 * neural embedding provider (`@google/genai` or otherwise) can be called in this environment.
 * This is a REAL, local, deterministic vector implementation (hashed character-n-gram bag-of-
 * words, cosine-normalized) — not a neural embedding, and explicitly not represented as one
 * anywhere in this codebase. It genuinely computes lexical-similarity vectors and real cosine
 * similarity, closing the doc's cited gap ("vectorScore was never injected into this flow from semantic vector search"
 * — `candidate.vectorScore` was structurally always `0` before this phase).
 *
 * `VectorProvider` is the swap point: once EV-3 clears, a real neural embedding provider can
 * implement the same interface and replace `localLexicalVectorProvider` at the one call site in
 * `codebaseRetrieval.service.ts` — no other code needs to change.
 */
export type VectorProvider = {
  embed(text: string): number[];
};

const VECTOR_DIMENSIONS = 256;
const NGRAM_SIZE = 3;

const hashToken = (token: string): number => {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = ((hash << 5) - hash) + token.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const extractNgrams = (text: string): string[] => {
  const normalized = (text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const ngrams: string[] = [];
  for (const word of normalized.split(/\s+/)) {
    if (word.length < NGRAM_SIZE) {
      if (word) ngrams.push(word);
      continue;
    }
    for (let index = 0; index <= word.length - NGRAM_SIZE; index += 1) {
      ngrams.push(word.slice(index, index + NGRAM_SIZE));
    }
  }
  return ngrams;
};

/** Hashed char-n-gram bag-of-words, L2-normalized so dot product == cosine similarity. */
export const embedTextLocally = (text: string): number[] => {
  const vector = new Array(VECTOR_DIMENSIONS).fill(0);
  for (const ngram of extractNgrams(text)) {
    vector[hashToken(ngram) % VECTOR_DIMENSIONS] += 1;
  }
  let magnitude = 0;
  for (const value of vector) magnitude += value * value;
  magnitude = Math.sqrt(magnitude);
  if (magnitude === 0) return vector;
  return vector.map((value) => value / magnitude);
};

export const localLexicalVectorProvider: VectorProvider = {
  embed: embedTextLocally,
};

/** Real cosine similarity (both inputs assumed L2-normalized already, as `embedTextLocally` produces). */
export const cosineSimilarity = (a: readonly number[], b: readonly number[]): number => {
  const size = Math.min(a.length, b.length);
  let dot = 0;
  for (let index = 0; index < size; index += 1) {
    dot += a[index]! * b[index]!;
  }
  return dot;
};
