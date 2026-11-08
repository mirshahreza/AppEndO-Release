/**
 * Clear `ui_html` on the CMS Base Info tree (root + all descendants).
 */
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import { CMS_BASE_INFO_ROOT_TITLE } from '../cms-phase1/seed/cmsBaseInfoCatalog';
import { invalidateBaseInfoOptionsCache } from '../../src/server/services/baseInfoOptionsCache';

const main = async () => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  const root = await prisma().baseInfo.findFirst({
    where: {
      parentId: null,
      OR: [{ titleEn: CMS_BASE_INFO_ROOT_TITLE }, { title: CMS_BASE_INFO_ROOT_TITLE }],
    },
    select: { id: true },
  });
  if (!root) {
    console.log('[patch-cms-ui-html-clear] CMS root not found — skip');
    return;
  }

  const result = await prisma().baseInfo.updateMany({
    where: {
      OR: [
        { id: root.id },
        { id: { startsWith: `${root.id}.` } },
      ],
    },
    data: { uiHtml: null },
  });

  invalidateBaseInfoOptionsCache();

  const remaining = await prisma().baseInfo.count({
    where: {
      OR: [
        { id: root.id },
        { id: { startsWith: `${root.id}.` } },
      ],
      uiHtml: { not: null },
    },
  });

  console.log(`[patch-cms-ui-html-clear] cleared=${result.count} remaining_non_null=${remaining}`);
};

main()
  .catch((error: unknown) => {
    console.error('[patch-cms-ui-html-clear]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
