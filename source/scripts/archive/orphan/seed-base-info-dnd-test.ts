import { Pool } from 'pg';
import { toPgPoolConfig } from '../src/server/config/env';

type NewNode = {
  id: string;
  title: string;
  parentId: string | null;
};

const toConnectionConfig = () => toPgPoolConfig();

const insertNode = async (
  client: Pool,
  actorId: number | null,
  input: {
    parentId: string | null;
    title: string;
    viewOrder: number;
    isActive?: boolean;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `
      SELECT zz_insert_base_info_node(
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18
      ) AS id
    `,
    [
      input.parentId,
      3,
      input.title,
      input.title,
      input.title,
      input.title,
      null,
      input.viewOrder,
      null,
      null,
      null,
      null,
      null,
      null,
      input.isActive ?? true,
      null,
      null,
      actorId,
    ],
  );

  return result.rows[0].id;
};

const main = async () => {
  const pool = new Pool(toConnectionConfig());
  const created: NewNode[] = [];

  try {
    await pool.query('BEGIN');

    const actorResult = await pool.query<{ id: number }>(
      `SELECT id FROM base_users WHERE username = 'admin' ORDER BY id ASC LIMIT 1`,
    );
    const actorId = actorResult.rows[0]?.id ?? null;

    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);

    const rootA = await insertNode(pool, actorId, {
      parentId: null,
      title: `DND Test Root A ${stamp}`,
      viewOrder: 9001,
      isActive: true,
    });
    created.push({ id: rootA, title: `DND Test Root A ${stamp}`, parentId: null });

    const rootB = await insertNode(pool, actorId, {
      parentId: null,
      title: `DND Test Root B ${stamp}`,
      viewOrder: 9002,
      isActive: true,
    });
    created.push({ id: rootB, title: `DND Test Root B ${stamp}`, parentId: null });

    const rootC = await insertNode(pool, actorId, {
      parentId: null,
      title: `DND Test Root C ${stamp}`,
      viewOrder: 9003,
      isActive: false,
    });
    created.push({ id: rootC, title: `DND Test Root C ${stamp}`, parentId: null });

    const aChild1 = await insertNode(pool, actorId, {
      parentId: rootA,
      title: `DND Test A Child 1 ${stamp}`,
      viewOrder: 1,
      isActive: true,
    });
    created.push({ id: aChild1, title: `DND Test A Child 1 ${stamp}`, parentId: rootA });

    const aChild2 = await insertNode(pool, actorId, {
      parentId: rootA,
      title: `DND Test A Child 2 ${stamp}`,
      viewOrder: 2,
      isActive: false,
    });
    created.push({ id: aChild2, title: `DND Test A Child 2 ${stamp}`, parentId: rootA });

    const aGrandChild = await insertNode(pool, actorId, {
      parentId: aChild1,
      title: `DND Test A Grandchild ${stamp}`,
      viewOrder: 1,
      isActive: true,
    });
    created.push({ id: aGrandChild, title: `DND Test A Grandchild ${stamp}`, parentId: aChild1 });

    const bChild1 = await insertNode(pool, actorId, {
      parentId: rootB,
      title: `DND Test B Child 1 ${stamp}`,
      viewOrder: 1,
      isActive: true,
    });
    created.push({ id: bChild1, title: `DND Test B Child 1 ${stamp}`, parentId: rootB });

    await pool.query('COMMIT');

    console.log('Created BaseInfo DnD test nodes (no existing rows modified):');
    for (const row of created) {
      console.log(`- id=${row.id} parent=${row.parentId ?? 'ROOT'} title=${row.title}`);
    }
  } catch (error: any) {
    await pool.query('ROLLBACK');
    console.error('seed-base-info-dnd-test failed:', error?.message || error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

void main();
