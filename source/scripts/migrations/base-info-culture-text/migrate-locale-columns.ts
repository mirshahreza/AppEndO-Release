/**
 * One-time: move base_info title_* / note_* locale columns into platformCultureTranslations
 * and rebuild base_info_title_path. Run after deploying schema without locale columns.
 *
 *   npx tsx scripts/migrations/base-info-culture-text/migrate-locale-columns.ts
 */
import { SETTINGS_PATH } from '../../../src/server/config/settingsFile';
import { getControlPlaneSequelize } from '../../../src/server/db/controlPlaneSequelize';
import { ensureControlPlaneInitialized } from '../../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../../src/server/db/prismaControlPlane';
import { rebuildAllBaseInfoCultureTextFromTranslationStore } from '../../../src/server/domain/base-info/baseInfoCultureTextSqlSync';
import { recomputeAllBaseInfoTitlePaths } from '../../../src/server/domain/base-info/baseInfoTitlePath';
import { persistBaseInfoLocaleTextsBulk } from '../../../src/server/domain/base-info/baseInfoCultureTranslationStore';
import { ensureBaseInfoTitlePathTable } from '../../../src/server/domain/base-info/baseInfoTitlePathSequelizeModel';
import { prisma } from '../../../src/server/domain/users/prismaHelpers';
import { bootstrapPlatformCultureTranslationsFromSettings } from '../../../src/server/services/platform/platformCultureTranslations.service';

type LegacyRow = {
  id: string;
  title: string | null;
  title_en: string | null;
  title_fa: string | null;
  title_ar: string | null;
  note: string | null;
  note_en: string | null;
  note_fa: string | null;
  note_ar: string | null;
};

const pickCanonicalTitle = (row: LegacyRow): string | null => {
  const candidates = [row.title_en, row.title];
  for (const value of candidates) {
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return null;
};

const pickCanonicalNote = (row: LegacyRow): string | null => {
  const candidates = [row.note_en, row.note];
  for (const value of candidates) {
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return null;
};

async function loadLegacyRows(): Promise<LegacyRow[]> {
  const sequelize = await getControlPlaneSequelize();
  const dialect = sequelize.getDialect();
  if (dialect === 'mssql') {
    const [rows] = await sequelize.query(`
      SELECT id, title, title_en, title_fa, title_ar, note, note_en, note_fa, note_ar
      FROM base_info
    `);
    return rows as LegacyRow[];
  }

  try {
    const [rows] = await sequelize.query(`
      SELECT id, title, title_en, title_fa, title_ar, note, note_en, note_fa, note_ar
      FROM base_info
    `);
    return rows as LegacyRow[];
  } catch {
    const rows = await prisma().baseInfo.findMany({
      select: { id: true, title: true, note: true },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      title_en: row.title,
      title_fa: null,
      title_ar: null,
      note: row.note,
      note_en: row.note,
      note_fa: null,
      note_ar: null,
    }));
  }
}

async function main(): Promise<void> {
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  bootstrapPlatformCultureTranslationsFromSettings(SETTINGS_PATH);
  await ensureBaseInfoTitlePathTable();

  const legacyRows = await loadLegacyRows();
  console.log(`[base-info-i18n] Loaded ${legacyRows.length} base_info rows.`);

  const translationEntries: Array<{ baseInfoId: string; locales: Record<string, { title?: string; note?: string }> }> = [];

  for (const row of legacyRows) {
    const canonicalTitle = pickCanonicalTitle(row);
    const canonicalNote = pickCanonicalNote(row);

    await prisma().baseInfo.update({
      where: { id: row.id },
      data: {
        title: canonicalTitle,
        note: canonicalNote,
      },
    });

    const locales: Record<string, { title?: string; note?: string }> = {};
    const titleFa = String(row.title_fa ?? '').trim();
    const titleAr = String(row.title_ar ?? '').trim();
    const noteFa = String(row.note_fa ?? '').trim();
    const noteAr = String(row.note_ar ?? '').trim();

    if (titleFa && titleFa !== canonicalTitle) {
      locales.ir = { ...(locales.ir ?? {}), title: titleFa };
    }
    if (titleAr && titleAr !== canonicalTitle) {
      locales.iq = { ...(locales.iq ?? {}), title: titleAr };
    }
    if (noteFa && noteFa !== canonicalNote) {
      locales.ir = { ...(locales.ir ?? {}), note: noteFa };
    }
    if (noteAr && noteAr !== canonicalNote) {
      locales.iq = { ...(locales.iq ?? {}), note: noteAr };
    }

    if (Object.keys(locales).length > 0) {
      translationEntries.push({ baseInfoId: row.id, locales });
    }
  }

  if (translationEntries.length > 0) {
    persistBaseInfoLocaleTextsBulk(translationEntries);
    console.log(`[base-info-i18n] Seeded culture translations for ${translationEntries.length} nodes.`);
  }

  const sqlTitleRows = await rebuildAllBaseInfoCultureTextFromTranslationStore();
  console.log(`[base-info-i18n] Mirrored ${sqlTitleRows} rows into base_info_culture_text.`);

  await recomputeAllBaseInfoTitlePaths();
  console.log('[base-info-i18n] Recomputed base_info_title_path for all cultures.');

  await closePrismaControlPlane();
  const sequelize = await getControlPlaneSequelize();
  await sequelize.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
