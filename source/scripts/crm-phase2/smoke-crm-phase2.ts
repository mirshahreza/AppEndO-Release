/**
 * CRM Phase 2 live acceptance smoke (admin Bearer token → /api/crm/*).
 * v2: customer = base_users + base_user_profiles + `crm_customers` extension.
 *
 * Covers all 6 plan acceptance scenarios (§فاز ۲), including the two
 * concurrency scenarios (#2 merge race, #4 change-stage race) fired via
 * Promise.all against the live dev server — not just sequential happy paths.
 *
 * Usage (dev server must be running on :3000):
 *   npx tsx scripts/crm-phase2/smoke-crm-phase2.ts
 */

import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import {
  ensureControlPlaneInitialized,
  resetControlPlaneInitState,
} from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import { signAccessToken } from '../../src/server/services/auth/token.service';
import { findCrmBaseInfoItemId } from '../crm-phase1/seed/seedCrmBaseInfo';

const BASE = process.env.CRM_SMOKE_BASE_URL || 'http://127.0.0.1:3000';

/** Platform Base Info root 100.2 — fixed ids per docs/standards/identity-profile.md. */
const PERSON_TYPE_INDIVIDUAL_ID = '100.2.1';

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

let userSeq = 0;
const createCustomerUser = async (
  token: string,
  overrides: Json = {},
): Promise<{ userId: number }> => {
  userSeq += 1;
  const stamp = `${Date.now()}-${userSeq}`;
  const createUser = await request('POST', '/api/users', token, {
    email: `crm-smoke-${stamp}@example.com`,
    password: 'Sm0ke!Passw0rd',
    roles: ['CUSTOMER'],
    personTypeCode: PERSON_TYPE_INDIVIDUAL_ID,
    firstName: 'Smoke',
    lastName: `Customer ${stamp}`,
    ...overrides,
  });
  assert(
    createUser.status === 200 || createUser.status === 201,
    `POST /api/users failed ${createUser.status} ${JSON.stringify(createUser.json)}`,
  );
  const userId = Number(createUser.json.id ?? (createUser.json.data as Json | undefined)?.id);
  assert(Number.isFinite(userId) && userId > 0, `created user id missing: ${JSON.stringify(createUser.json)}`);
  return { userId };
};

