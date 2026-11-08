/**

 * Patch `ui_color` on every CMS Base Info tree (all CMS roots + descendants).

 */

import { SETTINGS_PATH } from '../../src/server/config/settingsFile';

import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';

import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';

import { prisma } from '../../src/server/domain/users/prismaHelpers';

import { invalidateBaseInfoOptionsCache } from '../../src/server/services/baseInfoOptionsCache';

import { CMS_BASE_INFO_ROOT_TITLE } from '../cms-phase1/seed/cmsBaseInfoCatalog';

import { CMS_BASE_INFO_ITEM_UI_COLORS } from '../cms-phase1/seed/cmsBaseInfoUiColors';



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

    select: { id: true, titleEn: true },

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



    for (const [shortName, uiColor] of Object.entries(CMS_BASE_INFO_ITEM_UI_COLORS)) {

      const result = await prisma().baseInfo.updateMany({

        where: { shortName, ...treeScope },

        data: { uiColor },

      });

      updated += result.count;

    }



    const nullItemColors = await prisma().baseInfo.count({

      where: {

        ...treeScope,

        shortName: { not: null },

        uiColor: null,

      },

    });



    console.log(`[patch-cms-ui-colors] root=${root.id} null_item_colors=${nullItemColors}`);

  }



  invalidateBaseInfoOptionsCache();

  console.log(`[patch-cms-ui-colors] roots=${roots.map((r) => r.id).join(', ')} updated=${updated}`);

};



main()

  .catch((error: unknown) => {

    console.error('[patch-cms-ui-colors]', error instanceof Error ? error.message : error);

    process.exitCode = 1;

  })

  .finally(async () => {

    await closePrismaControlPlane().catch(() => undefined);

  });

