import { describe, expect, it } from 'vitest';
import {
  SCHEMA_RELATIONS_DIAGRAM_LAYOUT_ALGORITHM_VERSION,
  SCHEMA_RELATIONS_DIAGRAM_LAYOUT_EXTENSION_KEY,
  parseSchemaRelationsDiagramLayout,
  readSchemaRelationsDiagramLayoutFromExtensions,
} from '../schemaRelationsDiagramLayout';

describe('schemaRelationsDiagramLayout', () => {
  it('parses a valid layout payload with current algorithm version', () => {
    const layout = parseSchemaRelationsDiagramLayout({
      algorithmVersion: SCHEMA_RELATIONS_DIAGRAM_LAYOUT_ALGORITHM_VERSION,
      nodes: {
        base_users: { x: 10, y: 20, width: 240 },
      },
    });

    expect(layout).toEqual({
      algorithmVersion: SCHEMA_RELATIONS_DIAGRAM_LAYOUT_ALGORITHM_VERSION,
      nodes: {
        base_users: { x: 10, y: 20, width: 240 },
      },
    });
  });

  it('rejects invalid or stale layout payloads', () => {
    expect(parseSchemaRelationsDiagramLayout({ nodes: { a: { x: 'nope', y: 1 } } })).toBeNull();
    expect(parseSchemaRelationsDiagramLayout(null)).toBeNull();
    expect(parseSchemaRelationsDiagramLayout({
      nodes: { a: { x: 1, y: 2 } },
    })).toBeNull();
    expect(parseSchemaRelationsDiagramLayout({
      algorithmVersion: 1,
      nodes: { a: { x: 1, y: 2 } },
    })).toBeNull();
  });

  it('reads layout from studio-meta extensions', () => {
    const layout = readSchemaRelationsDiagramLayoutFromExtensions({
      [SCHEMA_RELATIONS_DIAGRAM_LAYOUT_EXTENSION_KEY]: {
        algorithmVersion: SCHEMA_RELATIONS_DIAGRAM_LAYOUT_ALGORITHM_VERSION,
        nodes: { orders: { x: 5, y: 6 } },
      },
    });

    expect(layout?.nodes.orders).toEqual({ x: 5, y: 6 });
  });
});
