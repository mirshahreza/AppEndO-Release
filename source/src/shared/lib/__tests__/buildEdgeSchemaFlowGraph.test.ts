import { describe, expect, it } from 'vitest';
import {
  applySchemaRelationsDiagramLayout,
  applySchemaRelationDrillDownEdgeLayout,
  applySchemaRelationEntityDrillDown,
  buildEdgeSchemaFlowGraph,
  collectSchemaRelationsDiagramLayout,
} from '../buildEdgeSchemaFlowGraph';
import type { SchemaRelationsSnapshot } from '../../api/contracts/data-sources/schemaRelations';

const snapshot: SchemaRelationsSnapshot = {
  focusObject: 'orders',
  objectType: 'TABLE',
  tables: [
    {
      name: 'orders',
      columns: [
        { name: 'id', dataType: 'integer', isPrimaryKey: true },
        { name: 'customer_id', dataType: 'integer', isPrimaryKey: false },
      ],
    },
    {
      name: 'customers',
      columns: [
        { name: 'id', dataType: 'integer', isPrimaryKey: true },
      ],
    },
  ],
  relations: [
    {
      fromTable: 'orders',
      fromColumn: 'customer_id',
      toTable: 'customers',
      toColumn: 'id',
      constraintName: 'fk_orders_customer',
    },
  ],
};

const hubSnapshot: SchemaRelationsSnapshot = {
  focusObject: 'base_users',
  objectType: 'TABLE',
  tables: [
    {
      name: 'base_users',
      columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }],
    },
    ...Array.from({ length: 8 }, (_, index) => ({
      name: `child_${index}`,
      columns: [
        { name: 'id', dataType: 'uuid', isPrimaryKey: true },
        { name: 'user_id', dataType: 'uuid', isPrimaryKey: false },
      ],
    })),
  ],
  relations: Array.from({ length: 8 }, (_, index) => ({
    fromTable: `child_${index}`,
    fromColumn: 'user_id',
    toTable: 'base_users',
    toColumn: 'id',
    constraintName: `fk_child_${index}`,
  })),
};

