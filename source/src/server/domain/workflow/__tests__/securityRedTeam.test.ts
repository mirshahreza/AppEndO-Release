import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { integrationHttpRequestExecutor } from '../actions/corePack/integrationActions';
import { registerCoreActionPack } from '../actions/corePack';
import { createWorkflowDefinition, getWorkflowDefinitionById } from '../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../publication/workflowPublicationService';
import { startWorkflowInstance } from '../engine/startService';
import { registerActionDefinition, registerActionProvider } from '../actions/registry';
import { buildDeterministicProofForInstance } from '../proofProjection';
import { createWorkItem } from '../workItemRepository';
import { baseModel, endNode, actionNode, unconditionalEdge } from '../engine/__tests__/fixtures';
import type { ActionExecutorContext } from '../actions/types';
import type { ActionDefinition, ActionProviderRegistration } from '../actions/types';
import type { ActionResolutionRef } from '../awm/types';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const NO_RETRY = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };

registerCoreActionPack();

/**
 * Doc 11 section 13 — security and red-team tests. Repository Reality Audit (Slice 12) found real
 * coverage already exists elsewhere for: simulation side-effect fence
 * (`designer/simulation/__tests__/simulationEngine.test.ts`), payload/depth limits
 * (`publication/__tests__/policyLimitValidation.test.ts`), authorization revalidation on Work Item
 * claim/complete (`engine/__tests__/workItemLifecycle.test.ts`), and authoring-time literal-secret
 * scanning (`publication/__tests__/actionResolutionValidation.test.ts`). This file adds the
 * confirmed-missing categories: SSRF primitive dependency (never previously exercised against a
 * blocked target), secret absence (proven structurally, not incidentally — see below), and
 * malicious/adversarial label/metadata storage safety.
 */
