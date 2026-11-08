/**
 * Smoke: login + agent/run stream for "دوباره تلاش کن" on sum-two-numbers.
 * Usage: node scripts/smoke-appendoo-continuation.mjs
 */
const BASE = process.env.APPENDO_URL ?? 'http://localhost:3000';

const pageContext = {
  path: '/us/studio/server-functions/math/sum-two-numbers',
  pageLabel: 'Server Functions',
  pageKey: 'server-functions',
  functionId: 'math.sum-two-numbers',
  functionName: 'sum-two-numbers',
};

async function login() {
  const attempts = [
    { email: 'admin@append.os', password: 'admin123' },
    { username: 'admin', password: 'admin123' },
  ];

  for (const body of attempts) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.accessToken) {
      return String(data.accessToken);
    }
  }

  throw new Error('Login failed — set SMOKE_EMAIL/SMOKE_PASSWORD for your dev admin user.');
}

async function listModels(token) {
  const res = await fetch(`${BASE}/api/ai/models`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Models failed (${res.status}): ${data.error ?? res.statusText}`);
  }
  const models = data.models ?? [];
  const withTools = models.find((model) => model.capabilities?.tools);
  if (!withTools) {
    throw new Error('No AI model with tools capability is configured.');
  }
  return withTools.id;
}

async function runAgent(token, modelId) {
  const res = await fetch(`${BASE}/api/ai/agent/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mode: 'agent',
      modelId,
      messages: [{ role: 'user', content: 'دوباره تلاش کن' }],
      pageContext,
      enabledCapabilityPackIds: [
        'appendo-files',
        'appendo-codebase',
        'appendo-standards',
        'appendo-context',
        'appendo-designer',
        'appendo-server-functions',
      ],
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Agent run failed (${res.status}): ${data.error ?? res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.split('\n').find((entry) => entry.startsWith('data:'));
      if (!line) continue;
      try {
        events.push(JSON.parse(line.slice(5).trim()));
      } catch {
        // ignore
      }
    }
  }

  return events;
}

const main = async () => {
  console.log(`[smoke] base=${BASE}`);
  const token = await login();
  console.log('[smoke] login ok');
  const modelId = await listModels(token);
  console.log(`[smoke] model=${modelId}`);
  const events = await runAgent(token, modelId);

  const routing = events.find((event) => event.type === 'request_routing');
  const pipeline = events.find((event) => event.type === 'engineering_pipeline');
  const profile = events.find((event) => event.type === 'turn_profile');
  const done = events.find((event) => event.type === 'done');

  console.log('[smoke] turn_profile:', profile?.profile, profile?.label);
  console.log('[smoke] routing:', routing?.requestClass, 'pipeline=', routing?.useEngineeringPipeline);
  console.log('[smoke] engineering_pipeline:', {
    requiresApproval: pipeline?.requiresApproval,
    approvalBindingId: pipeline?.approvalBindingId,
    approvalStatus: pipeline?.approvalStatus,
    planObjective: pipeline?.planObjective?.slice(0, 120),
  });
  console.log('[smoke] done text preview:', (done?.text ?? '').slice(0, 200));

  if (profile?.profile !== 'agent_implement') {
    throw new Error(`Expected agent_implement profile, got ${profile?.profile}`);
  }
  if (!routing?.useEngineeringPipeline) {
    throw new Error('Expected useEngineeringPipeline=true');
  }
  if (!pipeline?.requiresApproval) {
    throw new Error('Expected engineering_pipeline.requiresApproval=true');
  }
  if (!pipeline?.approvalBindingId) {
    throw new Error('Expected approvalBindingId on engineering_pipeline event');
  }

  console.log('[smoke] PASS — Approve & build should be visible in AppEndoo panel.');
};

main().catch((error) => {
  console.error('[smoke] FAIL', error.message ?? error);
  process.exit(1);
});
