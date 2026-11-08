/**
 * CMS boob censor on content create/update
 * Key: `cms-content-boob-censor`
 *
 * After cms_contents create or update (Data API after-hook), starts this workflow.
 * If title, summary, or body contains the word "boob" (case-insensitive, word boundary),
 * replaces each match with **** via INLINE_CODE, then writes back with cms.content-update.
 *
 * Run: `npx tsx scripts/seed-workflow-machines/cms-content-boob-censor.ts`
 *
 * Note: after-hook is one workflow per managed function — this seed wires both
 * cms-contents-create and cms-contents-update to this definition (replacing any prior after-hook).
 */
import { Pool } from 'pg';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
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

const KEY = 'cms-content-boob-censor';
const CREATE_FN_ID = 'cms-contents.cms-contents-create';
const UPDATE_FN_ID = 'cms-contents.cms-contents-update';

const CENSOR_CODE = `
const asText = (v) => (v == null ? '' : String(v));
const censor = (v) => asText(v).replace(/\\bboob\\b/gi, '****');
const body = req.body || {};
const title = censor(body.title);
const summary = censor(body.summary);
const text = censor(body.body);
res.json({
  title,
  summary,
  body: text,
  changed:
    title !== asText(body.title)
    || summary !== asText(body.summary)
    || text !== asText(body.body),
});
`.trim();

