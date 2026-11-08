/**
 * Seed sample comment rows (cms_contents with content_type=Comment) on existing editorial content.
 * Usage: npx tsx scripts/cms-phase3/seed-cms-sample-comments.ts
 */
import { createEdgeDbQueryExecutor } from '../../src/core/database/EdgeDbRouter';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import {
  ensureControlPlaneInitialized,
  resetControlPlaneInitState,
} from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { resolveCmsIds } from './cmsIds';

const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
const edgeExec = createEdgeDbQueryExecutor({ getDataSources });

const defaultDataSourceId = (): string => {
  const sources = getDataSources();
  const source = sources.find((item) => item.isDefault) ?? sources[0];
  if (!source) {
    throw new Error('CMS comment seed requires a default data source.');
  }
  return source.id;
};

const ctx = () => ({ dataSourceId: defaultDataSourceId() });

type EditorialContent = {
  id: string;
  slug: string;
  languageCode: string;
  title: string | null;
};

type CommentTemplate = {
  key: string;
  body: string;
  authorDisplayName: string;
  authorEmail: string;
  statusKey: 'approved' | 'pending' | 'rejected' | 'spam';
};

const COMMENT_TEMPLATES: CommentTemplate[] = [
  {
    key: '01',
    body: 'Thanks for sharing this — very clear and helpful.',
    authorDisplayName: 'Alex Morgan',
    authorEmail: 'alex.morgan@example.com',
    statusKey: 'approved',
  },
  {
    key: '02',
    body: 'Could you add more detail on the timeline?',
    authorDisplayName: 'Sam Rivera',
    authorEmail: 'sam.rivera@example.com',
    statusKey: 'pending',
  },
  {
    key: '03',
    body: 'We discussed this in our team meeting yesterday.',
    authorDisplayName: 'Jordan Lee',
    authorEmail: 'jordan.lee@example.com',
    statusKey: 'approved',
  },
  {
    key: '04',
    body: 'Is this still accurate for the current release?',
    authorDisplayName: 'Casey Nguyen',
    authorEmail: 'casey.nguyen@example.com',
    statusKey: 'pending',
  },
  {
    key: '05',
    body: 'Really useful overview — bookmarked for the team.',
    authorDisplayName: 'Morgan Blake',
    authorEmail: 'morgan.blake@example.com',
    statusKey: 'approved',
  },
  {
    key: '06',
    body: 'Please follow up when the next revision is published.',
    authorDisplayName: 'Riley Chen',
    authorEmail: 'riley.chen@example.com',
    statusKey: 'pending',
  },
];

const listEditorialContents = async (commentTypeCode: string): Promise<EditorialContent[]> => {
  const result = await edgeExec<{
    id: string;
    slug: string | null;
    language_code: string;
    title: string | null;
  }>(
    `SELECT id, slug, language_code, title
     FROM cms_contents
     WHERE parent_content_id IS NULL
       AND content_type_code <> ?
     ORDER BY id`,
    [commentTypeCode],
    ctx(),
  );

  return result.data
    .filter((row) => row.slug?.trim())
    .map((row) => ({
      id: String(row.id),
      slug: row.slug!.trim(),
      languageCode: row.language_code,
      title: row.title,
    }));
};

const seedCommentsForContent = async (input: {
  parent: EditorialContent;
  commentTypeCode: string;
  bodyFormatCode: string;
  statusIds: Awaited<ReturnType<typeof resolveCmsIds>>['commentStatusIds'];
  templates: CommentTemplate[];
}): Promise<number> => {
  let inserted = 0;
  const nowIso = new Date().toISOString();

  for (const template of input.templates) {
    const slug = `${input.parent.slug}-comment-${template.key}`;
    const existing = await edgeExec<{ id: string }>(
      'SELECT id FROM cms_contents WHERE language_code = ? AND slug = ?',
      [input.parent.languageCode, slug],
      ctx(),
    );
    if (existing.data.length > 0) {
      continue;
    }

    const statusCode = input.statusIds[template.statusKey];
    if (!statusCode) {
      throw new Error(`CMS comment seed: status "${template.statusKey}" is missing.`);
    }

    const title = `Comment by ${template.authorDisplayName}`;
    await edgeExec(
      `INSERT INTO cms_contents (
        content_type_code, language_code, slug, status_code, title, body,
        body_format_code, parent_content_id, author_display_name, author_email,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.commentTypeCode,
        input.parent.languageCode,
        slug,
        statusCode,
        title,
        template.body,
        input.bodyFormatCode,
        input.parent.id,
        template.authorDisplayName,
        template.authorEmail,
        nowIso,
        nowIso,
      ],
      ctx(),
    );
    inserted += 1;
  }

  return inserted;
};

const main = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  const ids = await resolveCmsIds();
  const parents = await listEditorialContents(ids.contentTypeIds.comment);
  if (parents.length === 0) {
    console.log('[CMS comments] No editorial cms_contents rows found — nothing to seed.');
    return;
  }

  let inserted = 0;
  for (const parent of parents) {
    const count = await seedCommentsForContent({
      parent,
      commentTypeCode: ids.contentTypeIds.comment,
      bodyFormatCode: ids.bodyFormatIds.plain,
      statusIds: ids.commentStatusIds,
      templates: COMMENT_TEMPLATES,
    });
    inserted += count;
    console.log(`  ${parent.title ?? parent.slug}: +${count} comment(s)`);
  }

  console.log(`[CMS comments] Done — inserted ${inserted} comment row(s) across ${parents.length} content item(s).`);
};

main().catch(async (error: unknown) => {
  console.error('[CMS comments]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await closePrismaControlPlane().catch(() => undefined);
});
