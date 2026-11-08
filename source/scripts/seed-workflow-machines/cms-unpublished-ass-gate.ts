/**
 * CMS unpublished content gate (ass filter)
 * Key: `cms-unpublished-ass-gate`
 *
 * Every minute (CRON `* * * * *`), loads one unpublished (draft) editorial cms_contents row.
 * - If title does NOT contain the word "ass" → publish it.
 * - If title contains "ass" (word boundary, case-insensitive) → insert a moderation comment
 *   ("This content is not allowed.") and move the row to in_review so the poll does not loop.
 *
 * Run: `npx tsx scripts/seed-workflow-machines/cms-unpublished-ass-gate.ts`
 */
import { Pool } from 'pg';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import { ensureReservedScheduledStartFunctionRegistered } from '../../src/server/domain/workflow/publication/bindingAdapters/scheduleBindingAdapter';
import {
  baseModel, endNode, actionNode, unconditionalEdge,
  decisionNode, decisionEdge, decisionDefaultEdge,
  lit, workflowVariable, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser,
  drainAutomated, assertEnd, bootWorkflowMachineSeed, templateInput,
} from './_seedHelpers';
import { resolveCmsIds } from '../cms-phase3/cmsIds';

const KEY = 'cms-unpublished-ass-gate';
const CRON_EVERY_MINUTE = '* * * * *';
const BLOCK_COMMENT_BODY = 'This content is not allowed.';

