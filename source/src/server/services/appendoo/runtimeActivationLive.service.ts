import { insertManagedFunctionToStore } from '../../../core/functions/FunctionFileStore';
import { buildManagedFunctionId } from '../../../core/functions/functionNaming';
import type {
  RuntimeActivationBatchResult,
  RuntimeActivationRecord,
} from '../../../shared/api/contracts/appendoo/runtimeActivation.types';
import type { RuntimeActivationTarget } from '../../../shared/lib/appendoo/runtimeActivationScaffold';
import { workspaceArtifactStore } from '../../../shared/lib/appendoo/workspaceArtifactStore';

type WorkspaceFunctionMetadata = {
  folder?: string;
  name?: string;
  method?: string;
  path?: string;
  language?: string;
  testPayload?: string;
  runtimeVersion?: string;
  memoryLimit?: number;
  timeoutMs?: number;
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  cacheByParam?: boolean;
  cacheByUser?: boolean;
  engineType?: 'SANDBOX_JS' | 'DATA_API';
  metadataJson?: string | null;
};

const failRecord = (
  record: RuntimeActivationRecord,
  message: string,
): RuntimeActivationRecord => ({
  ...record,
  status: 'FAILED',
  errors: [...record.errors, message],
});

const persistServerFunctionTarget = (
  target: RuntimeActivationTarget,
  record: RuntimeActivationRecord,
): RuntimeActivationRecord => {
  if (record.status !== 'ACTIVATED' || !target.workspacePath.endsWith('.ts')) {
    return record;
  }

  const sourcePath = target.workspacePath;
  const metadataPath = sourcePath.replace(/\.ts$/, '.metadata.json');
  const source = workspaceArtifactStore.read(sourcePath);
  const metadataRaw = workspaceArtifactStore.read(metadataPath);

  if (!source || !metadataRaw) {
    return failRecord(record, 'Live activation requires workspace source and metadata artifacts.');
  }

  let metadata: WorkspaceFunctionMetadata;
  try {
    metadata = JSON.parse(metadataRaw.content) as WorkspaceFunctionMetadata;
  } catch {
    return failRecord(record, 'Workspace metadata is not valid JSON.');
  }

  const folder = metadata.folder?.trim();
  const name = metadata.name?.trim();
  if (!folder || !name) {
    return failRecord(record, 'Workspace metadata must include folder and name.');
  }

  try {
    insertManagedFunctionToStore({
      id: buildManagedFunctionId(folder, name),
      name,
      folder,
      method: metadata.method?.trim() || 'POST',
      path: metadata.path?.trim() || `/appendoo/${name}`,
      code: source.content,
      language: metadata.language === 'js' ? 'js' : 'ts',
      testPayload: metadata.testPayload ?? '{}',
      runtimeVersion: metadata.runtimeVersion ?? 'v20.x',
      memoryLimit: metadata.memoryLimit ?? 128,
      timeoutMs: metadata.timeoutMs ?? 1500,
      cacheEnabled: metadata.cacheEnabled ?? false,
      cacheTtlMs: metadata.cacheTtlMs ?? 180000,
      cacheByParam: metadata.cacheByParam ?? false,
      cacheByUser: metadata.cacheByUser ?? false,
      engineType: metadata.engineType === 'DATA_API' ? 'DATA_API' : 'SANDBOX_JS',
      metadataJson: metadata.metadataJson ?? null,
      createdBy: 'appendoo-live-activation',
      updatedBy: 'appendoo-live-activation',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failRecord(record, `FunctionFileStore insert failed: ${message}`);
  }

  return record;
};

/** AE-9.6 — persist validated workspace server functions through FunctionFileStore. */
export const persistLiveRuntimeActivations = (
  targets: RuntimeActivationTarget[],
  batch: RuntimeActivationBatchResult,
): RuntimeActivationBatchResult => {
  const records = batch.records.map((record, index) => {
    const target = targets[index];
    if (!target || target.kind !== 'server_function') {
      return record;
    }
    return persistServerFunctionTarget(target, record);
  });

  return {
    records,
    activatedCount: records.filter((record) => record.status === 'ACTIVATED').length,
    validatedCount: records.filter((record) => record.status === 'VALIDATED').length,
    failedCount: records.filter((record) => record.status === 'FAILED').length,
  };
};
