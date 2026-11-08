import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = {
  id: bigint;
  collection: string;
  documentKey: string;
  text: string;
  embeddingJson: string;
  metadataJson: string | null;
};

const rows: Row[] = [];
let nextId = 1n;

vi.mock('../../prismaHelpers', () => ({
  prisma: () => ({
    workflowVectorDocument: {
      upsert: async ({
        where,
        create,
        update,
        select,
      }: {
        where: { collection_documentKey: { collection: string; documentKey: string } };
        create: Omit<Row, 'id'>;
        update: Partial<Omit<Row, 'id' | 'collection' | 'documentKey'>>;
        select: { id: true; collection: true; documentKey: true };
      }) => {
        const key = where.collection_documentKey;
        const existing = rows.find((row) => row.collection === key.collection && row.documentKey === key.documentKey);
        if (!existing) {
          const created: Row = { id: nextId, ...create };
          nextId += 1n;
          rows.push(created);
          return { id: created.id, collection: created.collection, documentKey: created.documentKey };
        }
        Object.assign(existing, update);
        void select;
        return { id: existing.id, collection: existing.collection, documentKey: existing.documentKey };
      },
      findMany: async ({
        where,
        select,
      }: {
        where: { collection: string };
        select: { documentKey: true; text: true; embeddingJson: true; metadataJson: true };
      }) => {
        void select;
        return rows
          .filter((row) => row.collection === where.collection)
          .map((row) => ({
            documentKey: row.documentKey,
            text: row.text,
            embeddingJson: row.embeddingJson,
            metadataJson: row.metadataJson,
          }));
      },
    },
  }),
  fromId: (id: bigint | number) => Number(id),
}));

const { upsertVectorDocument, searchVectorDocuments } = await import('../vectorStore');

describe('workflow vector store (cosine ranking)', () => {
  beforeEach(() => {
    rows.length = 0;
    nextId = 1n;
  });

  it('upserts by (collection, documentKey) and ranks nearest neighbors by cosine similarity', async () => {
    await upsertVectorDocument({ collection: 'kb', documentKey: 'cat', text: 'about cats', embedding: [1, 0, 0], metadata: { kind: 'animal' } });
    await upsertVectorDocument({ collection: 'kb', documentKey: 'dog', text: 'about dogs', embedding: [0.2, 0.8, 0] });
    await upsertVectorDocument({ collection: 'kb', documentKey: 'car', text: 'about cars', embedding: [0, 0, 1] });

    const hits = await searchVectorDocuments({ collection: 'kb', embedding: [1, 0, 0], limit: 2 });
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ documentKey: 'cat', text: 'about cats', metadata: { kind: 'animal' } });
    expect(hits[0]!.score).toBeCloseTo(1, 5);
    expect(hits[1]!.documentKey).toBe('dog');
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);
  });

  it('replaces the stored embedding/text on a second upsert of the same key', async () => {
    await upsertVectorDocument({ collection: 'kb', documentKey: 'doc-1', text: 'v1', embedding: [1, 0] });
    await upsertVectorDocument({ collection: 'kb', documentKey: 'doc-1', text: 'v2', embedding: [0, 1], metadata: { rev: 2 } });

    const hits = await searchVectorDocuments({ collection: 'kb', embedding: [0, 1], limit: 5 });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ documentKey: 'doc-1', text: 'v2', metadata: { rev: 2 } });
    expect(hits[0]!.score).toBeCloseTo(1, 5);
  });

  it('does not leak documents from another collection', async () => {
    await upsertVectorDocument({ collection: 'a', documentKey: 'only-a', text: 'a', embedding: [1, 0] });
    await upsertVectorDocument({ collection: 'b', documentKey: 'only-b', text: 'b', embedding: [1, 0] });

    const hits = await searchVectorDocuments({ collection: 'a', embedding: [1, 0], limit: 10 });
    expect(hits.map((h) => h.documentKey)).toEqual(['only-a']);
  });

  it('throws when a stored embedding is not a finite number array', async () => {
    rows.push({
      id: 99n,
      collection: 'kb',
      documentKey: 'bad',
      text: 'corrupt',
      embeddingJson: '{"nope":true}',
      metadataJson: null,
    });
    await expect(searchVectorDocuments({ collection: 'kb', embedding: [1, 0], limit: 5 })).rejects.toThrow(/finite number array/);
  });
});
