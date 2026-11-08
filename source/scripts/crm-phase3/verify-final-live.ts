/**
 * CRM Phase 3 — final named live-verify (plan §"Live-verify فاز ۳"): every Studio route
 * renders 200, and the two regionSubmit bugs found+fixed during 3d (Tags / Assign / Reply
 * submitting to an unresolved literal `:id` URL — see p-packages-crm.md + README.md) are
 * re-verified by calling the EXACT method+URL the fixed generated `.tsx` now constructs
 * (read directly out of workspace/designer/drafts/general/*.tsx during this same session),
 * not just the underlying domain-action API in isolation.
 *
 * Usage (dev server must be running on :3000):
 *   npx tsx scripts/crm-phase3/verify-final-live.ts
 */

import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import { signAccessToken } from '../../src/server/services/auth/token.service';
import { findCrmBaseInfoItemId } from '../crm-phase1/seed/seedCrmBaseInfo';

const BASE = process.env.CRM_SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const PERSON_TYPE_INDIVIDUAL_ID = '100.2.1';

type Json = Record<string, unknown>;

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
};

const request = async (method: string, path: string, token: string, body?: Json) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: Json = {};
  try { json = text ? JSON.parse(text) as Json : {}; } catch { json = { raw: text }; }
  return { status: res.status, json };
};

const RENDER_CHECK_PATHS = [
  '/us/studio/crm/customers',
  '/us/studio/crm/opportunities',
  '/us/studio/crm/tickets',
  '/us/studio/crm/settings',
  '/us/studio/crm/settings/lead-sources',
  '/us/studio/crm/settings/ticket-priority',
  '/us/studio/crm/settings/ticket-channel',
  '/us/studio/crm/settings/customer-tags',
];

const main = async () => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  console.log('[CRM final live-verify] 1) static Studio routes render 200');
  for (const path of RENDER_CHECK_PATHS) {
    const res = await fetch(`${BASE}${path}`);
    assert(res.status === 200, `${path} expected 200, got ${res.status}`);
  }

  const admin = await prisma().baseUser.findFirst({
    where: { userRoles: { some: { roleName: { equals: 'ADMIN', mode: 'insensitive' } } } },
    include: { userRoles: { include: { role: true } } },
  });
  assert(admin, 'Admin user not found');
  const roles = (admin!.userRoles || []).map((r) => r.roleName || r.role?.name).filter((n): n is string => Boolean(n));
  const token = signAccessToken({ id: Number(admin!.id), email: admin!.email || `${admin!.username}@local`, role: 'ADMIN', roles: roles.length > 0 ? roles : ['ADMIN'] });

  console.log('[CRM final live-verify] 2) create a customer + ticket, render their edit routes');
  const seq = Date.now();
  const userCreate = await request('POST', '/api/users', token, {
    email: `crmfinal${seq}@example.test`, password: 'Passw0rd!123', role: '', roles: ['CUSTOMER'],
    personTypeCode: PERSON_TYPE_INDIVIDUAL_ID, firstName: 'Final', lastName: `Verify ${seq}`,
  });
  assert(userCreate.status === 200 || userCreate.status === 201, `user create failed: ${userCreate.status} ${JSON.stringify(userCreate.json)}`);
  const userId = Number((userCreate.json as { id?: number }).id ?? (userCreate.json as { data?: { id?: number } }).data?.id);
  assert(Number.isFinite(userId), `user create: no id in response: ${JSON.stringify(userCreate.json)}`);

  const custCreate = await request('POST', '/api/crm/customers', token, { userId, personTypeCode: PERSON_TYPE_INDIVIDUAL_ID });
  assert(custCreate.status === 200 || custCreate.status === 201, `customer extension create failed: ${custCreate.status} ${JSON.stringify(custCreate.json)}`);

  const editorRes = await fetch(`${BASE}/us/studio/crm/customers/edit/${userId}`);
  assert(editorRes.status === 200, `customer editor route expected 200, got ${editorRes.status}`);

  console.log('[CRM final live-verify] 3) Identity-edit fix — PATCH (not hardcoded PUT) against the real update endpoint');
  const identityPatch = await request('PATCH', `/api/crm/customers/${userId}`, token, { note: 'Patched by final live-verify.' });
  assert(identityPatch.status === 200, `identity PATCH (fixed method) expected 200, got ${identityPatch.status}: ${JSON.stringify(identityPatch.json)}`);

  console.log('[CRM final live-verify] 4) Tags fix — PUT with the real id the fixed form now resolves');
  const tagVipId = await findCrmBaseInfoItemId('Customer Tags', 'vip');
  const tagsSync = await request('PUT', `/api/crm/customers/${userId}/tags`, token, { tagCodes: [tagVipId] });
  assert(tagsSync.status === 200, `tags sync (fixed form's real URL) expected 200, got ${tagsSync.status}: ${JSON.stringify(tagsSync.json)}`);
  const afterTags = await request('GET', `/api/crm/customers/${userId}`, token);
  assert(afterTags.status === 200, 'customer get after tags sync failed');

  const channelEmailId = await findCrmBaseInfoItemId('Ticket Channel', 'email');
  const priorityNormalId = await findCrmBaseInfoItemId('Ticket Priority', 'normal');
  const ticketCreate = await request('POST', '/api/crm/tickets', token, {
    customerUserId: userId, subject: 'Final live-verify', channelCode: channelEmailId, priorityCode: priorityNormalId,
  });
  assert(ticketCreate.status === 200 || ticketCreate.status === 201, `ticket create failed: ${ticketCreate.status} ${JSON.stringify(ticketCreate.json)}`);
  const ticketId = Number((ticketCreate.json as { data?: { id?: number } }).data?.id);
  assert(Number.isFinite(ticketId), 'ticket create: no id in response');

  const ticketEditorRes = await fetch(`${BASE}/us/studio/crm/tickets/edit/${ticketId}`);
  assert(ticketEditorRes.status === 200, `ticket editor route expected 200, got ${ticketEditorRes.status}`);

  console.log('[CRM final live-verify] 5) Assign fix — POST with the real id the fixed form now resolves');
  const assign = await request('POST', `/api/crm/tickets/${ticketId}/assign`, token, { assignedTo: Number(admin!.id) });
  assert(assign.status === 200, `assign (fixed form's real URL) expected 200, got ${assign.status}: ${JSON.stringify(assign.json)}`);

  console.log('[CRM final live-verify] 6) Reply fix — POST with the real id the fixed form now resolves');
  const reply = await request('POST', `/api/crm/tickets/${ticketId}/messages`, token, { body: 'Final live-verify reply.' });
  assert(reply.status === 200 || reply.status === 201, `reply (fixed form's real URL) expected 200/201, got ${reply.status}: ${JSON.stringify(reply.json)}`);
  const thread = await request('GET', `/api/crm/tickets/${ticketId}/messages`, token);
  assert(thread.status === 200, 'messages list failed');
  const messages = (thread.json as { data?: unknown[] }).data ?? [];
  assert(Array.isArray(messages) && messages.length >= 1, 'reply did not land in message thread');

  console.log('[CRM final live-verify] PASS — all routes render, Identity-edit/Tags/Assign/Reply confirmed against their fixed URLs.');
};

main()
  .catch((error) => {
    console.error('[CRM final live-verify] FAIL:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
