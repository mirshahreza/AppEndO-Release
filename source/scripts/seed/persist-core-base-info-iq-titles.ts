/**
 * Seed iq (Arabic) display titles for platform Base Info nodes (canonical English titles).
 *
 *   npx tsx scripts/seed/persist-core-base-info-iq-titles.ts
 */
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized } from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { ensureBaseInfoCultureTextTable } from '../../src/server/domain/base-info/baseInfoCultureTextSequelizeModel';
import { rebuildAllBaseInfoCultureTextFromTranslationStore } from '../../src/server/domain/base-info/baseInfoCultureTextSqlSync';
import { recomputeAllBaseInfoTitlePaths } from '../../src/server/domain/base-info/baseInfoTitlePath';
import { ensureBaseInfoTitlePathTable } from '../../src/server/domain/base-info/baseInfoTitlePathSequelizeModel';
import { persistBaseInfoLocaleTextsBulk } from '../../src/server/domain/base-info/baseInfoCultureTranslationStore';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import { isGeoPlaceholderCanonicalTitle, resolveGeoPlaceholderDisplayTitle } from '../../src/shared/lib/baseInfoGeoPlaceholderTitle';
import { CORE_BASE_INFO_IQ_TITLES_BY_ENGLISH } from './coreBaseInfoIqTitlesByEnglish';

const isMostlyLatin = (text: string): boolean => /[A-Za-z]/.test(text);

async function main(): Promise<void> {
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });

  const rows = await prisma().baseInfo.findMany({
    select: { id: true, title: true },
  });

  const entries: Array<{ baseInfoId: string; locales: { iq: { title: string } } }> = [];

  for (const row of rows) {
    const canonical = String(row.title ?? '').trim();
    if (!canonical) {
      continue;
    }
    const mapped = CORE_BASE_INFO_IQ_TITLES_BY_ENGLISH[canonical];
    if (mapped) {
      entries.push({
        baseInfoId: row.id,
        locales: { iq: { title: mapped } },
      });
      continue;
    }
    if (isGeoPlaceholderCanonicalTitle(canonical)) {
      const geoTitle = resolveGeoPlaceholderDisplayTitle('iq', canonical);
      if (geoTitle) {
        entries.push({
          baseInfoId: row.id,
          locales: { iq: { title: geoTitle } },
        });
      }
      continue;
    }
    if (isMostlyLatin(canonical)) {
      continue;
    }
  }

  if (entries.length > 0) {
    persistBaseInfoLocaleTextsBulk(entries);
  }

  console.log(`[base-info-iq] persisted ${entries.length} iq title override(s).`);

  await ensureBaseInfoCultureTextTable();
  await ensureBaseInfoTitlePathTable();
  const mirrored = await rebuildAllBaseInfoCultureTextFromTranslationStore();
  console.log('[base-info-iq] mirrored base_info_culture_text rows:', mirrored);
  await recomputeAllBaseInfoTitlePaths();
  console.log('[base-info-iq] recomputed base_info_title_path.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePrismaControlPlane());
