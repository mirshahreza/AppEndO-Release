/**
 * Patch `ui_html` on CMS Base Info items from the Phase 1 catalog (Lucide icons).
 */
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import { invalidateBaseInfoOptionsCache } from '../../src/server/services/baseInfoOptionsCache';
import {
  CMS_BASE_INFO_ITEM_UI_ICONS,
  CMS_BASE_INFO_ROOT_TITLE,
  cmsBaseInfoUiHtml,
} from '../cms-phase1/seed/cmsBaseInfoCatalog';

const main = async () => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  const roots = await prisma().baseInfo.findMany({
    where: {
      parentId: null,
      OR: [
        { titleEn: CMS_BASE_INFO_ROOT_TITLE },
        { title: CMS_BASE_INFO_ROOT_TITLE },
      ],
    },
    select: { id: true },
  });

  if (roots.length === 0) {
    throw new Error(`CMS Base Info root "${CMS_BASE_INFO_ROOT_TITLE}" not found.`);
  }

  let updated = 0;
  for (const root of roots) {
    const treeScope = {
      OR: [
        { id: root.id },
        { id: { startsWith: `${root.id}.` } },
      ],
    };

    for (const [shortName, lucideIcon] of Object.entries(CMS_BASE_INFO_ITEM_UI_ICONS)) {
      const uiHtml = cmsBaseInfoUiHtml(lucideIcon);
      if (!uiHtml) {
        continue;
      }
      const result = await prisma().baseInfo.updateMany({
        where: { shortName, ...treeScope },
        data: { uiHtml },
      });
      updated += result.count;
    }
  }

  invalidateBaseInfoOptionsCache();
  console.log(`[patch-cms-ui-html] roots=${roots.map((r) => r.id).join(', ')} updated=${updated}`);
};

main()
  .catch((error: unknown) => {
    console.error('[patch-cms-ui-html]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
