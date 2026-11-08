import type {
  EdgeApiDefinition,
  EdgeApiOperation,
} from '../../../shared/api/contracts/data-api';
import {
  createEdgeApiDefinitionDraft,
  deleteEdgeApiDefinitionById,
  publishEdgeApiDefinition,
  unpublishEdgeApiDefinition,
} from './edgeApiPublisher';
import {
  getEdgeApiDefinitionById,
  listEdgeApiDefinitions,
  saveEdgeApiDefinition,
} from './edgeApiStore';
import { getEdgeModelById } from './edgeModelStore';
import { DataApiExecutor } from './dataApiExecutor';
import {
  buildDefaultCollectionOperations,
  enrichEdgeApiOperationsFromModel,
} from '../../../shared/lib/edgeApiOperations';

export class EdgeApiService {
  private readonly executor: DataApiExecutor;

  constructor(executor: DataApiExecutor) {
    this.executor = executor;
  }

  listDefinitions(): EdgeApiDefinition[] {
    return listEdgeApiDefinitions();
  }

  getDefinition(id: string): EdgeApiDefinition | null {
    return getEdgeApiDefinitionById(id);
  }

  createDefinition(input: {
    edgeModelId: string;
    key: string;
    label: string;
    basePath: string;
    operations?: EdgeApiOperation[];
  }): EdgeApiDefinition {
    const model = getEdgeModelById(input.edgeModelId);
    if (!model) {
      throw new Error(`Edge model not found: ${input.edgeModelId}`);
    }

    const operations = enrichEdgeApiOperationsFromModel(
      input.operations ?? buildDefaultCollectionOperations(input.basePath),
      model,
    );

    const existing = listEdgeApiDefinitions().find((definition) => (
      definition.edgeModelId === input.edgeModelId
      && (
        definition.key === input.key
        || definition.basePath === input.basePath
      )
    ));
    if (existing) {
      return this.updateDefinition(existing.id, {
        key: input.key,
        label: input.label,
        basePath: input.basePath,
        operations,
      });
    }

    const draft = createEdgeApiDefinitionDraft({
      edgeModelId: input.edgeModelId,
      key: input.key,
      label: input.label,
      basePath: input.basePath,
      operations,
    });

    return saveEdgeApiDefinition(draft);
  }

  updateDefinition(
    id: string,
    patch: Partial<Pick<EdgeApiDefinition, 'key' | 'label' | 'basePath' | 'operations' | 'accessControl' | 'runtime' | 'openapi' | 'defaultWhere' | 'changeReason'>>,
  ): EdgeApiDefinition {
    const existing = getEdgeApiDefinitionById(id);
    if (!existing) {
      throw new Error(`Edge API definition not found: ${id}`);
    }

    const model = getEdgeModelById(existing.edgeModelId);
    if (!model) {
      throw new Error(`Edge model not found: ${existing.edgeModelId}`);
    }

    const nextOperations = patch.operations
      ? enrichEdgeApiOperationsFromModel(patch.operations, model)
      : existing.operations;

    const updated: EdgeApiDefinition = {
      ...existing,
      ...patch,
      operations: nextOperations,
      accessControl: patch.accessControl ?? existing.accessControl,
      runtime: patch.runtime ?? existing.runtime,
      openapi: patch.openapi ? { ...existing.openapi, ...patch.openapi } : existing.openapi,
    };

    return saveEdgeApiDefinition(updated);
  }

  publish(id: string): EdgeApiDefinition {
    return publishEdgeApiDefinition(id);
  }

  unpublish(id: string): EdgeApiDefinition {
    return unpublishEdgeApiDefinition(id);
  }

  delete(id: string): void {
    deleteEdgeApiDefinitionById(id);
  }

  async tryDefinition(
    id: string,
    input: {
      method: string;
      path: string;
      params?: Record<string, string>;
      query?: Record<string, unknown>;
      body?: unknown;
      /** PDK-5 — test this operation's Record Policy as a specific actor instead of anonymous. */
      testActorUserId?: string | number | null;
      testActorRoles?: string[];
      testActorIsAdmin?: boolean;
    },
  ): Promise<Record<string, unknown>> {
    const definition = getEdgeApiDefinitionById(id);
    if (!definition) {
      throw new Error(`Edge API definition not found: ${id}`);
    }

    const { operation } = this.executor.resolveOperation(id, input.method, input.path, true);
    return this.executor.execute({
      edgeApiDefinitionId: id,
      operationId: operation.id,
      params: input.params,
      query: input.query,
      body: input.body,
      actorUserId: input.testActorUserId,
      actorRoles: input.testActorRoles,
      actorIsAdmin: input.testActorIsAdmin,
      skipPublishCheck: true,
    });
  }
}
