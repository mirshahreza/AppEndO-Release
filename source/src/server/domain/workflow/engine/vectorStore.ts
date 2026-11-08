import { prisma, fromId } from '../prismaHelpers';
import type { JsonValue } from '../awm/types';

const cosineSimilarity = (a: number[], b: number[]): number => {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
};

const parseVector = (json: string): number[] => {
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    throw new Error('Stored embedding is not a finite number array.');
  }
  return parsed;
};

export async function upsertVectorDocument(input: {
  collection: string;
  documentKey: string;
  text: string;
  embedding: number[];
  metadata?: JsonValue;
}): Promise<{ id: number; collection: string; documentKey: string }> {
  const embeddingJson = JSON.stringify(input.embedding);
  const metadataJson = input.metadata === undefined ? null : JSON.stringify(input.metadata);
  const row = await prisma().workflowVectorDocument.upsert({
    where: { collection_documentKey: { collection: input.collection, documentKey: input.documentKey } },
    create: {
      collection: input.collection,
      documentKey: input.documentKey,
      text: input.text,
      embeddingJson,
      metadataJson,
    },
    update: {
      text: input.text,
      embeddingJson,
      metadataJson,
      updatedAt: new Date(),
    },
    select: { id: true, collection: true, documentKey: true },
  });
  return { id: fromId(row.id), collection: row.collection, documentKey: row.documentKey };
}

export async function searchVectorDocuments(input: {
  collection: string;
  embedding: number[];
  limit: number;
}): Promise<Array<{ documentKey: string; text: string; score: number; metadata: JsonValue }>> {
  const rows = await prisma().workflowVectorDocument.findMany({
    where: { collection: input.collection },
    select: { documentKey: true, text: true, embeddingJson: true, metadataJson: true },
  });
  const ranked = rows
    .map((row) => {
      let metadata: JsonValue = null;
      if (row.metadataJson) {
        try { metadata = JSON.parse(row.metadataJson) as JsonValue; } catch { metadata = null; }
      }
      return {
        documentKey: row.documentKey,
        text: row.text,
        score: cosineSimilarity(input.embedding, parseVector(row.embeddingJson)),
        metadata,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, input.limit));
  return ranked;
}
