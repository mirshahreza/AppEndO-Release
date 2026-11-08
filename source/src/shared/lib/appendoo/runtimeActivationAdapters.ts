import { buildManagedFunctionId } from '../../../core/functions/functionNaming';
import type { RuntimeActivationRecord } from '../../api/contracts/appendoo/runtimeActivation.types';
import type { RuntimeActivationTarget } from './runtimeActivationScaffold';
import { workspaceArtifactStore } from './workspaceArtifactStore';

const fail = (
  target: RuntimeActivationTarget,
  errors: string[],
): RuntimeActivationRecord => ({
  targetId: target.targetId,
  kind: target.kind,
  workspacePath: target.workspacePath,
  activationApi: target.activationApi,
  status: 'FAILED',
  errors,
});

/** Validate workspace server function artifacts against FunctionFileStore contract shape. */
export const activateServerFunctionFromWorkspace = (
  target: RuntimeActivationTarget,
): RuntimeActivationRecord => {
  const sourcePath = target.workspacePath.endsWith('.ts')
    ? target.workspacePath
    : target.workspacePath.replace(/\.metadata\.json$/, '.ts');
  const metadataPath = sourcePath.replace(/\.ts$/, '.metadata.json');

  const source = workspaceArtifactStore.read(sourcePath);
  const metadata = workspaceArtifactStore.read(metadataPath);

  if (!source) {
    return fail(target, [`Missing workspace source artifact: ${sourcePath}`]);
  }
  if (!metadata) {
    return fail(target, [`Missing workspace metadata artifact: ${metadataPath}`]);
  }

  let parsedMetadata: { folder?: string; name?: string };
  try {
    parsedMetadata = JSON.parse(metadata.content) as { folder?: string; name?: string };
  } catch {
    return fail(target, ['Workspace metadata is not valid JSON.']);
  }

  const folder = parsedMetadata.folder?.trim();
  const name = parsedMetadata.name?.trim();
  if (!folder || !name) {
    return fail(target, ['Workspace metadata must include folder and name.']);
  }

  if (!source.content.includes('export default')) {
    return fail(target, ['Workspace server function source must export a default handler.']);
  }

  const functionId = buildManagedFunctionId(folder, name);

  return {
    targetId: target.targetId,
    kind: target.kind,
    workspacePath: target.workspacePath,
    activationApi: target.activationApi,
    status: 'ACTIVATED',
    activationRef: functionId,
    errors: [],
  };
};

/** Validate designer draft workspace artifact before publish coordinator handoff. */
export const activateDesignerDraftFromWorkspace = (
  target: RuntimeActivationTarget,
): RuntimeActivationRecord => {
  const draftPath = target.workspacePath.endsWith('/draft.json')
    ? target.workspacePath
    : `${target.workspacePath.replace(/\/[^/]+$/, '')}/draft.json`;

  const draft = workspaceArtifactStore.read(draftPath);
  if (!draft) {
    return fail(target, [`Missing designer draft artifact: ${draftPath}`]);
  }

  let parsed: { schema?: string; draftId?: string; id?: string; document?: unknown };
  try {
    parsed = JSON.parse(draft.content) as { schema?: string; draftId?: string; id?: string; document?: unknown };
  } catch {
    return fail(target, ['Designer draft artifact is not valid JSON.']);
  }

  const draftId = parsed.id?.trim() || parsed.draftId?.trim();
  if (parsed.schema !== 'component-designer-draft' || !draftId) {
    return fail(target, ['Designer draft artifact failed schema validation.']);
  }

  return {
    targetId: target.targetId,
    kind: target.kind,
    workspacePath: target.workspacePath,
    activationApi: target.activationApi,
    status: 'ACTIVATED',
    activationRef: draftId,
    errors: [],
  };
};

/** Validate workspace experience route artifact before registry compile handoff. */
export const activateExperienceRouteFromWorkspace = (
  target: RuntimeActivationTarget,
): RuntimeActivationRecord => {
  const artifact = workspaceArtifactStore.read(target.workspacePath);
  if (!artifact) {
    return fail(target, [`Missing workspace route artifact: ${target.workspacePath}`]);
  }

  let parsed: { schema?: string; slug?: string; title?: string };
  try {
    parsed = JSON.parse(artifact.content) as { schema?: string; slug?: string; title?: string };
  } catch {
    return fail(target, ['Experience route artifact is not valid JSON.']);
  }

  if (parsed.schema !== 'appendoo-experience-route' || !parsed.slug?.trim()) {
    return fail(target, ['Experience route artifact failed schema validation.']);
  }

  return {
    targetId: target.targetId,
    kind: target.kind,
    workspacePath: target.workspacePath,
    activationApi: target.activationApi,
    status: 'ACTIVATED',
    activationRef: parsed.slug.trim(),
    errors: [],
  };
};

export const activateGenericWorkspaceArtifact = (
  target: RuntimeActivationTarget,
): RuntimeActivationRecord => {
  const artifact = workspaceArtifactStore.read(target.workspacePath);
  if (!artifact) {
    return fail(target, [`Missing workspace artifact: ${target.workspacePath}`]);
  }

  return {
    targetId: target.targetId,
    kind: target.kind,
    workspacePath: target.workspacePath,
    activationApi: target.activationApi,
    status: 'VALIDATED',
    activationRef: artifact.fingerprint,
    errors: [],
  };
};
