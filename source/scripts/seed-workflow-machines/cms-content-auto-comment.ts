/**
 * CMS auto-comment on content create
 * Key: `cms-content-auto-comment`
 *
 * When an editorial cms_contents row is created (Data API after-hook), starts this
 * workflow which inserts one child comment row via cms.content-create.
 * Skips comment rows / replies (parentContentId set) to avoid recursion.
 *
 * Run: `npx tsx scripts/seed-workflow-machines/cms-content-auto-comment.ts`
 */
import { Pool } from 'pg';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import {
  baseModel, endNode, actionNode, unconditionalEdge,
  decisionNode, decisionEdge, decisionDefaultEdge,
  lit, workflowInputPath, workflowVariable, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser,
  drainAutomated, assertEnd, bootWorkflowMachineSeed, templateInput,
  wireManagedFunctionAfterHook,
} from './_seedHelpers';
import { resolveCmsIds } from '../cms-phase3/cmsIds';

const KEY = 'cms-content-auto-comment';
const CREATE_FN_ID = 'cms-contents.cms-contents-create';

function buildModel(ids: {
  commentTypeCode: string;
  bodyFormatCode: string;
  pendingStatusCode: string;
}): WorkflowModel {
  // Data API rows may be camelCase or snake_case depending on dialect/ORM plain shape.
  const parentId = {
    op: 'COALESCE' as const,
    values: [workflowInputPath(['data', 'id']), workflowInputPath(['data', 'Id'])],
  };
  const parentSlug = {
    op: 'COALESCE' as const,
    values: [workflowInputPath(['data', 'slug']), workflowInputPath(['data', 'Slug']), lit('content')],
  };
  const languageCode = {
    op: 'COALESCE' as const,
    values: [
      workflowInputPath(['data', 'languageCode']),
      workflowInputPath(['data', 'language_code']),
    ],
  };
  const parentTitle = {
    op: 'COALESCE' as const,
    values: [
      workflowInputPath(['data', 'title']),
      workflowInputPath(['data', 'Title']),
      lit('(untitled)'),
    ],
  };
  const parentContentId = {
    op: 'COALESCE' as const,
    values: [
      workflowInputPath(['data', 'parentContentId']),
      workflowInputPath(['data', 'parent_content_id']),
      lit(null),
    ],
  };
  const contentTypeCode = {
    op: 'COALESCE' as const,
    values: [
      workflowInputPath(['data', 'contentTypeCode']),
      workflowInputPath(['data', 'content_type_code']),
      lit(''),
    ],
  };

  return baseModel({
    key: KEY,
    name: 'CMS content auto comment',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description: 'Created cms_contents row from Data API after-hook (fields: [data]).',
          },
        },
        required: ['data'],
      },
    },
    variables: [
      { key: 'commentSlug', schema: { type: 'INLINE', schema: {} } },
      { key: 'commentBody', schema: { type: 'INLINE', schema: {} } },
      { key: 'commentId', schema: { type: 'INLINE', schema: {} } },
      { key: 'stamp', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      decisionNode('d-editorial', 'FIRST_MATCH'),
      actionNode('stamp', {
        actionRef: ACTION('date.now'),
        input: { type: 'OBJECT', fields: {} },
        outputAssignments: [
          { targetVariableKey: 'stamp', value: nodeOutput('stamp', ['iso']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('build-slug', {
        actionRef: ACTION('text.template'),
        input: templateInput(
          '{{slug}}-wf-auto-{{id}}-{{stamp}}',
          {
            slug: parentSlug,
            id: parentId,
            stamp: workflowVariable('stamp'),
          },
        ),
        outputAssignments: [
          { targetVariableKey: 'commentSlug', value: nodeOutput('build-slug', ['text']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('sanitize-slug', {
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
          { targetVariableKey: 'commentSlug', value: nodeOutput('sanitize-slug', ['text']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('build-body', {
        actionRef: ACTION('text.template'),
        input: templateInput(
          'Auto comment: welcome — content "{{title}}" was created and this note was posted by workflow.',
          { title: parentTitle },
        ),
        outputAssignments: [
          { targetVariableKey: 'commentBody', value: nodeOutput('build-body', ['text']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('create-comment', {
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
                title: { type: 'EXPRESSION', expression: lit('Auto comment') },
                body: { type: 'EXPRESSION', expression: workflowVariable('commentBody') },
                bodyFormatCode: { type: 'EXPRESSION', expression: lit(ids.bodyFormatCode) },
                parentContentId: { type: 'EXPRESSION', expression: parentId },
                authorDisplayName: { type: 'EXPRESSION', expression: lit('Workflow Bot') },
                authorEmail: { type: 'EXPRESSION', expression: lit('workflow-bot@example.com') },
              },
            },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'commentId', value: nodeOutput('create-comment', ['id']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      endNode('end-created', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('COMMENT_CREATED') },
          parentContentId: { type: 'EXPRESSION', expression: parentId },
          commentId: { type: 'EXPRESSION', expression: workflowVariable('commentId') },
        },
      }),
      endNode('end-skipped', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('SKIPPED_NON_EDITORIAL') } },
      }),
      endNode('end-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('FAILED') } },
      }),
    ],
    edges: [
      // Skip replies already under a parent (missing parent field treated as null via COALESCE).
      decisionEdge('e-has-parent', 'd-editorial', 'end-skipped', {
        op: 'NE',
        left: parentContentId,
        right: lit(null),
      }, 0),
      // Skip rows that are themselves comments.
      decisionEdge('e-is-comment', 'd-editorial', 'end-skipped', {
        op: 'EQ',
        left: contentTypeCode,
        right: lit(ids.commentTypeCode),
      }, 1),
      decisionDefaultEdge('e-editorial-ok', 'd-editorial', 'stamp'),
      errorEdge('e-stamp-err', 'stamp', 'end-failed'),
      unconditionalEdge('e-stamp-slug', 'stamp', 'build-slug'),
      errorEdge('e-slug-err', 'build-slug', 'end-failed'),
      unconditionalEdge('e-slug-san', 'build-slug', 'sanitize-slug'),
      errorEdge('e-san-err', 'sanitize-slug', 'end-failed'),
      unconditionalEdge('e-san-body', 'sanitize-slug', 'build-body'),
      errorEdge('e-body-err', 'build-body', 'end-failed'),
      unconditionalEdge('e-body-create', 'build-body', 'create-comment'),
      errorEdge('e-create-err', 'create-comment', 'end-failed'),
      unconditionalEdge('e-create-done', 'create-comment', 'end-created'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'd-editorial' },
  });
}

async function pickEditorialContent(): Promise<{
  id: number;
  slug: string;
  languageCode: string;
  title: string | null;
  contentTypeCode: string;
  parentContentId: null;
}> {
  const cmsIds = await resolveCmsIds();
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((s) => s.isDefault) ?? sources[0];
  if (!source || source.type !== 'PostgreSQL') throw new Error('need PostgreSQL CMS');
  const pool = new Pool({
    host: source.host || 'localhost',
    port: Number(source.port) || 5432,
    user: source.username || 'postgres',
    password: source.password || '',
    database: source.database || 'AppEnd',
  });
  try {
    const row = await pool.query<{
      id: string;
      slug: string;
      language_code: string;
      title: string | null;
      content_type_code: string;
    }>(
      `SELECT id::text AS id, slug, language_code, title, content_type_code
       FROM cms_contents
       WHERE parent_content_id IS NULL
         AND content_type_code <> $1
       ORDER BY id ASC
       LIMIT 1`,
      [cmsIds.contentTypeIds.comment],
    );
    const hit = row.rows[0];
    if (!hit) throw new Error('no editorial cms_contents row');
    return {
      id: Number(hit.id),
      slug: hit.slug,
      languageCode: hit.language_code,
      title: hit.title,
      contentTypeCode: hit.content_type_code,
      parentContentId: null,
    };
  } finally {
    await pool.end();
  }
}

async function main() {
  await bootWorkflowMachineSeed();
  const cmsIds = await resolveCmsIds();
  const pending = cmsIds.commentStatusIds.pending ?? cmsIds.statusIds.inReview;
  if (!pending) throw new Error('CMS comment pending/in_review status missing — run CMS Phase 1');

  const model = buildModel({
    commentTypeCode: cmsIds.contentTypeIds.comment,
    bodyFormatCode: cmsIds.bodyFormatIds.plain,
    pendingStatusCode: pending,
  });
  const { revisionId } = await ensurePublished(KEY, model);
  wireManagedFunctionAfterHook(CREATE_FN_ID, KEY, ['data']);

  const parent = await pickEditorialContent();
  console.log(`[seed] simulate create hook for cms_contents#${parent.id} (${parent.slug})`);

  const user = await pickUnlockedUser();
  if (!user) throw new Error('no user');

  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { data: parent },
    startedByType: 'SYSTEM',
    startType: 'SERVER_FUNCTION_HOOK',
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-cms-auto-comment');
  await assertEnd(instance.id, 'end-created');
  console.log('[seed] auto comment created. New CMS creates via POST /api/cms/contents will also start this workflow.');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
