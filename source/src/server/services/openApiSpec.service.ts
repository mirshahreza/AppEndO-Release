import { createHash } from 'crypto';
import {
  buildAggregatedManagedFunctionsOpenApiDocument,
  buildManagedFunctionOpenApiDocument,
  filterFunctionsForDocAccess,
  type FunctionDocAccessPrincipal,
  type ManagedFunctionOpenApiInput,
  type OpenApiObject,
} from '../../shared/api/openapi/buildManagedFunctionOpenApi';
import { buildScriptDocFingerprintSource } from '../../shared/api/openapi/parseServerFunctionScriptDoc';
import {
  findServerFunctionDocInput,
  loadAllServerFunctionDocInputs,
  type ServerFunctionDocCatalogDeps,
} from './serverFunctionDocCatalog';

const hashFingerprintSource = (source: string): string => (
  createHash('sha256').update(source).digest('hex')
);

const buildFunctionFingerprint = (input: ManagedFunctionOpenApiInput): string => (
  hashFingerprintSource(buildScriptDocFingerprintSource({
    code: input.code,
    metadata_json: input.metadata_json,
    test_payload: input.test_payload,
    method: input.method,
    path: input.path,
    updated_at: input.updated_at,
  }))
);

type CachedFunctionSpec = {
  fingerprint: string;
  spec: OpenApiObject;
  generatedAt: string;
};

class OpenApiSpecService {
  private aggregatedCache: { fingerprint: string; spec: OpenApiObject; generatedAt: string } | null = null;

  private functionCache = new Map<string, CachedFunctionSpec>();

  private deps: ServerFunctionDocCatalogDeps | null = null;

  private readonly nowIso = (): string => new Date().toISOString();

  configure(deps: ServerFunctionDocCatalogDeps): void {
    this.deps = deps;
  }

  private requireDeps(): ServerFunctionDocCatalogDeps {
    if (!this.deps) {
      throw new Error('OpenApiSpecService is not configured with system route discovery.');
    }
    return this.deps;
  }

  invalidate(functionId?: string): void {
    this.aggregatedCache = null;
    if (functionId) {
      this.functionCache.delete(functionId);
    } else {
      this.functionCache.clear();
    }
  }

  getGeneratedAt(functionId?: string): string | null {
    if (functionId) {
      return this.functionCache.get(functionId)?.generatedAt ?? null;
    }
    return this.aggregatedCache?.generatedAt ?? null;
  }

  private buildAggregatedFingerprint(functions: ManagedFunctionOpenApiInput[]): string {
    const source = functions
      .map((fn) => `${fn.id}:${buildFunctionFingerprint(fn)}`)
      .sort()
      .join('|');
    return hashFingerprintSource(source);
  }

  private getCachedFunctionSpec(
    functionId: string,
    input: ManagedFunctionOpenApiInput,
  ): OpenApiObject | null {
    const cached = this.functionCache.get(functionId);
    const fingerprint = buildFunctionFingerprint(input);
    if (cached && cached.fingerprint === fingerprint) {
      return cached.spec;
    }
    return null;
  }

  private setCachedFunctionSpec(
    functionId: string,
    input: ManagedFunctionOpenApiInput,
    spec: OpenApiObject,
    generatedAt: string,
  ): void {
    this.functionCache.set(functionId, {
      fingerprint: buildFunctionFingerprint(input),
      spec,
      generatedAt,
    });
  }

  async getAggregatedSpec(): Promise<OpenApiObject> {
    const functions = await loadAllServerFunctionDocInputs(this.requireDeps());
    const fingerprint = this.buildAggregatedFingerprint(functions);

    if (this.aggregatedCache?.fingerprint === fingerprint) {
      return this.aggregatedCache.spec;
    }

    const generatedAt = this.nowIso();
    const spec = buildAggregatedManagedFunctionsOpenApiDocument(functions);
    this.aggregatedCache = { fingerprint, spec, generatedAt };
    return spec;
  }

  async getAggregatedSpecForPrincipal(principal: FunctionDocAccessPrincipal): Promise<OpenApiObject> {
    const functions = await loadAllServerFunctionDocInputs(this.requireDeps());
    const visibleFunctions = filterFunctionsForDocAccess(functions, principal);

    if (visibleFunctions.length === functions.length) {
      return this.getAggregatedSpec();
    }

    const generatedAt = this.nowIso();
    const spec = buildAggregatedManagedFunctionsOpenApiDocument(visibleFunctions);
    return {
      ...spec,
      info: {
        ...spec.info,
        'x-generated-at': generatedAt,
      },
    };
  }

  async getFunctionSpec(functionId: string): Promise<OpenApiObject | null> {
    const input = await findServerFunctionDocInput(this.requireDeps(), functionId);
    if (!input) {
      return null;
    }

    const cached = this.getCachedFunctionSpec(functionId, input);
    if (cached) {
      return cached;
    }

    const generatedAt = this.nowIso();
    const spec = buildManagedFunctionOpenApiDocument(input);
    this.setCachedFunctionSpec(functionId, input, spec, generatedAt);
    return spec;
  }

  async getDocsStatusForPrincipal(
    principal: FunctionDocAccessPrincipal,
    functionId?: string,
  ): Promise<{ generatedAt: string | null; routeCount: number; scope: 'all' | 'function' }> {
    if (functionId) {
      const spec = await this.getFunctionSpec(functionId);
      return {
        generatedAt: spec ? this.getGeneratedAt(functionId) : null,
        routeCount: spec ? 1 : 0,
        scope: 'function',
      };
    }

    const routes = await this.listAccessibleRoutesForPrincipal(principal);
    const spec = await this.getAggregatedSpecForPrincipal(principal);
    const generatedAt = this.getGeneratedAt()
      ?? (typeof spec.info === 'object'
        && spec.info !== null
        && typeof (spec.info as Record<string, unknown>)['x-generated-at'] === 'string'
        ? String((spec.info as Record<string, unknown>)['x-generated-at'])
        : null);

    return {
      generatedAt,
      routeCount: routes.length,
      scope: 'all',
    };
  }

  async findFunctionInput(functionId: string): Promise<ManagedFunctionOpenApiInput | null> {
    return findServerFunctionDocInput(this.requireDeps(), functionId);
  }

  async listAccessibleRoutesForPrincipal(
    principal: FunctionDocAccessPrincipal,
  ): Promise<ManagedFunctionOpenApiInput[]> {
    const functions = await loadAllServerFunctionDocInputs(this.requireDeps());
    return filterFunctionsForDocAccess(functions, principal);
  }

  async ensureWarm(): Promise<void> {
    await this.getAggregatedSpec();
  }
}

export const openApiSpecService = new OpenApiSpecService();
