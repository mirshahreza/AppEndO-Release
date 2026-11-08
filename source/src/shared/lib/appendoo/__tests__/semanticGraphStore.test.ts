import { describe, expect, it, beforeEach } from 'vitest';
import {
  computeSemanticGraphImpact,
  getSemanticGraphNeighbors,
  resetSemanticGraphStoreForTests,
  traverseSemanticGraph,
  upsertSemanticGraphEdges,
  upsertSemanticGraphNodes,
} from '../semanticGraphStore';

const provenance = {
  sourceType: 'test',
  sourceReference: 'fixture',
  confidence: 1,
  verificationStatus: 'verified' as const,
  observedAt: '2026-07-11T00:00:00.000Z',
  indexVersion: 1,
};

describe('semanticGraphStore', () => {
  beforeEach(() => {
    resetSemanticGraphStoreForTests();
  });

  it('stores nodes and traverses neighbors', () => {
    upsertSemanticGraphNodes([
      { nodeId: 'a', kind: 'Application', label: 'App', provenance },
      { nodeId: 'b', kind: 'Page', label: 'Page B', provenance },
      { nodeId: 'c', kind: 'Service', label: 'Service C', provenance },
    ]);
    upsertSemanticGraphEdges([
      {
        edgeId: 'a-b',
        kind: 'CONTAINS',
        fromNodeId: 'a',
        toNodeId: 'b',
        provenance,
      },
      {
        edgeId: 'b-c',
        kind: 'REFERENCES',
        fromNodeId: 'b',
        toNodeId: 'c',
        provenance,
      },
    ]);

    const traversal = traverseSemanticGraph('a', 2);
    expect(traversal.visitedNodeIds).toEqual(expect.arrayContaining(['a', 'b', 'c']));

    const neighbors = getSemanticGraphNeighbors('b', 'both');
    expect(neighbors.nodes.map((node) => node.nodeId).sort()).toEqual(['a', 'c']);
  });

  it('computes impact along authoritative edge kinds', () => {
    upsertSemanticGraphNodes([
      { nodeId: 'page', kind: 'Page', label: 'Page', provenance },
      { nodeId: 'service', kind: 'Service', label: 'Service', provenance },
    ]);
    upsertSemanticGraphEdges([
      {
        edgeId: 'page-service',
        kind: 'REFERENCES',
        fromNodeId: 'page',
        toNodeId: 'service',
        provenance,
      },
    ]);

    const impact = computeSemanticGraphImpact('page', 1);
    expect(impact.impactedNodeIds).toContain('service');
  });
});
