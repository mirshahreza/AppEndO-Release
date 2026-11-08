import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { ensureControlPlaneInitialized } from '../src/server/db/controlPlaneInit';
import { seedOrgGeoBaseInfo } from '../src/server/db/seedOrgGeoBaseInfo';
import { closePrismaControlPlane } from '../src/server/db/prismaControlPlane';
import { prisma } from '../src/server/domain/users/prismaHelpers';
import {
  GEO_BASE_INFO_ROOT_ID,
  ORG_BASE_INFO_ROOT_ID,
} from '../src/shared/api/contracts/org-geo/constants';

async function main() {
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });
  await seedOrgGeoBaseInfo(1);
  const org = await prisma().baseInfo.findUnique({
    where: { id: ORG_BASE_INFO_ROOT_ID },
    select: { id: true, parentId: true, titleEn: true, shortName: true },
  });
  const geo = await prisma().baseInfo.findUnique({
    where: { id: GEO_BASE_INFO_ROOT_ID },
    select: { id: true, parentId: true, titleEn: true, shortName: true },
  });
  const orgKids = await prisma().baseInfo.count({ where: { id: { startsWith: `${ORG_BASE_INFO_ROOT_ID}.` } } });
  const geoKids = await prisma().baseInfo.count({ where: { id: { startsWith: `${GEO_BASE_INFO_ROOT_ID}.` } } });
  process.stdout.write(`${JSON.stringify({ org, geo, orgKids, geoKids }, null, 2)}\n`);
  await closePrismaControlPlane();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await closePrismaControlPlane();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
