/**
 * Read-only: cross-level approved electoral-tree anchors (B11 / domain invariants).
 * Same-level multi-node (direct / employees path) is expected — informational counts only.
 *
 *   npx tsx scripts/schema/probe-area-limits-invariant.ts
 */
import { QueryTypes } from 'sequelize';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized } from '../../src/server/db/controlPlaneInit';
import { getControlPlaneSequelize } from '../../src/server/db/controlPlaneSequelize';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';

const TREE_KINDS = `N'province', N'ghavateh', N'circle', N'maktab', N'region'`;

const main = async (): Promise<void> => {
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const s = getControlPlaneSequelize();

  const summary = await s.query<Record<string, number>>(
    `
    SELECT
      (SELECT COUNT(*) FROM dbo.hwy_member_area_limits) AS total_rows,
      (SELECT COUNT(DISTINCT member_id) FROM dbo.hwy_member_area_limits) AS distinct_members,
      (
        SELECT COUNT(*)
        FROM (
          SELECT member_id
          FROM dbo.hwy_member_area_limits
          WHERE ISNULL(approved, 0) = 1
          GROUP BY member_id
          HAVING COUNT(*) > 1
        ) x
      ) AS members_multi_approved_same_or_cross,
      (
        SELECT COUNT(*)
        FROM (
          SELECT al.member_id
          FROM dbo.hwy_member_area_limits al WITH (NOLOCK)
          INNER JOIN dbo.hwy_etl_geo_map g WITH (NOLOCK)
            ON g.legacy_id = al.item_id
          WHERE ISNULL(al.approved, 0) = 1
            AND g.legacy_kind IN (${TREE_KINDS})
          GROUP BY al.member_id
          HAVING COUNT(DISTINCT g.legacy_kind) > 1
        ) y
      ) AS members_multi_distinct_level
    `,
    { type: QueryTypes.SELECT },
  );

  const sampleCrossLevel = await s.query<{ member_id: number; level_count: number }>(
    `
    SELECT TOP 15 member_id, COUNT(DISTINCT g.legacy_kind) AS level_count
    FROM dbo.hwy_member_area_limits al WITH (NOLOCK)
    INNER JOIN dbo.hwy_etl_geo_map g WITH (NOLOCK)
      ON g.legacy_id = al.item_id
    WHERE ISNULL(al.approved, 0) = 1
      AND g.legacy_kind IN (${TREE_KINDS})
    GROUP BY al.member_id
    HAVING COUNT(DISTINCT g.legacy_kind) > 1
    ORDER BY COUNT(DISTINCT g.legacy_kind) DESC
    `,
    { type: QueryTypes.SELECT },
  );

  const row = summary[0] ?? {};
  const drift = Number(row.members_multi_distinct_level ?? 0);

  process.stdout.write(
    `${JSON.stringify(
      {
        summary: row,
        note: 'members_multi_approved_same_or_cross includes valid same-level direct assignment; drift = members_multi_distinct_level only',
        sampleCrossLevel,
      },
      null,
      2,
    )}\n`,
  );

  if (drift > 0) {
    process.exitCode = 1;
  }

  await s.close();
  await closePrismaControlPlane();
};

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
