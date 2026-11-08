import http from 'http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/hawiety/hawietyRuntime', () => ({
  requireHawietyPackage: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/auth.middleware', () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../domain/hwy/hwyMembershipDecision.service', () => ({
  listHwyMembershipDecisionReasonOptions: vi.fn(async () => [{ value: '1', label: 'Reason' }]),
  applyHwyMembershipCallCenterDecision: vi.fn(async () => ({
    memberId: '42',
    membershipStatusCode: 'pending_local',
  })),
  applyHwyMembershipLocalDecision: vi.fn(async () => ({
    memberId: '42',
    membershipStatusCode: 'active',
  })),
}));

vi.mock('../../domain/hwy/hwyMemberNakhebinWrite.service', () => ({
  linkHwyMemberNakhebinBallot: vi.fn(async () => undefined),
  linkHwyMemberNakhebinFamily: vi.fn(async () => undefined),
  linkHwyMemberNakhebinEghtera: vi.fn(async () => undefined),
  clearHwyMemberNakhebinLink: vi.fn(async () => undefined),
  changeHwyMemberNakhebinRoghe: vi.fn(async () => undefined),
  setHwyMemberAddrEghtera: vi.fn(async () => undefined),
}));

vi.mock('../../domain/hwy/hwyMemberDomainWriteExtras.service', () => ({
  removeHwyTarghinDirect: vi.fn(async () => undefined),
  respondHwyMemberInstituteInvite: vi.fn(async () => undefined),
  clearHwyMemberInstituteEmployment: vi.fn(async () => undefined),
  linkHwyMemberKasb: vi.fn(async () => undefined),
  syncHwyMemberRegistrationFileApproveFlags: vi.fn(async () => undefined),
  runHwyMemberAfterCreateHook: vi.fn(async () => ({
    payload: { memberId: '42', phone1: '0700000000', smsMessage: 'tracking' },
    smsDelivery: null,
  })),
  resendHwyMemberRegistrationSms: vi.fn(async () => ({
    payload: { memberId: '42', phone1: '0700000000', smsMessage: 'tracking' },
    smsDelivery: null,
  })),
}));

vi.mock('../../domain/hwy/hwyMemberDirectoryListScope.service', () => ({
  loadHwyMemberListScopeContext: vi.fn(async () => ({
    membershipStatusCodes: { pending_call_center: 'a', pending_local: 'b', active: 'c' },
    instituteMembershipActiveCode: 'd',
  })),
}));

vi.mock('../../domain/hwy/staffMemberCreate.service', () => ({
  submitHwyStaffMemberCreate: vi.fn(async () => ({
    memberId: 9001,
    trackingCode: '9001',
    registrationChannel: 'studio_staff',
  })),
}));

vi.mock('../../domain/hwy/hwyMemberInstituteAdminAssign.service', () => ({
  assignHwyMemberInstituteByAdmin: vi.fn(async () => ({ memberId: 42, instituteId: 7 })),
}));

describe('hwy membership pipeline routes', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    const { mountHwyRoutes } = await import('../hwy.routes');
    mountHwyRoutes(app);
    app.use('/api', (_req, res) => {
      res.status(404).json({ success: false, error: 'API route not found.' });
    });
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('GET /api/hwy/membership/status-ids returns map', async () => {
    const response = await fetch(`${baseUrl}/api/hwy/membership/status-ids`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.pending_call_center).toBe('a');
  });

  it('POST /api/hwy/membership/:id/resend-registration-sms', async () => {
    const response = await fetch(`${baseUrl}/api/hwy/membership/42/resend-registration-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.payload.smsMessage).toBe('tracking');
  });

  it('POST /api/hwy/members/:id/registration-files/sync-approve-flags', async () => {
    const response = await fetch(`${baseUrl}/api/hwy/members/42/registration-files/sync-approve-flags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personalPhoto: true, nationalCardFront: false }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('POST /api/hwy/membership/staff-create', async () => {
    const response = await fetch(`${baseUrl}/api/hwy/membership/staff-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        fatherName: 'Father',
        familyName: 'Family',
        phone1: '07012345678',
        addrProvinceId: '1',
      }),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.registrationChannel).toBe('studio_staff');
  });

  it('POST /api/hwy/member-institutes/:id/admin-assign', async () => {
    const response = await fetch(`${baseUrl}/api/hwy/member-institutes/42/admin-assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instituteCode: '001' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.instituteId).toBe(7);
  });

  it('POST /api/hwy/membership/call-center/:id/decision', async () => {
    const response = await fetch(`${baseUrl}/api/hwy/membership/call-center/42/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', decisionNote: 'ok' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.memberId).toBe('42');
  });
});
