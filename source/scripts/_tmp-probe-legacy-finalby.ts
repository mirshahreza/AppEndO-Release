import sql from 'mssql';

import { readLegacyConn } from './hwy-etl/legacyConn';

async function main(): Promise<void> {
  const pool = await sql.connect(readLegacyConn());
  const result = await pool.request().query(`
    SELECT TOP 10 FinalBy, COUNT(*) AS n
    FROM dbo.HWY_Members_TarghinHistory WITH (NOLOCK)
    WHERE FinalResult = 1 AND FinalBy IS NOT NULL
    GROUP BY FinalBy
    ORDER BY COUNT(*) DESC
  `);
  console.log(result.recordset);
  await pool.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
