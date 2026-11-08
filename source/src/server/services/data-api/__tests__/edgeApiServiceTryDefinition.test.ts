import { describe, expect, it, vi } from 'vitest';
import type { EdgeApiDefinition, EdgeApiOperation, EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';

vi.mock('../edgeApiStore', () => ({
  getEdgeApiDefinitionById: vi.fn(() => ({ id: 'def_1', edgeModelId: 'model_1', operations: [] })),
  listEdgeApiDefinitions: vi.fn(() => []),
  saveEdgeApiDefinition: vi.fn(),
}));

import { EdgeApiService } from '../edgeApiService';
import { DataApiExecutor } from '../dataApiExecutor';

describe('EdgeApiService.tryDefinition — PDK-5 actor override', () => {
  it('forwards testActorUserId/testActorRoles/testActorIsAdmin into executor.execute as actorUserId/actorRoles/actorIsAdmin', async () => {
    const executor = new DataApiExecutor({ getDataSources: () => [] });

    vi.spyOn(executor, 'resolveOperation').mockReturnValue({
      definition: { id: 'def_1' } as EdgeApiDefinition,
      model: { id: 'model_1' } as EdgeModelDefinition,
      operation: { id: 'op_1' } as EdgeApiOperation,
    });
    const executeSpy = vi.spyOn(executor, 'execute').mockResolvedValue({ success: true, data: [] });

    const service = new EdgeApiService(executor);
    await service.tryDefinition('def_1', {
      method: 'GET',
      path: '/api/x',
      query: { page: 1 },
      testActorUserId: 42,
      testActorRoles: ['USER'],
      testActorIsAdmin: false,
    });

    expect(executeSpy).toHaveBeenCalledWith(expect.objectContaining({
      edgeApiDefinitionId: 'def_1',
      operationId: 'op_1',
      query: { page: 1 },
      actorUserId: 42,
      actorRoles: ['USER'],
      actorIsAdmin: false,
      skipPublishCheck: true,
    }));
  });

  it('runs anonymously (undefined actor fields) when no test actor is supplied', async () => {
    const executor = new DataApiExecutor({ getDataSources: () => [] });

    vi.spyOn(executor, 'resolveOperation').mockReturnValue({
      definition: { id: 'def_1' } as EdgeApiDefinition,
      model: { id: 'model_1' } as EdgeModelDefinition,
      operation: { id: 'op_1' } as EdgeApiOperation,
    });
    const executeSpy = vi.spyOn(executor, 'execute').mockResolvedValue({ success: true, data: [] });

    const service = new EdgeApiService(executor);
    await service.tryDefinition('def_1', { method: 'GET', path: '/api/x' });

    expect(executeSpy).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: undefined,
      actorRoles: undefined,
      actorIsAdmin: undefined,
    }));
  });
});