function buildModel(ids: {
  dataSourceId: string;
  commentTypeCode: string;
  bodyFormatCode: string;
  pendingStatusCode: string;
  publishedStatusCode: string;
  inReviewStatusCode: string;
  draftStatusCode: string;
}): WorkflowModel {
  const contentId = nodeOutput('query-drafts', ['rows', 0, 'id']);
  const title = {
    op: 'COALESCE' as const,
    values: [nodeOutput('query-drafts', ['rows', 0, 'title']), lit('')],
  };
  const slug = {
    op: 'COALESCE' as const,
    values: [nodeOutput('query-drafts', ['rows', 0, 'slug']), lit('content')],
  };
  const languageCode = nodeOutput('query-drafts', ['rows', 0, 'language_code']);

  const draftSql = [
    'SELECT c.id::text AS id, c.slug AS slug, COALESCE(c.title, \'\') AS title, c.language_code AS language_code',
    'FROM cms_contents c',
    `JOIN base_info st ON st.id = c.status_code AND st.id = '${ids.draftStatusCode}'`,
    'WHERE c.parent_content_id IS NULL',
    `AND c.content_type_code <> '${ids.commentTypeCode}'`,
    'ORDER BY c.id ASC',
    'LIMIT 1',
  ].join(' ');

  return baseModel({
    key: KEY,
    name: 'CMS unpublished ass gate',
    inputSchema: {
      type: 'INLINE',
      // Schedule start passes null input; also accept empty object for manual starts.
      schema: {},
    },
    variables: [
      { key: 'assMatched', schema: { type: 'INLINE', schema: {} } },
      { key: 'publishedAtIso', schema: { type: 'INLINE', schema: {} } },
      { key: 'commentSlug', schema: { type: 'INLINE', schema: {} } },
      { key: 'stamp', schema: { type: 'INLINE', schema: {} } },
      { key: 'commentId', schema: { type: 'INLINE', schema: {} } },
      { key: 'actorUserId', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('query-drafts', {
        actionRef: ACTION('data.db-query'),
        config: {
          type: 'OBJECT',
          fields: {
            dataSourceId: { type: 'EXPRESSION', expression: lit(ids.dataSourceId) },
          },
        },
        input: {
          type: 'OBJECT',
          fields: {
            sql: { type: 'EXPRESSION', expression: lit(draftSql) },
            params: { type: 'EXPRESSION', expression: lit([]) },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-has-draft', 'FIRST_MATCH'),
      actionNode('load-actor', {
        actionRef: ACTION('identity.role-members'),
        input: {
          type: 'OBJECT',
          fields: { roleName: { type: 'EXPRESSION', expression: lit('ADMIN') } },
        },
        outputAssignments: [
          { targetVariableKey: 'actorUserId', value: nodeOutput('load-actor', ['members', 0, 'userId']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('scan-ass', {
        actionRef: ACTION('text.regex-match'),
        config: {
          type: 'OBJECT',
          fields: {
            pattern: { type: 'EXPRESSION', expression: lit('\\bass\\b') },
            flags: { type: 'EXPRESSION', expression: lit('i') },
          },
        },
        input: {
          type: 'OBJECT',
          fields: {
            text: { type: 'EXPRESSION', expression: title },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'assMatched', value: nodeOutput('scan-ass', ['matched']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-ass', 'FIRST_MATCH'),
      actionNode('stamp-now', {
        actionRef: ACTION('date.now'),
        input: { type: 'OBJECT', fields: {} },
        outputAssignments: [
          { targetVariableKey: 'publishedAtIso', value: nodeOutput('stamp-now', ['iso']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('publish-content', {
        actionRef: ACTION('cms.content-update'),
        input: {
          type: 'OBJECT',
          fields: {
            contentId: { type: 'EXPRESSION', expression: contentId },
            fields: {
              type: 'OBJECT',
              fields: {
                statusCode: { type: 'EXPRESSION', expression: lit(ids.publishedStatusCode) },
                publishedAt: { type: 'EXPRESSION', expression: workflowVariable('publishedAtIso') },
                statusCodeUpdatedBy: { type: 'EXPRESSION', expression: workflowVariable('actorUserId') },
                updatedBy: { type: 'EXPRESSION', expression: workflowVariable('actorUserId') },
                operatorNote: {
                  type: 'EXPRESSION',
                  expression: lit('Auto-published by cms-unpublished-ass-gate'),
                },
              },
            },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      actionNode('stamp-comment', {
        actionRef: ACTION('date.now'),
        input: { type: 'OBJECT', fields: {} },
        outputAssignments: [
          { targetVariableKey: 'stamp', value: nodeOutput('stamp-comment', ['iso']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('build-comment-slug', {
        actionRef: ACTION('text.template'),
        input: templateInput(
          '{{slug}}-wf-ass-block-{{id}}-{{stamp}}',
          {
            slug,
            id: contentId,
            stamp: workflowVariable('stamp'),
          },
        ),
        outputAssignments: [
          { targetVariableKey: 'commentSlug', value: nodeOutput('build-comment-slug', ['text']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('sanitize-comment-slug', {
        actionRef: ACTION('text.replace'),
        input: {
          type: 'OBJECT',
          fields: {
            text: { type: 'EXPRESSION', expression: workflowVariable('commentSlug') },
            search: { type: 'EXPRESSION', expression: lit(':') },
            replacement: { type: 'EXPRESSION', expression: lit('-') },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'commentSlug', value: nodeOutput('sanitize-comment-slug', ['text']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('create-block-comment', {
        actionRef: ACTION('cms.content-create'),
        input: {
          type: 'OBJECT',
          fields: {
            fields: {
              type: 'OBJECT',
              fields: {
                contentTypeCode: { type: 'EXPRESSION', expression: lit(ids.commentTypeCode) },
                languageCode: { type: 'EXPRESSION', expression: languageCode },
                slug: { type: 'EXPRESSION', expression: workflowVariable('commentSlug') },
                statusCode: { type: 'EXPRESSION', expression: lit(ids.pendingStatusCode) },
                title: { type: 'EXPRESSION', expression: lit('Moderation note') },
                body: { type: 'EXPRESSION', expression: lit(BLOCK_COMMENT_BODY) },
                bodyFormatCode: { type: 'EXPRESSION', expression: lit(ids.bodyFormatCode) },
                parentContentId: { type: 'EXPRESSION', expression: contentId },
                authorDisplayName: { type: 'EXPRESSION', expression: lit('Workflow Bot') },
                authorEmail: { type: 'EXPRESSION', expression: lit('workflow-bot@example.com') },
              },
            },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'commentId', value: nodeOutput('create-block-comment', ['id']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('hold-in-review', {
        actionRef: ACTION('cms.content-update'),
        input: {
          type: 'OBJECT',
          fields: {
            contentId: { type: 'EXPRESSION', expression: contentId },
            fields: {
              type: 'OBJECT',
              fields: {
                statusCode: { type: 'EXPRESSION', expression: lit(ids.inReviewStatusCode) },
                statusCodeUpdatedBy: { type: 'EXPRESSION', expression: workflowVariable('actorUserId') },
                updatedBy: { type: 'EXPRESSION', expression: workflowVariable('actorUserId') },
                operatorNote: { type: 'EXPRESSION', expression: lit(BLOCK_COMMENT_BODY) },
              },
            },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-idle', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('IDLE_NO_DRAFT') } },
      }),
      endNode('end-published', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('PUBLISHED') },
          contentId: { type: 'EXPRESSION', expression: contentId },
          title: { type: 'EXPRESSION', expression: title },
        },
      }),
      endNode('end-blocked', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('BLOCKED_ASS') },
          contentId: { type: 'EXPRESSION', expression: contentId },
          commentId: { type: 'EXPRESSION', expression: workflowVariable('commentId') },
          title: { type: 'EXPRESSION', expression: title },
        },
      }),
      endNode('end-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-query-err', 'query-drafts', 'end-failed'),
      unconditionalEdge('e-query-dec', 'query-drafts', 'd-has-draft'),
      decisionEdge('e-no-draft', 'd-has-draft', 'end-idle', {
        op: 'EQ',
        left: nodeOutput('query-drafts', ['count']),
        right: lit(0),
      }, 0),
      decisionDefaultEdge('e-has-draft', 'd-has-draft', 'load-actor'),
      errorEdge('e-actor-err', 'load-actor', 'end-failed'),
      unconditionalEdge('e-actor-scan', 'load-actor', 'scan-ass'),
      errorEdge('e-scan-err', 'scan-ass', 'end-failed'),
      unconditionalEdge('e-scan-dec', 'scan-ass', 'd-ass'),
      decisionEdge('e-has-ass', 'd-ass', 'stamp-comment', {
        op: 'EQ',
        left: workflowVariable('assMatched'),
        right: lit(true),
      }, 0),
      decisionDefaultEdge('e-clean', 'd-ass', 'stamp-now'),
      unconditionalEdge('e-stamp-pub', 'stamp-now', 'publish-content'),
      errorEdge('e-pub-err', 'publish-content', 'end-failed'),
      unconditionalEdge('e-pub-done', 'publish-content', 'end-published'),
      unconditionalEdge('e-cstamp-slug', 'stamp-comment', 'build-comment-slug'),
      errorEdge('e-slug-err', 'build-comment-slug', 'end-failed'),
      unconditionalEdge('e-slug-san', 'build-comment-slug', 'sanitize-comment-slug'),
      errorEdge('e-san-err', 'sanitize-comment-slug', 'end-failed'),
      unconditionalEdge('e-san-create', 'sanitize-comment-slug', 'create-block-comment'),
      errorEdge('e-create-err', 'create-block-comment', 'end-failed'),
      unconditionalEdge('e-create-hold', 'create-block-comment', 'hold-in-review'),
      errorEdge('e-hold-err', 'hold-in-review', 'end-failed'),
      unconditionalEdge('e-hold-done', 'hold-in-review', 'end-blocked'),
    ],
    start: {
      type: 'SCHEDULE',
      targetNodeKey: 'query-drafts',
      scheduledTaskBinding: { bindingType: 'CRON', bindingId: CRON_EVERY_MINUTE },
    },
  });
}

async function openCmsPool(): Promise<Pool> {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((s) => s.isDefault) ?? sources[0];
  if (!source || source.type !== 'PostgreSQL') throw new Error('need PostgreSQL CMS');
  return new Pool({
    host: source.host || 'localhost',
    port: Number(source.port) || 5432,
    user: source.username || 'postgres',
    password: source.password || '',
    database: source.database || 'AppEnd',
  });
}

async function insertDraft(title: string): Promise<number> {
  const cmsIds = await resolveCmsIds();
  const draft = cmsIds.statusIds.draft;
  if (!draft) throw new Error('CMS draft status missing — run CMS Phase 1');
  const article = await prisma().baseInfo.findFirst({
    where: { parentId: cmsIds.categoryIds['Content Types'], shortName: 'article', isActive: true },
    select: { id: true },
  });
  const language = await prisma().baseInfo.findFirst({
    where: { parentId: cmsIds.categoryIds.Languages, isActive: true },
    orderBy: { viewOrder: 'asc' },
    select: { id: true },
  });
  if (!article || !language) throw new Error('CMS article type or language missing — run CMS Phase 1');

  const pool = await openCmsPool();
  try {
    const slug = `wf-ass-gate-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO cms_contents (
         content_type_code, language_code, slug, status_code,
         title, summary, body, body_format_code
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id::text AS id`,
      [
        article.id,
        language.id,
        slug,
        draft,
        title,
        'Ass-gate seed summary',
        'Ass-gate seed body',
        cmsIds.bodyFormatIds.plain,
      ],
    );
    const id = Number(inserted.rows[0]?.id);
    if (!id) throw new Error('failed to insert draft cms_contents row');
    console.log(`[seed] inserted draft cms_contents#${id} title=${JSON.stringify(title)}`);
    return id;
  } finally {
    await pool.end();
  }
}

async function main() {
  await bootWorkflowMachineSeed();
  await ensureReservedScheduledStartFunctionRegistered();

  const cmsIds = await resolveCmsIds();
  const published = cmsIds.statusIds.published;
  const draft = cmsIds.statusIds.draft;
  const inReview = cmsIds.statusIds.inReview;
  const pending = cmsIds.commentStatusIds.pending ?? cmsIds.statusIds.inReview;
  if (!published || !draft || !inReview || !pending) {
    throw new Error('CMS published/draft/in_review/pending statuses missing — run CMS Phase 1');
  }

  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((s) => s.isDefault) ?? sources[0];
  if (!source || source.type !== 'PostgreSQL') throw new Error('need PostgreSQL data source');

  const model = buildModel({
    dataSourceId: source.id,
    commentTypeCode: cmsIds.contentTypeIds.comment,
    bodyFormatCode: cmsIds.bodyFormatIds.plain,
    pendingStatusCode: pending,
    publishedStatusCode: published,
    inReviewStatusCode: inReview,
    draftStatusCode: draft,
  });
  const { revisionId } = await ensurePublished(KEY, model);

  const user = await pickUnlockedUser();
  if (!user) throw new Error('no user');

  // Branch A — clean title → publish
  await insertDraft('Clean publish candidate');
  const { instance: publishInstance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: null,
    startedByType: 'SYSTEM',
    startType: 'SCHEDULE',
  });
  console.log(`[seed] clean-title instance #${publishInstance.id}`);
  await drainAutomated(publishInstance.id, 'seed-cms-ass-gate-publish');
  await assertEnd(publishInstance.id, 'end-published');

  // Branch B — title contains word "ass" → comment + hold
  await insertDraft('Blocked ass sample for moderation');
  const { instance: blockInstance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: null,
    startedByType: 'SYSTEM',
    startType: 'SCHEDULE',
  });
  console.log(`[seed] ass-title instance #${blockInstance.id}`);
  await drainAutomated(blockInstance.id, 'seed-cms-ass-gate-block');
  await assertEnd(blockInstance.id, 'end-blocked');

  console.log(`[seed] done. Scheduler CRON "${CRON_EVERY_MINUTE}" is active for revision #${revisionId}.`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
