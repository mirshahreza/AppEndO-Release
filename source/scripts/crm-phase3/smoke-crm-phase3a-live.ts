/**
 * CRM Phase 3a live acceptance — nav/route registry + full CRUD on the 4 vocab
 * categories through the exact API the `form.base-info-record` bridge calls
 * (`/api/base-info*`), plus a render check on each Studio route.
 *
 * Usage (dev server must be running on :3000):
 *   npx tsx scripts/crm-phase3/smoke-crm-phase3a-live.ts
 */

import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import {
  ensureControlPlaneInitialized,
  resetControlPlaneInitState,
} from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import { signAccessToken } from '../../src/server/services/auth/token.service';
import { readNavigationFile } from '../../src/core/platform-registry/PlatformRegistryFileStore';
import { listPlatformRouteBindingRows } from '../../src/server/domain/platform';
import { CRM_ROUTE_PREFIX, CRM_STUDIO_GROUP_HEADING } from './crmStudioNav';
import { resolveCrmIds } from './crmIds';

const BASE = process.env.CRM_SMOKE_BASE_URL || 'http://127.0.0.1:3000';

type Json = Record<string, unknown>;

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const request = async (
  method: string,
  path: string,
  token: string,
  body?: Json,
): Promise<{ status: number; json: Json }> => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json: Json = {};
  try {
    json = text ? JSON.parse(text) as Json : {};
  } catch {
    json = { raw: text };
  }
  return { status: response.status, json };
};

const EXPECTED_ROUTES = [
  `${CRM_ROUTE_PREFIX}/settings/*`,
  `${CRM_ROUTE_PREFIX}/settings/lead-sources`,
  `${CRM_ROUTE_PREFIX}/settings/ticket-priority`,
  `${CRM_ROUTE_PREFIX}/settings/ticket-channel`,
  `${CRM_ROUTE_PREFIX}/settings/customer-tags`,
] as const;

const RENDER_CHECK_PATHS = [
  '/us/studio/crm/settings',
  '/us/studio/crm/settings/lead-sources',
  '/us/studio/crm/settings/ticket-priority',
  '/us/studio/crm/settings/ticket-channel',
  '/us/studio/crm/settings/customer-tags',
];

const main = async () => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  console.log('[CRM 3a smoke] 1) nav registry + route bindings');
  const nav = readNavigationFile('studio');
  const group = (nav?.groups ?? []).find((g) => g.heading === CRM_STUDIO_GROUP_HEADING);
  assert(group, 'CRM nav group missing from studio.json');
  assert(group!.items.length === 1 && group!.items[0]!.pageKey === 'crm-settings', 'CRM nav group should have exactly one item (Settings) at 3a');

  const routeRows = await listPlatformRouteBindingRows();
  const crmRoutes = new Set(
    routeRows.filter((row) => row.mountId === 'studio' && row.routePattern.startsWith(`${CRM_ROUTE_PREFIX}/`))
      .map((row) => row.routePattern),
  );
  for (const expected of EXPECTED_ROUTES) {
    assert(crmRoutes.has(expected), `route binding missing: ${expected}`);
  }
  assert(crmRoutes.size === EXPECTED_ROUTES.length, `unexpected extra CRM route bindings: ${[...crmRoutes].join(', ')}`);

  console.log('[CRM 3a smoke] 2) each Studio route renders (no 404/500)');
  for (const path of RENDER_CHECK_PATHS) {
    const response = await fetch(`${BASE}${path}`);
    assert(response.status === 200, `${path} expected 200, got ${response.status}`);
  }

  const admin = await prisma().baseUser.findFirst({
    where: {
      OR: [
        { username: { equals: 'admin', mode: 'insensitive' } },
        { userRoles: { some: { roleName: { equals: 'ADMIN', mode: 'insensitive' } } } },
      ],
    },
    include: { userRoles: { include: { role: true } } },
  });
  assert(admin, 'Admin user not found');
  const roles = (admin!.userRoles || [])
    .map((row) => row.roleName || row.role?.name)
    .filter((name): name is string => Boolean(name));
  const token = signAccessToken({
    id: Number(admin!.id),
    email: admin!.email || `${admin!.username}@local`,
    role: roles.includes('ADMIN') ? 'ADMIN' : (roles[0] || 'ADMIN'),
    roles: roles.length > 0 ? roles : ['ADMIN'],
  });

  console.log('[CRM 3a smoke] 3) full CRUD on each of the 4 vocab categories via /api/base-info');
  const ids = await resolveCrmIds();
  const vocabCategories: Array<{ title: string; categoryId: string }> = [
    { title: 'Lead Sources', categoryId: ids.categoryIds['Lead Sources'] },
    { title: 'Ticket Priority', categoryId: ids.categoryIds['Ticket Priority'] },
    { title: 'Ticket Channel', categoryId: ids.categoryIds['Ticket Channel'] },
    { title: 'Customer Tags', categoryId: ids.categoryIds['Customer Tags'] },
  ];

  for (const category of vocabCategories) {
    const stamp = Date.now().toString(36);
    const create = await request('POST', '/api/base-info', token, {
      parentId: category.categoryId,
      title: `Smoke ${stamp}`,
      titleEn: `Smoke ${stamp}`,
      shortName: `smoke_${stamp}`,
      viewOrder: 999,
    });
    assert(create.status === 200 || create.status === 201, `[${category.title}] create failed ${create.status} ${JSON.stringify(create.json)}`);
    const createdId = ((create.json.data ?? create.json) as Json).id;
    assert(createdId, `[${category.title}] create response missing id: ${JSON.stringify(create.json)}`);

    const list = await request('GET', `/api/base-info/children?parentId=${category.categoryId}&includeInactive=true`, token);
    assert(list.status === 200, `[${category.title}] list failed ${list.status}`);
    const items = (list.json.items ?? list.json.data ?? []) as Json[];
    assert(items.some((item) => String(item.id) === String(createdId)), `[${category.title}] created item not found in list`);

    const update = await request('PUT', `/api/base-info/${createdId}`, token, {
      title: `Smoke ${stamp} updated`,
      titleEn: `Smoke ${stamp} updated`,
    });
    assert(update.status === 200, `[${category.title}] update failed ${update.status} ${JSON.stringify(update.json)}`);

    const del = await request('DELETE', `/api/base-info/${createdId}`, token);
    assert(del.status === 200 || del.status === 204, `[${category.title}] delete failed ${del.status} ${JSON.stringify(del.json)}`);

    console.log(`  [${category.title}] create/list/update/delete OK`);
  }

  console.log('[CRM 3a smoke] PASS — nav + routes + full CRUD on all 4 vocab categories.');
};

main()
  .catch((error) => {
    console.error('[CRM 3a smoke] FAIL:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
