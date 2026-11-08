import type {
  RuntimeActivationBatchResult,
  RuntimeActivationRecord,
} from '../../../shared/api/contracts/appendoo/runtimeActivation.types';
import type { RuntimeActivationTarget } from '../../../shared/lib/appendoo/runtimeActivationScaffold';
import { workspaceArtifactStore } from '../../../shared/lib/appendoo/workspaceArtifactStore';
import { propagateDesignerLayoutRoutes } from '../platform/designerRoutePropagation.service';

type WorkspaceExperienceRoute = {
  slug?: string;
  title?: string;
  folder?: string;
};

const failRecord = (
  record: RuntimeActivationRecord,
  message: string,
): RuntimeActivationRecord => ({
  ...record,
  status: 'FAILED',
  errors: [...record.errors, message],
});

const persistExperienceRouteTarget = async (
  target: RuntimeActivationTarget,
  record: RuntimeActivationRecord,
): Promise<RuntimeActivationRecord> => {
  if (record.status !== 'ACTIVATED' || !target.workspacePath.endsWith('.json')) {
    return record;
  }

  const artifact = workspaceArtifactStore.read(target.workspacePath);
  if (!artifact) {
    return failRecord(record, `Missing workspace route artifact: ${target.workspacePath}`);
  }

  let parsed: WorkspaceExperienceRoute;
  try {
    parsed = JSON.parse(artifact.content) as WorkspaceExperienceRoute;
  } catch {
    return failRecord(record, 'Experience route artifact is not valid JSON.');
  }

  const slug = parsed.slug?.trim();
  const title = parsed.title?.trim() || slug;
  if (!slug) {
    return failRecord(record, 'Experience route artifact must include slug.');
  }

  try {
    await propagateDesignerLayoutRoutes({
      slug,
      title: title ?? slug,
      folder: parsed.folder?.trim() || 'appendoo',
      actor: { userId: null, username: 'appendoo-live-activation' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failRecord(record, `Experience registry compile failed: ${message}`);
  }

  return {
    ...record,
    activationRef: slug,
  };
};

/** AE-9.8 — compile workspace experience routes through platform registry propagation. */
export const persistLiveExperienceActivations = async (
  targets: RuntimeActivationTarget[],
  batch: RuntimeActivationBatchResult,
): Promise<RuntimeActivationBatchResult> => {
  const records: RuntimeActivationRecord[] = [];

  for (let index = 0; index < batch.records.length; index += 1) {
    const record = batch.records[index];
    const target = targets[index];
    if (!target || target.kind !== 'experience_route') {
      records.push(record);
      continue;
    }
    records.push(await persistExperienceRouteTarget(target, record));
  }

  return {
    records,
    activatedCount: records.filter((item) => item.status === 'ACTIVATED').length,
    validatedCount: records.filter((item) => item.status === 'VALIDATED').length,
    failedCount: records.filter((item) => item.status === 'FAILED').length,
  };
};

/** AE-9.8 — await experience registry compile after designer publish. */
export const compileExperienceRegistryFromDesignerPublish = async (input: {
  componentPath: string;
  title: string;
  folder: string;
}): Promise<void> => {
  await propagateDesignerLayoutRoutes({
    slug: input.componentPath,
    title: input.title,
    folder: input.folder,
    actor: { userId: null, username: 'appendoo-live-activation' },
  });
};
