/**
 * Live verification for `cms-content-boob-censor`.
 *
 * 1) In-process: dirty a real cms_contents row → start published workflow → drain → assert DB.
 * 2) HTTP (if server healthy): POST /api/cms/contents with "boob" → poll until censored.
 *
 * Run: `npx tsx scripts/seed-workflow-machines/_live-test-cms-boob-censor.ts`
 */
import { Pool } from 'pg';
import { SETTINGS_PATH, readRuntimeSettings } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import { listWorkflowDefinitions } from '../../src/server/domain/workflow/workflowDefinitionRepository';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import {
  bootWorkflowMachineSeed, drainAutomated, assertEnd, pickUnlockedUser,
} from './_seedHelpers';
import { resolveCmsIds } from '../cms-phase3/cmsIds';

const KEY = 'cms-content-boob-censor';

async function openPool(): Promise<Pool> {
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

async function readRow(pool: Pool, id: number) {
  const row = await pool.query<{
    id: string;
    title: string | null;
    summary: string | null;
    body: string | null;
    slug: string;
  }>(
    `SELECT id::text AS id, title, summary, body, slug
     FROM cms_contents WHERE id = $1`,
    [id],
  );
  const hit = row.rows[0];
  if (!hit) throw new Error(`cms_contents#${id} missing`);
  return {
    id: Number(hit.id),
    title: hit.title,
    summary: hit.summary,
    body: hit.body,
    slug: hit.slug,
  };
}

function assertNoBoob(label: string, value: string | null) {
  if (/\bboob\b/i.test(value ?? '')) {
    throw new Error(`${label} still contains "boob": ${JSON.stringify(value)}`);
  }
}

function assertHasStars(label: string, value: string | null) {
  if (!(value ?? '').includes('****')) {
    throw new Error(`${label} missing **** after censor: ${JSON.stringify(value)}`);
  }
}

async function ensureTestRow(pool: Pool): Promise<number> {
  const existing = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM cms_contents WHERE slug LIKE 'wf-boob-censor-%' ORDER BY id DESC LIMIT 1`,
  );
  if (existing.rows[0]) return Number(existing.rows[0].id);

  const any = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM cms_contents WHERE parent_content_id IS NULL ORDER BY id ASC LIMIT 1`,
  );
  if (any.rows[0]) return Number(any.rows[0].id);

  throw new Error('no cms_contents row — re-run cms-content-boob-censor seed first');
}

async function runInProcessDbAssert(): Promise<number> {
  console.log('[live] --- in-process DB assert ---');
  await bootWorkflowMachineSeed();
  const defs = await listWorkflowDefinitions('global');
  const def = defs.find((d) => d.key === KEY);
  if (!def?.currentPublishedRevisionId) {
    throw new Error(`published workflow "${KEY}" missing — run seed first`);
  }

  const pool = await openPool();
  try {
    const id = await ensureTestRow(pool);
    const dirtyTitle = 'Live test title with boob word';
    const dirtySummary = 'Summary mentions Boob once';
    const dirtyBody = 'Body line: the word BOOB must become stars.';

    await pool.query(
      `UPDATE cms_contents
       SET title = $2, summary = $3, body = $4
       WHERE id = $1`,
      [id, dirtyTitle, dirtySummary, dirtyBody],
    );
    console.log(`[live] dirtied cms_contents#${id}`);

    const before = await readRow(pool, id);
    const user = await pickUnlockedUser();
    if (!user) throw new Error('no unlocked user');

    const { instance } = await startWorkflowInstance({
      workflowRevisionId: def.currentPublishedRevisionId,
      input: { data: before },
      startedByType: 'SYSTEM',
      startType: 'SERVER_FUNCTION_HOOK',
    });
    console.log(`[live] started instance #${instance.id}`);
    await drainAutomated(instance.id, 'live-cms-boob-censor');
    await assertEnd(instance.id, 'end-censored');

    const after = await readRow(pool, id);
    console.log('[live] after title:', after.title);
    console.log('[live] after summary:', after.summary);
    console.log('[live] after body:', after.body);

    assertHasStars('title', after.title);
    assertHasStars('summary', after.summary);
    assertHasStars('body', after.body);
    assertNoBoob('title', after.title);
    assertNoBoob('summary', after.summary);
    assertNoBoob('body', after.body);

    if (after.title !== 'Live test title with **** word') {
      throw new Error(`unexpected title: ${JSON.stringify(after.title)}`);
    }
    if (after.summary !== 'Summary mentions **** once') {
      throw new Error(`unexpected summary: ${JSON.stringify(after.summary)}`);
    }
    if (after.body !== 'Body line: the word **** must become stars.') {
      throw new Error(`unexpected body: ${JSON.stringify(after.body)}`);
    }

    console.log('[live] in-process DB assert PASSED');
    return id;
  } finally {
    await pool.end();
  }
}

async function loginForHttp(baseUrl: string): Promise<string | null> {
  const password = String(process.env.SMOKE_PASSWORD || 'admin123');
  const identifiers = [
    process.env.SMOKE_EMAIL,
    process.env.SMOKE_IDENTIFIER,
    'admin',
    'm.mirshahreza@son.ir',
    'admin@append.os',
  ].filter((v): v is string => Boolean(v && String(v).trim())).map((v) => String(v).trim());

  for (const identifier of [...new Set(identifiers)]) {
    for (const body of [
      { identifier, password },
      { email: identifier, password },
    ]) {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const loginJson = await loginRes.json() as { accessToken?: string };
      if (loginRes.ok && loginJson.accessToken) {
        console.log(`[live] HTTP login ok as ${identifier}`);
        return loginJson.accessToken;
      }
    }
  }
  return null;
}

