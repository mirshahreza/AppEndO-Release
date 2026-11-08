/**
 * CMS auto-comment when updated content mentions "help"
 * Key: `cms-content-help-on-update`
 *
 * After cms_contents update (Data API after-hook), starts this workflow.
 * If title, summary, or body contains the word "help" (case-insensitive),
 * inserts one child comment asking what help is needed.
 * Skips comment rows / replies (parentContentId set) to avoid recursion.
 *
 * Run: `npx tsx scripts/seed-workflow-machines/cms-content-help-on-update.ts`
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

const KEY = 'cms-content-help-on-update';
const UPDATE_FN_ID = 'cms-contents.cms-contents-update';

const HELP_COMMENT_BODY =
  'Looks like you mentioned help — what kind of help do you need? Reply here and an editor will follow up.';

function buildModel(ids: {
  commentTypeCode: string;
  bodyFormatCode: string;
  pendingStatusCode: string;
}): WorkflowModel {
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
  const titleText = {
    op: 'COALESCE' as const,
    values: [
      workflowInputPath(['data', 'title']),
      workflowInputPath(['data', 'Title']),
      lit(''),
    ],
  };
  const summaryText = {
    op: 'COALESCE' as const,
    values: [
      workflowInputPath(['data', 'summary']),
      workflowInputPath(['data', 'Summary']),
      lit(''),
    ],
  };
  const bodyText = {
    op: 'COALESCE' as const,
    values: [
      workflowInputPath(['data', 'body']),
      workflowInputPath(['data', 'Body']),
      lit(''),
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
    name: 'CMS content help on update',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description: 'Updated cms_contents row from Data API after-hook (fields: [data]).',
          },
        },
        required: ['data'],
      },
    },
    variables: [
      { key: 'haystack', schema: { type: 'INLINE', schema: {} } },
      { key: 'helpMatched', schema: { type: 'INLINE', schema: {} } },
      { key: 'commentSlug', schema: { type: 'INLINE', schema: {} } },
      { key: 'commentBody', schema: { type: 'INLINE', schema: {} } },
      { key: 'commentId', schema: { type: 'INLINE', schema: {} } },
      { key: 'stamp', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      decisionNode('d-editorial', 'FIRST_MATCH'),
      actionNode('build-haystack', {
        actionRef: ACTION('text.template'),
        input: templateInput(
          '{{title}}\n{{summary}}\n{{body}}',
          { title: titleText, summary: summaryText, body: bodyText },
        ),
        outputAssignments: [
          { targetVariableKey: 'haystack', value: nodeOutput('build-haystack', ['text']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('scan-help', {
        actionRef: ACTION('text.regex-match'),
        config: {
          type: 'OBJECT',
          fields: {
            pattern: { type: 'EXPRESSION', expression: lit('\\bhelp\\b') },
            flags: { type: 'EXPRESSION', expression: lit('i') },
          },
        },
        input: {
          type: 'OBJECT',
          fields: {
            text: { type: 'EXPRESSION', expression: workflowVariable('haystack') },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'helpMatched', value: nodeOutput('scan-help', ['matched']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-help', 'FIRST_MATCH'),
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
          '{{slug}}-wf-help-{{id}}-{{stamp}}',
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
          `${HELP_COMMENT_BODY} (re: "{{title}}")`,
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
                title: { type: 'EXPRESSION', expression: lit('Help offered') },
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
          outcome: { type: 'EXPRESSION', expression: lit('HELP_COMMENT_CREATED') },
          parentContentId: { type: 'EXPRESSION', expression: parentId },
          commentId: { type: 'EXPRESSION', expression: workflowVariable('commentId') },
        },
      }),
      endNode('end-skipped', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('SKIPPED_NO_HELP_OR_NON_EDITORIAL') } },
      }),
      endNode('end-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('FAILED') } },
      }),
    ],
    edges: [
      decisionEdge('e-has-parent', 'd-editorial', 'end-skipped', {
        op: 'NE',
        left: parentContentId,
        right: lit(null),
      }, 0),
      decisionEdge('e-is-comment', 'd-editorial', 'end-skipped', {
        op: 'EQ',
        left: contentTypeCode,
        right: lit(ids.commentTypeCode),
      }, 1),
      decisionDefaultEdge('e-editorial-ok', 'd-editorial', 'build-haystack'),
      errorEdge('e-hay-err', 'build-haystack', 'end-failed'),
      unconditionalEdge('e-hay-scan', 'build-haystack', 'scan-help'),
      errorEdge('e-scan-err', 'scan-help', 'end-failed'),
      unconditionalEdge('e-scan-decide', 'scan-help', 'd-help'),
      decisionEdge('e-no-help', 'd-help', 'end-skipped', {
        op: 'NE',
        left: workflowVariable('helpMatched'),
        right: lit(true),
      }, 0),
      decisionDefaultEdge('e-has-help', 'd-help', 'stamp'),
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
  summary: string | null;
  body: string | null;
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
      summary: string | null;
      body: string | null;
      content_type_code: string;
    }>(
      `SELECT id::text AS id, slug, language_code, title, summary, body, content_type_code
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
      summary: hit.summary,
      body: hit.body,
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
  wireManagedFunctionAfterHook(UPDATE_FN_ID, KEY, ['data']);

  const parent = await pickEditorialContent();
  const withHelp = {
    ...parent,
    title: `${parent.title ?? parent.slug} — need help with wording`,
    summary: parent.summary ?? 'Draft summary',
    body: parent.body ?? 'Body without the trigger word elsewhere.',
  };
  console.log(`[seed] simulate update hook for cms_contents#${parent.id} (help in title)`);

  const user = await pickUnlockedUser();
  if (!user) throw new Error('no user');

  const { instance: hitInstance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { data: withHelp },
    startedByType: 'SYSTEM',
    startType: 'SERVER_FUNCTION_HOOK',
  });
  console.log(`[seed] help-hit instance #${hitInstance.id}`);
  await drainAutomated(hitInstance.id, 'seed-cms-help-on-update');
  await assertEnd(hitInstance.id, 'end-created');

  const withoutHelp = {
    ...parent,
    title: 'Plain update title',
    summary: 'No trigger word here',
    body: 'Just a normal edit.',
  };
  const { instance: skipInstance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { data: withoutHelp },
    startedByType: 'SYSTEM',
    startType: 'SERVER_FUNCTION_HOOK',
  });
  console.log(`[seed] no-help instance #${skipInstance.id}`);
  await drainAutomated(skipInstance.id, 'seed-cms-help-on-update-skip');
  await assertEnd(skipInstance.id, 'end-skipped');

  console.log('[seed] done. PUT /api/cms/contents/:pk will start this workflow when title/summary/body contains "help".');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