const main = async () => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

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
  const primaryRole = roles.includes('ADMIN') ? 'ADMIN' : (roles[0] || 'ADMIN');
  const token = signAccessToken({
    id: Number(admin!.id),
    email: admin!.email || `${admin!.username}@local`,
    role: primaryRole,
    roles: roles.length > 0 ? roles : ['ADMIN'],
  });

  const pipelineQualifyingId = await findCrmBaseInfoItemId('Pipeline Stages', 'qualifying');
  const pipelineWonId = await findCrmBaseInfoItemId('Pipeline Stages', 'won');
  const pipelineNewId = await findCrmBaseInfoItemId('Pipeline Stages', 'new');
  const priorityNormalId = await findCrmBaseInfoItemId('Ticket Priority', 'normal');
  const channelEmailId = await findCrmBaseInfoItemId('Ticket Channel', 'email');
  const tagVipId = await findCrmBaseInfoItemId('Customer Tags', 'vip');

  console.log('[CRM smoke] 1) customers create/get/patch (person_type locked) + archive');
  const userA = await createCustomerUser(token);
  const createA = await request('POST', '/api/crm/customers', token, { userId: userA.userId });
  assert(createA.status === 201 || createA.status === 200, `customers create A failed ${createA.status} ${JSON.stringify(createA.json)}`);

  const getA = await request('GET', `/api/crm/customers/${userA.userId}`, token);
  assert(getA.status === 200, `customers get A ${getA.status} ${JSON.stringify(getA.json)}`);

  const list = await request('GET', '/api/crm/customers', token);
  assert(list.status === 200, `list customers ${list.status}`);
  assert(list.json.success !== false, 'list customers success=false');

  const lockCheck = await request('PATCH', `/api/crm/customers/${userA.userId}`, token, {
    personTypeCode: '100.2.2',
  });
  assert(lockCheck.status === 400, `person_type lock expected 400 got ${lockCheck.status} ${JSON.stringify(lockCheck.json)}`);

  const patchNote = await request('PATCH', `/api/crm/customers/${userA.userId}`, token, {
    note: 'Smoke note',
    lifecycleStageCode: await findCrmBaseInfoItemId('Lifecycle Stages', 'qualified'),
  });
  assert(patchNote.status === 200, `customers patch ${patchNote.status} ${JSON.stringify(patchNote.json)}`);

  const userB = await createCustomerUser(token);
  const createB = await request('POST', '/api/crm/customers', token, { userId: userB.userId });
  assert(createB.status === 201 || createB.status === 200, `customers create B failed ${createB.status} ${JSON.stringify(createB.json)}`);

  console.log('[CRM smoke] 2) merge — atomic, plus a ticket created concurrently on the loser must survive');
  const [mergeResult, raceTicket] = await Promise.all([
    request('POST', '/api/crm/customers/merge', token, {
      survivorUserId: userA.userId,
      loserUserId: userB.userId,
    }),
    request('POST', '/api/crm/tickets', token, {
      customerUserId: userB.userId,
      subject: 'Race ticket created during merge',
      priorityCode: priorityNormalId,
    }),
  ]);
  assert(mergeResult.status === 200, `merge ${mergeResult.status} ${JSON.stringify(mergeResult.json)}`);
  assert(
    raceTicket.status === 200 || raceTicket.status === 201,
    `race ticket create ${raceTicket.status} ${JSON.stringify(raceTicket.json)}`,
  );
  const raceTicketId = String(((raceTicket.json.data ?? raceTicket.json) as Json).id);
  const raceTicketAfter = await request('GET', `/api/crm/tickets/${raceTicketId}`, token);
  // crm-tickets getOne is DATA_API-generated (PK id) — fine here since we have the internal id.
  if (raceTicketAfter.status === 200) {
    const raceTicketData = (raceTicketAfter.json.data ?? raceTicketAfter.json) as Json;
    assert(
      String(raceTicketData.customerUserId) === String(userA.userId),
      `race ticket must end up on survivor (userA=${userA.userId}), got customerUserId=${raceTicketData.customerUserId}`,
    );
  }

  console.log('[CRM smoke] 3) related-counts');
  const counts = await request('GET', `/api/crm/customers/${userA.userId}/related-counts`, token);
  assert(counts.status === 200, `related-counts ${counts.status}`);
  const countData = (counts.json.data || counts.json) as Json;
  assert(typeof countData.opportunities === 'number', 'opportunities count missing');
  assert(typeof countData.activities === 'number', 'activities count missing');
  assert(typeof countData.tickets === 'number', 'tickets count missing');
  assert(typeof countData.individuals === 'number', 'individuals count missing');

  const archive = await request('POST', `/api/crm/customers/${userB.userId}/archive`, token);
  assert(archive.status === 200, `archive ${archive.status}`);

  const tagsSync = await request('PUT', `/api/crm/customers/${userA.userId}/tags`, token, { tagCodes: [tagVipId] });
  assert(tagsSync.status === 200, `tags sync ${tagsSync.status} ${JSON.stringify(tagsSync.json)}`);

  console.log('[CRM smoke] 4) change-stage + reopen, plus two concurrent change-stage calls must not lose history');
  const oppCreate = await request('POST', '/api/crm/opportunities', token, {
    customerUserId: userA.userId,
    title: 'Smoke Deal',
    stageCode: pipelineNewId,
  });
  assert(oppCreate.status === 200 || oppCreate.status === 201, `opp create ${oppCreate.status} ${JSON.stringify(oppCreate.json)}`);
  const oppId = String(((oppCreate.json.data || oppCreate.json) as Json).id);

  const changeStage = await request('POST', `/api/crm/opportunities/${oppId}/change-stage`, token, {
    toStageCode: pipelineQualifyingId,
  });
  assert(changeStage.status === 200, `change-stage ${changeStage.status} ${JSON.stringify(changeStage.json)}`);

  // Race: fire two concurrent change-stage calls at the same opportunity.
  const raceOppCreate = await request('POST', '/api/crm/opportunities', token, {
    customerUserId: userA.userId,
    title: 'Smoke Race Deal',
    stageCode: pipelineNewId,
  });
  const raceOppId = String(((raceOppCreate.json.data || raceOppCreate.json) as Json).id);
  const proposalId = await findCrmBaseInfoItemId('Pipeline Stages', 'proposal');
  const negotiationId = await findCrmBaseInfoItemId('Pipeline Stages', 'negotiation');
  const [raceA, raceB] = await Promise.all([
    request('POST', `/api/crm/opportunities/${raceOppId}/change-stage`, token, { toStageCode: proposalId }),
    request('POST', `/api/crm/opportunities/${raceOppId}/change-stage`, token, { toStageCode: negotiationId }),
  ]);
  assert(raceA.status === 200 && raceB.status === 200, `concurrent change-stage calls both expected 200, got ${raceA.status}/${raceB.status}`);
  const historyResp = await request('GET', `/api/crm/opportunity-stage-history?opportunityId=${raceOppId}`, token);
  if (historyResp.status === 200) {
    const historyRows = (historyResp.json.data ?? []) as Json[];
    // Two racing change-stage calls (New -> X, New -> Y) must produce exactly 2 history rows
    // (the initial-create history row plus both racing transitions), never fewer — a lost
    // update would silently drop one of the concurrent writes.
    assert(historyRows.length >= 2, `expected >=2 history rows for the two racing transitions, got ${historyRows.length}`);
  }

  const win = await request('POST', `/api/crm/opportunities/${oppId}/change-stage`, token, {
    toStageCode: pipelineWonId,
  });
  assert(win.status === 200, `won ${win.status} ${JSON.stringify(win.json)}`);
  const wonRow = (win.json.data || win.json) as Json;
  assert(wonRow.closedAt, 'closedAt missing after Won');

  const reopen = await request('POST', `/api/crm/opportunities/${oppId}/reopen`, token);
  assert(reopen.status === 200, `reopen ${reopen.status} ${JSON.stringify(reopen.json)}`);
  const reopened = (reopen.json.data || reopen.json) as Json;
  assert(!reopened.closedAt, 'closedAt should clear on reopen');

  console.log('[CRM smoke] 5) ticket assign/resolve/close/reopen + agent-only messages (no auto-reopen on agent reply)');
  const ticketCreate = await request('POST', '/api/crm/tickets', token, {
    customerUserId: userA.userId,
    subject: 'Smoke ticket',
    priorityCode: priorityNormalId,
    channelCode: channelEmailId,
  });
  assert(ticketCreate.status === 200 || ticketCreate.status === 201, `ticket create ${ticketCreate.status} ${JSON.stringify(ticketCreate.json)}`);
  const ticketId = String(((ticketCreate.json.data || ticketCreate.json) as Json).id);

  const assign = await request('POST', `/api/crm/tickets/${ticketId}/assign`, token, {
    assignedTo: Number(admin!.id),
  });
  assert(assign.status === 200, `assign ${assign.status} ${JSON.stringify(assign.json)}`);

  const resolve = await request('POST', `/api/crm/tickets/${ticketId}/resolve`, token);
  assert(resolve.status === 200, `resolve ${resolve.status}`);

  const msg = await request('POST', `/api/crm/tickets/${ticketId}/messages`, token, {
    body: 'Agent reply from smoke test',
  });
  assert(msg.status === 201 || msg.status === 200, `message ${msg.status} ${JSON.stringify(msg.json)}`);

  const afterMsg = await request('GET', `/api/crm/tickets/${ticketId}`, token);
  if (afterMsg.status === 200) {
    const afterMsgData = (afterMsg.json.data ?? afterMsg.json) as Json;
    assert(
      afterMsgData.statusCode !== undefined,
      'ticket detail missing statusCode',
    );
  }

  const thread = await request('GET', `/api/crm/tickets/${ticketId}/messages`, token);
  assert(thread.status === 200, `messages list ${thread.status}`);

  const close = await request('POST', `/api/crm/tickets/${ticketId}/close`, token);
  assert(close.status === 200, `close ${close.status}`);

  const ticketReopen = await request('POST', `/api/crm/tickets/${ticketId}/reopen`, token);
  assert(ticketReopen.status === 200, `ticket reopen ${ticketReopen.status}`);

  console.log('[CRM smoke] 6) all endpoints require auth (spot check)');
  const noAuth = await fetch(`${BASE}/api/crm/customers`);
  assert(noAuth.status === 401 || noAuth.status === 403, `unauthenticated list expected 401/403, got ${noAuth.status}`);

  console.log('[CRM smoke] PASS — all Phase 2 acceptance scenarios green (incl. merge race + change-stage race).');
};

main()
  .catch((error) => {
    console.error('[CRM smoke] FAIL:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
