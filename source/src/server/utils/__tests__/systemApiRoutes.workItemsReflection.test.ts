import express from 'express';
import { describe, expect, it } from 'vitest';
import { collectSystemApiRoutes } from '../systemApiRoutes';
import { mountWorkflowWorkItemsRoutes } from '../../routes/workflow-work-items.routes';
import { buildManagedFunctionOpenApiPaths, type ManagedFunctionOpenApiInput } from '../../../shared/api/openapi/buildManagedFunctionOpenApi';

/**
 * Regression coverage for HWF-1.4: `WorkflowWorkItemsController`'s methods are registered as
 * `controller.method = asyncHandler(realHandler, fallbackMessage)`, so the Express route's terminal
 * middleware is asyncHandler's generic catch-and-forward closure, not `realHandler`. Before
 * `getAsyncHandlerInnerHandler` (asyncHandler.ts) + its use in `buildSystemFunctionRoutePreviewCode`
 * (systemApiRoutes.ts), every asyncHandler-wrapped built-in route — hundreds, platform-wide —
 * reflected that identical wrapper source, so the OpenAPI doc pipeline
 * (`parseServerFunctionScriptDoc.ts`) saw no real params/body signal and fell back to a generic
 * operation for all of them.
 */
describe('built-in route OpenAPI reflection through asyncHandler', () => {
  const buildRouteInput = (route: { id: string; name: string; folder: string; method: string; path: string; code: string; testPayload: string }): ManagedFunctionOpenApiInput => ({
    id: route.id,
    name: route.name,
    folder: route.folder,
    method: route.method,
    path: route.path,
    code: route.code,
    metadata_json: null,
    test_payload: route.testPayload,
    engine_type: 'SANDBOX_JS',
    is_built_in: true,
  });

  const setup = async () => {
    const app = express();
    mountWorkflowWorkItemsRoutes(app);
    const routes = await collectSystemApiRoutes(app, { includePreviewCode: true });
    return routes;
  };

  it('reflects the real controller logic, not the asyncHandler wrapper closure', async () => {
    const routes = await setup();
    const getWorkItem = routes.find((r) => r.method === 'GET' && r.path === '/api/workflow-work-items/:workItemId');
    const claim = routes.find((r) => r.method === 'POST' && r.path === '/api/workflow-work-items/:workItemId/claim');
    const complete = routes.find((r) => r.method === 'POST' && r.path === '/api/workflow-work-items/:workItemId/complete');

    expect(getWorkItem).toBeTruthy();
    expect(claim).toBeTruthy();
    expect(complete).toBeTruthy();

    // Real business logic must show up in the reflected source.
    expect(getWorkItem!.code).toContain('getWorkItemById');
    expect(getWorkItem!.code).toContain('isActorEligibleForWorkItem');
    expect(claim!.code).toContain('claimWorkItem');
    expect(complete!.code).toContain('completeWorkItem');
    expect(complete!.code).toContain('outcome');

    // The generic asyncHandler wrapper closure must NOT be what gets reflected.
    for (const route of [getWorkItem!, claim!, complete!]) {
      expect(route.code).not.toMatch(/Promise\.resolve\(handler\(req, res, next\)\)/);
    }
  });

  it('produces a meaningful OpenAPI operation for GET /:workItemId (real path param, no fabricated body)', async () => {
    const routes = await setup();
    const route = routes.find((r) => r.method === 'GET' && r.path === '/api/workflow-work-items/:workItemId')!;
    const paths = buildManagedFunctionOpenApiPaths(buildRouteInput(route));
    const operation = paths['/api/workflow-work-items/{workItemId}']?.get as Record<string, unknown>;

    expect(operation).toBeTruthy();
    const parameters = operation.parameters as Array<Record<string, unknown>>;
    expect(parameters.some((p) => p.name === 'workItemId' && p.in === 'path')).toBe(true);
  });

  it('produces a meaningful OpenAPI requestBody for POST /:workItemId/complete (real outcome/output fields)', async () => {
    const routes = await setup();
    const route = routes.find((r) => r.method === 'POST' && r.path === '/api/workflow-work-items/:workItemId/complete')!;
    const paths = buildManagedFunctionOpenApiPaths(buildRouteInput(route));
    const operation = paths['/api/workflow-work-items/{workItemId}/complete']?.post as Record<string, unknown>;

    expect(operation).toBeTruthy();
    const requestBody = operation.requestBody as { content: Record<string, { schema: Record<string, unknown> }> };
    const schema = requestBody.content['application/json'].schema;
    expect(schema.properties).toMatchObject({
      outcome: expect.any(Object),
      output: expect.any(Object),
    });
    expect(schema.required).toEqual(expect.arrayContaining(['outcome', 'output']));
  });
});