describe('buildEdgeSchemaFlowGraph', () => {
  it('builds entity nodes and labeled foreign-key edges', () => {
    const graph = buildEdgeSchemaFlowGraph(snapshot);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.nodes.find((node) => node.id === 'orders')?.data.isFocus).toBe(true);
    expect(graph.edges[0]?.data).toMatchObject({
      title: 'fk_orders_customer',
      kindLabel: 'Belongs to',
      natureLabel: 'Physical',
      relationNature: 'physical',
    });
    expect(graph.edges[0]?.type).toBe('schemaRelation');
    expect(graph.nodes[0]?.position).not.toEqual(graph.nodes[1]?.position);
  });

  it('drill-down ribbons parallel edges between two tables', () => {
    const dualLogicalSnapshot: SchemaRelationsSnapshot = {
      focusObject: 'hwy_members',
      objectType: 'TABLE',
      tables: [
        {
          name: 'hwy_members',
          columns: [{ name: 'id', dataType: 'bigint', isPrimaryKey: true }],
        },
        {
          name: 'base_info',
          columns: [{ name: 'id', dataType: 'bigint', isPrimaryKey: true }],
        },
      ],
      relations: [
        {
          fromTable: 'hwy_members',
          fromColumn: 'gender_code',
          toTable: 'base_info',
          toColumn: 'id',
          constraintName: 'FK_gender',
        },
        {
          fromTable: 'hwy_members',
          fromColumn: 'job_type',
          toTable: 'base_info',
          toColumn: 'id',
          constraintName: 'FK_job',
        },
        {
          fromTable: 'hwy_members',
          fromColumn: 'edu',
          toTable: 'base_info',
          toColumn: 'id',
          constraintName: 'FK_edu',
        },
      ],
    };
    const graph = buildEdgeSchemaFlowGraph(dualLogicalSnapshot);
    const drilled = applySchemaRelationEntityDrillDown(graph, 'base_info');
    expect(drilled?.edges.every((edge) => edge.data?.drillDownRibbon)).toBe(true);
    const along = drilled?.edges
      .map((edge) => edge.data?.labelAlongFraction)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(along?.map((value) => Math.round((value ?? 0) * 100) / 100)).toEqual([0.16, 0.5, 0.84]);
    const peer = drilled?.nodes.find((node) => node.id === 'hwy_members');
    const focus = drilled?.nodes.find((node) => node.id === 'base_info');
    expect(peer?.position.x).toBeLessThan(focus?.position.x ?? 0);
    expect((focus?.position.x ?? 0) - (peer?.position.x ?? 0)).toBeGreaterThan(400);
  });

  it('drill-down keeps only edges incident to the double-clicked table', () => {
    const graph = buildEdgeSchemaFlowGraph(hubSnapshot);
    const drilled = applySchemaRelationEntityDrillDown(graph, 'child_0');
    expect(drilled).not.toBeNull();
    expect(drilled!.nodes.some((node) => node.id === 'child_0' && node.data.isFocus)).toBe(true);
    expect(drilled!.nodes.every((node) => (
      node.id === 'child_0' || node.id === 'base_users'
    ))).toBe(true);
    expect(drilled!.edges.length).toBe(1);
  });

  it('assigns parallel label layout when multiple edges share source and target', () => {
    const dualFkSnapshot: SchemaRelationsSnapshot = {
      focusObject: 'hwy_members',
      objectType: 'TABLE',
      tables: [
        {
          name: 'hwy_members',
          columns: [
            { name: 'id', dataType: 'bigint', isPrimaryKey: true },
            { name: 'user_id', dataType: 'bigint', isPrimaryKey: false },
            { name: 'updated_by', dataType: 'bigint', isPrimaryKey: false },
          ],
        },
        {
          name: 'base_users',
          columns: [{ name: 'id', dataType: 'bigint', isPrimaryKey: true }],
        },
      ],
      relations: [
        {
          fromTable: 'hwy_members',
          fromColumn: 'user_id',
          toTable: 'base_users',
          toColumn: 'id',
          constraintName: 'FK_hwy_members_user',
        },
        {
          fromTable: 'hwy_members',
          fromColumn: 'updated_by',
          toTable: 'base_users',
          toColumn: 'id',
          constraintName: 'FK_hwy_members_updated_by',
        },
      ],
    };

    const graph = buildEdgeSchemaFlowGraph(dualFkSnapshot);
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges.every((edge) => edge.data?.parallelTotal === 2)).toBe(true);
    expect(new Set(graph.edges.map((edge) => edge.data?.parallelIndex))).toEqual(new Set([0, 1]));
  });

  it('fans inbound hub neighbors vertically instead of one flat row', () => {
    const graph = buildEdgeSchemaFlowGraph(hubSnapshot);
    const others = graph.nodes.filter((node) => node.id !== 'base_users');
    const uniqueY = new Set(others.map((node) => Math.round(node.position.y)));

    expect(uniqueY.size).toBeGreaterThan(1);

    const focus = graph.nodes.find((node) => node.id === 'base_users');
    const maxOtherX = Math.max(...others.map((node) => node.position.x + (node.width ?? 0)));
    expect(focus).toBeDefined();
    expect(focus!.position.x).toBeGreaterThan(maxOtherX);
  });

  it('fans outbound hub neighbors on staggered vertical lanes', () => {
    const attachmentsSnapshot: SchemaRelationsSnapshot = {
      focusObject: 'base_app_feedback_attachments',
      objectType: 'TABLE',
      tables: [
        {
          name: 'base_app_feedback_attachments',
          columns: [
            { name: 'id', dataType: 'uuid', isPrimaryKey: true },
            { name: 'feedback_id', dataType: 'uuid', isPrimaryKey: false },
            { name: 'message_id', dataType: 'uuid', isPrimaryKey: false },
            { name: 'uploaded_by_user_id', dataType: 'uuid', isPrimaryKey: false },
          ],
        },
        {
          name: 'base_app_feedback',
          columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }],
        },
        {
          name: 'base_app_feedback_messages',
          columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }],
        },
        {
          name: 'base_users',
          columns: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }],
        },
      ],
      relations: [
        {
          fromTable: 'base_app_feedback_attachments',
          fromColumn: 'feedback_id',
          toTable: 'base_app_feedback',
          toColumn: 'id',
        },
        {
          fromTable: 'base_app_feedback_attachments',
          fromColumn: 'message_id',
          toTable: 'base_app_feedback_messages',
          toColumn: 'id',
        },
        {
          fromTable: 'base_app_feedback_attachments',
          fromColumn: 'uploaded_by_user_id',
          toTable: 'base_users',
          toColumn: 'id',
        },
      ],
    };

    const graph = buildEdgeSchemaFlowGraph(attachmentsSnapshot);
    const focus = graph.nodes.find((node) => node.id === 'base_app_feedback_attachments');
    const others = graph.nodes.filter((node) => node.id !== 'base_app_feedback_attachments');
    const ys = others.map((node) => Math.round(node.position.y)).sort((a, b) => a - b);

    expect(focus).toBeDefined();
    expect(others.every((node) => node.position.x > (focus!.position.x + (focus!.width ?? 0)))).toBe(true);
    expect(new Set(ys).size).toBe(others.length);
    expect(ys[ys.length - 1]! - ys[0]!).toBeGreaterThan(80);

    const minEdgeSpan = Math.min(
      ...others.map((node) => node.position.x - (focus!.position.x + (focus!.width ?? 0))),
    );
    expect(minEdgeSpan).toBeGreaterThanOrEqual(280);
  });

  it('applies saved node positions and widths over the auto layout', () => {
    const graph = buildEdgeSchemaFlowGraph(snapshot, {
      layout: {
        nodes: {
          orders: { x: 12, y: 34, width: 300 },
          customers: { x: 400, y: 80 },
        },
      },
    });

    const orders = graph.nodes.find((node) => node.id === 'orders');
    const customers = graph.nodes.find((node) => node.id === 'customers');
    expect(orders?.position).toEqual({ x: 12, y: 34 });
    expect(orders?.width).toBe(300);
    expect(customers?.position).toEqual({ x: 400, y: 80 });
  });

  it('round-trips layout collection through apply helpers', () => {
    const graph = buildEdgeSchemaFlowGraph(snapshot);
    const layout = collectSchemaRelationsDiagramLayout(graph.nodes);
    const reapplied = applySchemaRelationsDiagramLayout(graph.nodes, {
      nodes: {
        orders: { x: 1, y: 2, width: 260 },
      },
    });

    expect(Object.keys(layout.nodes)).toEqual(expect.arrayContaining(['orders', 'customers']));
    expect(reapplied.find((node) => node.id === 'orders')?.position).toEqual({ x: 1, y: 2 });
    expect(reapplied.find((node) => node.id === 'orders')?.width).toBe(260);
  });

  it('keeps belongsToMany as a logical-only edge that does not twin-merge', () => {
    const graph = buildEdgeSchemaFlowGraph(snapshot, {
      logicalRelations: [
        {
          associationId: 'assoc_m2m',
          kind: 'belongsToMany',
          as: 'roles',
          foreignKey: 'user_id',
          otherKey: 'role_id',
          sourceObjectName: 'orders',
          targetObjectName: 'customers',
          throughObjectName: 'user_roles',
        },
      ],
      extraTables: [
        {
          name: 'user_roles',
          columns: [
            { name: 'user_id', dataType: 'integer', isPrimaryKey: false },
            { name: 'role_id', dataType: 'integer', isPrimaryKey: false },
          ],
        },
      ],
    });

    const m2m = graph.edges.find((edge) => edge.data?.associationId === 'assoc_m2m');
    expect(m2m?.data).toMatchObject({
      relationNature: 'logical',
      title: 'roles',
      kindLabel: 'Belongs to many · via user_roles',
      natureLabel: 'Logical',
    });
    expect(graph.edges.some((edge) => edge.data?.relationNature === 'both')).toBe(false);
  });

  it('hides through-table physical FKs covered by belongsToMany', () => {
    const selfM2mSnapshot = {
      focusTable: 'cms_contents',
      tables: [
        {
          name: 'cms_contents',
          columns: [{ name: 'id', dataType: 'bigint', isPrimaryKey: true }],
        },
        {
          name: 'cms_content_relations',
          columns: [
            { name: 'id', dataType: 'bigint', isPrimaryKey: true },
            { name: 'content_id_a', dataType: 'bigint', isPrimaryKey: false },
            { name: 'content_id_b', dataType: 'bigint', isPrimaryKey: false },
          ],
        },
      ],
      relations: [
        {
          fromTable: 'cms_content_relations',
          fromColumn: 'content_id_a',
          toTable: 'cms_contents',
          toColumn: 'id',
        },
        {
          fromTable: 'cms_content_relations',
          fromColumn: 'content_id_b',
          toTable: 'cms_contents',
          toColumn: 'id',
        },
      ],
    };
    const graph = buildEdgeSchemaFlowGraph(selfM2mSnapshot, {
      logicalRelations: [
        {
          associationId: 'assoc_related',
          kind: 'belongsToMany',
          as: 'relatedContents',
          foreignKey: 'content_id_a',
          otherKey: 'content_id_b',
          sourceObjectName: 'cms_contents',
          targetObjectName: 'cms_contents',
          throughObjectName: 'cms_content_relations',
        },
      ],
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]?.data).toMatchObject({
      relationNature: 'logical',
      title: 'relatedContents',
      kindLabel: 'Belongs to many · via cms_content_relations',
    });
  });

  it('merges overlapping physical and logical links and adds logical-only peers', () => {
    const graph = buildEdgeSchemaFlowGraph(snapshot, {
      logicalRelations: [
        {
          associationId: 'assoc_1',
          kind: 'belongsTo',
          as: 'customer',
          foreignKey: 'customer_id',
          sourceObjectName: 'orders',
          targetObjectName: 'customers',
        },
        {
          associationId: 'assoc_2',
          kind: 'hasMany',
          as: 'lines',
          foreignKey: 'order_id',
          sourceObjectName: 'orders',
          targetObjectName: 'order_lines',
        },
      ],
      extraTables: [
        {
          name: 'order_lines',
          columns: [
            { name: 'id', dataType: 'integer', isPrimaryKey: true },
            { name: 'order_id', dataType: 'integer', isPrimaryKey: false },
          ],
        },
      ],
    });

    expect(graph.nodes.map((node) => node.id).sort()).toEqual(['customers', 'order_lines', 'orders']);
    expect(graph.edges).toHaveLength(2);
    const both = graph.edges.find((edge) => edge.data?.relationNature === 'both');
    const logicalOnly = graph.edges.find((edge) => edge.data?.relationNature === 'logical');
    expect(both?.data).toMatchObject({
      title: 'customer',
      kindLabel: 'Belongs to',
      natureLabel: 'Physical',
    });
    expect(logicalOnly?.data).toMatchObject({
      title: 'lines',
      kindLabel: 'Has many',
      natureLabel: 'Logical',
    });
    expect(logicalOnly?.style).toMatchObject({ strokeDasharray: '6 4' });
  });
});