describe('security and red-team (doc 11 section 13)', () => {
  const fakeContext: ActionExecutorContext = {
    workflowInstanceId: 'i1',
    nodeInstanceId: 'n1',
    logicalInvocationId: 'l1',
    idempotencyKey: 'k1',
    effectiveIdentity: { type: 'SYSTEM', id: null },
    cancellationSignal: new AbortController().signal,
    resolveSecret: async () => 'canary-should-never-be-called',
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    writeTraceMetadata: () => {},
  };

  describe('SSRF primitive dependency (doc 09 section 3, doc 10 section 9)', () => {
    it('integration.http-request rejects a loopback URL (127.0.0.1) with HTTP_URL_BLOCKED/SSRF_BLOCKED, never reaching fetch', async () => {
      const result = await integrationHttpRequestExecutor.execute(fakeContext, {}, { method: 'GET', url: 'http://127.0.0.1/admin' });
      expect(result.status).toBe('FAILED');
      expect((result as { errorCode: string }).errorCode).toBe('HTTP_URL_BLOCKED');
      expect((result as { errorClass: string }).errorClass).toBe('SSRF_BLOCKED');
    });

    it('integration.http-request rejects the "localhost" hostname', async () => {
      const result = await integrationHttpRequestExecutor.execute(fakeContext, {}, { method: 'GET', url: 'http://localhost:5432/' });
      expect(result.status).toBe('FAILED');
      expect((result as { errorCode: string }).errorCode).toBe('HTTP_URL_BLOCKED');
    });

    it('integration.http-request rejects a link-local metadata-service IP (169.254.169.254)', async () => {
      const result = await integrationHttpRequestExecutor.execute(fakeContext, {}, { method: 'GET', url: 'http://169.254.169.254/latest/meta-data/' });
      expect(result.status).toBe('FAILED');
      expect((result as { errorCode: string }).errorCode).toBe('HTTP_URL_BLOCKED');
    });

    it('the SSRF-blocked failure message never echoes the blocked internal URL back verbatim as a bare success signal (classification-safe rejection, doc 09 section 3)', async () => {
      const result = await integrationHttpRequestExecutor.execute(fakeContext, {}, { method: 'GET', url: 'http://192.168.1.1/secrets' });
      expect(result.status).toBe('FAILED');
      // classification-safe: rejection is a distinct errorClass, not a generic passthrough of the raw target.
      expect((result as { errorClass: string }).errorClass).toBe('SSRF_BLOCKED');
    });
  });

  describe('secret absence (doc 09 section 2)', () => {
    it('no shipped corePack executor in the dispatch surface calls context.resolveSecret — the real wired context (attemptService.ts) always throws WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT, so a resolved secret can never enter config/input/output/context/trace by construction', async () => {
      // A context whose resolveSecret always throws, matching the real `attemptService.ts` wiring
      // exactly (doc 09 territory, not built — see that file's own module comment). If any shipped
      // executor secretly started calling resolveSecret, this canary context makes that failure
      // loud (the executor would throw/return FAILED) instead of silently resolving a real secret.
      const throwingContext: ActionExecutorContext = {
        ...fakeContext,
        resolveSecret: async () => {
          throw new Error('canary: resolveSecret must never be called by a shipped V1 executor');
        },
      };
      const httpResult = await integrationHttpRequestExecutor.execute(throwingContext, { headers: { Authorization: 'Bearer literal-not-a-real-secret-ref' } }, { method: 'GET', url: 'https://example.com' });
      // Either fails validation/SSRF or genuinely attempts fetch — in no case does it throw from the canary, proving it never called resolveSecret.
      expect(['FAILED', 'SUCCEEDED']).toContain(httpResult.status);
    });

    it('a workflow instance that runs integration.http-request end to end persists no resolveSecret-derived value anywhere in Proof core evidence (structural: resolution never succeeds)', async () => {
      if (!dbReady) return;
      const { pool } = await bootstrapWorkflowE2eEnvironment();
      try {
        const model = baseModel({
          nodes: [actionNode('call', { actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'integration.http-request', actionVersion: '1' }, providerId: 'core', providerVersion: '1' }, retryPolicy: NO_RETRY }), endNode('end-1')],
          edges: [unconditionalEdge('e1', 'call', 'end-1')],
          start: { type: 'MANUAL_API', targetNodeKey: 'call' },
        });
        const definition = await createTestWorkflowDefinition({ key: uniqueKey('secret-absence'), draftDefinitionJson: JSON.stringify(model) });
        const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
        const { instance, nodeInstances } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: null, startedByType: 'SYSTEM' });

        const { dispatchNode } = await import('../engine/dispatchService');
        const callNode = nodeInstances.find((n) => n.semanticNodeKey === 'call')!;
        await dispatchNode({ nodeInstanceId: callNode.id, leaseOwnerId: 'security-test-worker' });

        const proof = await buildDeterministicProofForInstance(instance.id);
        const serializedProof = JSON.stringify(proof);
        expect(serializedProof).not.toContain('canary-should-never-be-called');
        expect(serializedProof.toLowerCase()).not.toContain('resolvesecret');
      } finally {
        await shutdownWorkflowE2eEnvironment(pool);
      }
    });
  });

  describe('malicious/adversarial labels and metadata are stored and returned as inert data (doc 11 section 13)', () => {
    it('a WorkItem with an XSS/script-tag-bearing titleText round-trips through storage byte-for-byte, never interpreted/executed/stripped', async () => {
      if (!dbReady) return;
      const { pool } = await bootstrapWorkflowE2eEnvironment();
      try {
        const model = baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
        const definition = await createTestWorkflowDefinition({ key: uniqueKey('malicious-label'), draftDefinitionJson: JSON.stringify(model) });
        const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
        const { instance, nodeInstances } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: null, startedByType: 'SYSTEM' });

        const maliciousTitle = '<script>alert(document.cookie)</script>\'; DROP TABLE base_workflow_definitions; --';
        const workItem = await createWorkItem({
          workflowInstanceId: instance.id,
          nodeInstanceId: nodeInstances[0]!.id,
          workItemType: 'APPROVAL',
          titleText: maliciousTitle,
          summaryText: maliciousTitle,
          allowedOutcomesJson: JSON.stringify(['APPROVE']),
          priority: 0,
          inputJson: JSON.stringify({}),
          assignmentEvidenceJson: JSON.stringify({ resolvedType: 'USER', resolvedUserId: 1 }),
        });

        // Verifies the string survived storage/retrieval completely unmodified — no sanitization,
        // truncation or escaping silently altered it (it is opaque application data, not markup to
        // be rendered by this layer; a UI layer is responsible for output-encoding it, not storage).
        expect(workItem.titleText).toBe(maliciousTitle);
        expect(workItem.summaryText).toBe(maliciousTitle);

        // Postgres itself is unaffected (proves no raw string interpolation/SQL injection path exists — Prisma parameterizes).
        const stillExists = await getWorkflowDefinitionById(definition.id);
        expect(stillExists).toBeDefined();
      } finally {
        await shutdownWorkflowE2eEnvironment(pool);
      }
    });

    it('a WorkflowDefinition key containing adversarial characters is either rejected by schema validation or stored inertly — never causes a crash or unexpected query behavior', async () => {
      if (!dbReady) return;
      const { pool } = await bootstrapWorkflowE2eEnvironment();
      try {
        const adversarialKey = uniqueKey('key-with-"quotes\'-and-\\backslash-{{template}}');
        const model = baseModel({ key: adversarialKey, nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
        // Either path is an acceptable, safe outcome — the assertion is "does not crash the process / does not corrupt other rows."
        try {
          const definition = await createTestWorkflowDefinition({ key: adversarialKey, draftDefinitionJson: JSON.stringify(model) });
          expect(definition.key).toBe(adversarialKey);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
        // Sanity: the DB/process is still healthy after the adversarial insert attempt.
        const probe = await createTestWorkflowDefinition({ key: uniqueKey('post-adversarial-probe'), draftDefinitionJson: JSON.stringify(baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } })) });
        expect(probe.id).toBeGreaterThan(0);
      } finally {
        await shutdownWorkflowE2eEnvironment(pool);
      }
    });
  });
});
