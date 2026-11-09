import { listHwyDbInstallProcedureNames } from '../../src/server/domain/hwy/hwyDbObjectCatalog';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized } from '../../src/server/db/controlPlaneInit';
import { getControlPlaneSequelize } from '../../src/server/db/controlPlaneSequelize';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { QueryTypes } from 'sequelize';

const main = async (): Promise<void> => {
  const expected = listHwyDbInstallProcedureNames();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const s = getControlPlaneSequelize();
  const rows = await s.query<{ name: string }>(
    `SELECT name FROM sys.procedures WHERE name LIKE N'hwy[_]%' ORDER BY name`,
    { type: QueryTypes.SELECT },
  );
  const actual = rows.map((r) => r.name);
  const extra = actual.filter((n) => !expected.includes(n));
  const missing = expected.filter((n) => !actual.includes(n));
  process.stdout.write(
    `${JSON.stringify({ expected: expected.length, actual: actual.length, extra, missing }, null, 2)}\n`,
  );
  await s.close();
  await closePrismaControlPlane();
};

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