async function runInProcessUpdateAssert(contentId: number): Promise<void> {
  console.log('[live] --- in-process UPDATE assert ---');
  const defs = await listWorkflowDefinitions('global');
  const def = defs.find((d) => d.key === KEY);
  if (!def?.currentPublishedRevisionId) throw new Error(`published "${KEY}" missing`);

  const pool = await openPool();
  try {
    const dirtyTitle = 'Updated page about boob topic';
    const dirtySummary = 'still clean summary';
    const dirtyBody = 'Body stays clean';
    await pool.query(
      `UPDATE cms_contents SET title = $2, summary = $3, body = $4 WHERE id = $1`,
      [contentId, dirtyTitle, dirtySummary, dirtyBody],
    );
    const before = await readRow(pool, contentId);
    const { instance } = await startWorkflowInstance({
      workflowRevisionId: def.currentPublishedRevisionId,
      input: { data: before },
      startedByType: 'SYSTEM',
      startType: 'SERVER_FUNCTION_HOOK',
    });
    console.log(`[live] update-path instance #${instance.id}`);
    await drainAutomated(instance.id, 'live-cms-boob-censor-update');
    await assertEnd(instance.id, 'end-censored');

    const after = await readRow(pool, contentId);
    console.log('[live] update after title:', after.title);
    if (after.title !== 'Updated page about **** topic') {
      throw new Error(`unexpected update title: ${JSON.stringify(after.title)}`);
    }
    assertNoBoob('update title', after.title);
    if (after.summary !== dirtySummary || after.body !== dirtyBody) {
      throw new Error('update path unexpectedly changed clean summary/body');
    }
    console.log('[live] in-process UPDATE assert PASSED');
  } finally {
    await pool.end();
  }
}

async function runHttpCreateAssert(contentIdHint: number): Promise<void> {
  console.log('[live] --- HTTP create+poll assert ---');
  const runtime = readRuntimeSettings();
  const port = Number(runtime.port) || 3000;
  const baseUrl = String(process.env.SMOKE_BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');

  const health = await fetch(`${baseUrl}/api/health`);
  if (!health.ok) {
    console.log(`[live] skip HTTP: ${baseUrl}/api/health not ok`);
    return;
  }

  const token = await loginForHttp(baseUrl);
  if (!token) {
    console.log('[live] skip HTTP: could not login (set SMOKE_EMAIL/SMOKE_PASSWORD if needed)');
    return;
  }

  await bootWorkflowMachineSeed();
  const cmsIds = await resolveCmsIds();
  const draft = cmsIds.statusIds.draft;
  if (!draft) throw new Error('draft status missing');
  const article = await prisma().baseInfo.findFirst({
    where: { parentId: cmsIds.categoryIds['Content Types'], shortName: 'article', isActive: true },
    select: { id: true },
  });
  const language = await prisma().baseInfo.findFirst({
    where: { parentId: cmsIds.categoryIds.Languages, isActive: true },
    orderBy: { viewOrder: 'asc' },
    select: { id: true },
  });
  if (!article || !language) throw new Error('article/language missing');

  const slug = `wf-boob-http-${Date.now()}`;
  const createRes = await fetch(`${baseUrl}/api/cms/contents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      contentTypeCode: article.id,
      languageCode: language.id,
      slug,
      statusCode: draft,
      title: 'HTTP create has a boob in title',
      summary: 'clean summary',
      body: 'clean body',
      bodyFormatCode: cmsIds.bodyFormatIds.plain,
    }),
  });
  const createJson = await createRes.json() as {
    data?: { id?: number | string; title?: string };
    message?: string;
  };
  if (!createRes.ok) {
    throw new Error(`POST /api/cms/contents failed: ${createRes.status} ${createJson.message ?? JSON.stringify(createJson)}`);
  }
  const createdId = Number(createJson.data?.id);
  if (!createdId) throw new Error(`create missing id: ${JSON.stringify(createJson)}`);
  console.log(`[live] created cms_contents#${createdId} via HTTP (hint prior row #${contentIdHint})`);

  const deadline = Date.now() + 45_000;
  let title = String(createJson.data?.title ?? '');
  while (Date.now() < deadline) {
    const getRes = await fetch(`${baseUrl}/api/cms/contents/${createdId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getJson = await getRes.json() as { data?: { title?: string; summary?: string; body?: string } };
    title = String(getJson.data?.title ?? '');
    if (title.includes('****') && !/\bboob\b/i.test(title)) {
      console.log('[live] HTTP polled title:', title);
      console.log('[live] HTTP create+poll assert PASSED');
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`HTTP create did not censor within timeout; last title=${JSON.stringify(title)}`);
}

async function main() {
  const id = await runInProcessDbAssert();
  await runInProcessUpdateAssert(id);
  await runHttpCreateAssert(id);
  console.log('[live] ALL CHECKS PASSED');
}

main().catch((e) => {
  console.error('[live] FAILED:', e);
  process.exitCode = 1;
});