function buildModel(): WorkflowModel {
  const contentId = {
    op: 'COALESCE' as const,
    values: [workflowInputPath(['data', 'id']), workflowInputPath(['data', 'Id'])],
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

  return baseModel({
    key: KEY,
    name: 'CMS content boob censor',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description: 'cms_contents row from Data API after-hook (fields: [data]).',
          },
        },
        required: ['data'],
      },
    },
    variables: [
      { key: 'haystack', schema: { type: 'INLINE', schema: {} } },
      { key: 'boobMatched', schema: { type: 'INLINE', schema: {} } },
      { key: 'cleanTitle', schema: { type: 'INLINE', schema: {} } },
      { key: 'cleanSummary', schema: { type: 'INLINE', schema: {} } },
      { key: 'cleanBody', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
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
      actionNode('scan-boob', {
        actionRef: ACTION('text.regex-match'),
        config: {
          type: 'OBJECT',
          fields: {
            pattern: { type: 'EXPRESSION', expression: lit('\\bboob\\b') },
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
          { targetVariableKey: 'boobMatched', value: nodeOutput('scan-boob', ['matched']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-boob', 'FIRST_MATCH'),
      actionNode('censor-fields', {
        actionRef: {
          type: 'INLINE_CODE',
          language: 'js',
          code: CENSOR_CODE,
        },
        input: {
          type: 'OBJECT',
          fields: {
            title: { type: 'EXPRESSION', expression: titleText },
            summary: { type: 'EXPRESSION', expression: summaryText },
            body: { type: 'EXPRESSION', expression: bodyText },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'cleanTitle', value: nodeOutput('censor-fields', ['title']) },
          { targetVariableKey: 'cleanSummary', value: nodeOutput('censor-fields', ['summary']) },
          { targetVariableKey: 'cleanBody', value: nodeOutput('censor-fields', ['body']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('save-censored', {
        actionRef: ACTION('cms.content-update'),
        input: {
          type: 'OBJECT',
          fields: {
            contentId: { type: 'EXPRESSION', expression: contentId },
            fields: {
              type: 'OBJECT',
              fields: {
                title: { type: 'EXPRESSION', expression: workflowVariable('cleanTitle') },
                summary: { type: 'EXPRESSION', expression: workflowVariable('cleanSummary') },
                body: { type: 'EXPRESSION', expression: workflowVariable('cleanBody') },
              },
            },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-censored', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('CENSORED') },
          contentId: { type: 'EXPRESSION', expression: contentId },
          title: { type: 'EXPRESSION', expression: workflowVariable('cleanTitle') },
        },
      }),
      endNode('end-skipped', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('SKIPPED_NO_BOOB') } },
      }),
      endNode('end-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-hay-err', 'build-haystack', 'end-failed'),
      unconditionalEdge('e-hay-scan', 'build-haystack', 'scan-boob'),
      errorEdge('e-scan-err', 'scan-boob', 'end-failed'),
      unconditionalEdge('e-scan-decide', 'scan-boob', 'd-boob'),
      decisionEdge('e-no-boob', 'd-boob', 'end-skipped', {
        op: 'NE',
        left: workflowVariable('boobMatched'),
        right: lit(true),
      }, 0),
      decisionDefaultEdge('e-has-boob', 'd-boob', 'censor-fields'),
      errorEdge('e-censor-err', 'censor-fields', 'end-failed'),
      unconditionalEdge('e-censor-save', 'censor-fields', 'save-censored'),
      errorEdge('e-save-err', 'save-censored', 'end-failed'),
      unconditionalEdge('e-save-done', 'save-censored', 'end-censored'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'build-haystack' },
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

async function ensureSampleContent(): Promise<{
  id: number;
  slug: string;
  title: string | null;
  summary: string | null;
  body: string | null;
}> {
  const pool = await openCmsPool();
  try {
    const existing = await pool.query<{
      id: string;
      slug: string;
      title: string | null;
      summary: string | null;
      body: string | null;
    }>(
      `SELECT id::text AS id, slug, title, summary, body
       FROM cms_contents
       WHERE parent_content_id IS NULL
       ORDER BY id ASC
       LIMIT 1`,
    );
    const hit = existing.rows[0];
    if (hit) {
      return {
        id: Number(hit.id),
        slug: hit.slug,
        title: hit.title,
        summary: hit.summary,
        body: hit.body,
      };
    }

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

    const slug = `wf-boob-censor-${Date.now()}`;
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
        'Boob censor seed',
        'Seed summary',
        'Seed body',
        cmsIds.bodyFormatIds.plain,
      ],
    );
    const id = Number(inserted.rows[0]?.id);
    if (!id) throw new Error('failed to insert sample cms_contents row');
    console.log(`[seed] inserted sample cms_contents#${id} (${slug})`);
    return {
      id,
      slug,
      title: 'Boob censor seed',
      summary: 'Seed summary',
      body: 'Seed body',
    };
  } finally {
    await pool.end();
  }
}

async function main() {
  await bootWorkflowMachineSeed();
  const model = buildModel();
  const { revisionId } = await ensurePublished(KEY, model);
  wireManagedFunctionAfterHook(CREATE_FN_ID, KEY, ['data']);
  wireManagedFunctionAfterHook(UPDATE_FN_ID, KEY, ['data']);

  const parent = await ensureSampleContent();
  const withBoob = {
    ...parent,
    title: `${parent.title ?? parent.slug} — boob check`,
    summary: parent.summary ?? 'Draft summary',
    body: parent.body ?? 'Body without the trigger word elsewhere.',
  };
  console.log(`[seed] simulate hook for cms_contents#${parent.id} (boob in title)`);

  const user = await pickUnlockedUser();
  if (!user) throw new Error('no user');

  const { instance: hitInstance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { data: withBoob },
    startedByType: 'SYSTEM',
    startType: 'SERVER_FUNCTION_HOOK',
  });
  console.log(`[seed] boob-hit instance #${hitInstance.id}`);
  await drainAutomated(hitInstance.id, 'seed-cms-boob-censor');
  await assertEnd(hitInstance.id, 'end-censored');

  const withoutBoob = {
    ...parent,
    title: 'Plain update title',
    summary: 'No trigger word here',
    body: 'Just a normal edit.',
  };
  const { instance: skipInstance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { data: withoutBoob },
    startedByType: 'SYSTEM',
    startType: 'SERVER_FUNCTION_HOOK',
  });
  console.log(`[seed] no-boob instance #${skipInstance.id}`);
  await drainAutomated(skipInstance.id, 'seed-cms-boob-censor-skip');
  await assertEnd(skipInstance.id, 'end-skipped');

  console.log('[seed] done. POST/PUT /api/cms/contents will start this workflow when title/summary/body contains "boob".');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
