import type { BuilderContext } from '../../api/contracts/appendoo/builderProtocol.types';
import { describeBuilderPrimitive } from './builderPrimitivePaths';
import { tryBuildServerFunctionUiDraftFromChangeNode, buildServerFunctionUiDesignerDraft, extractBoundFunctionIdFromChangeNode } from './serverFunctionUiDraftScaffold';
import { workspaceArtifactStore } from './workspaceArtifactStore';

const scaffoldServerFunctionSource = (context: BuilderContext): string => `/** AppEndoo workspace scaffold — ${context.operationId} */
export default async function handler() {
  return { ok: true, operation: '${context.changeNode.operationType}' };
}
`;

const scaffoldMetadataJson = (context: BuilderContext): string => JSON.stringify({
  schema: 'append-server-function-metadata',
  schemaVersion: '2.0.0',
  id: context.changeNode.targetRef.targetId,
  name: context.changeNode.targetRef.ref ?? context.changeNode.targetRef.targetId,
  folder: 'appendoo',
  method: 'POST',
  path: `/appendoo/${context.changeNode.targetRef.targetId}`,
  sourceFile: `${context.changeNode.targetRef.targetId}.ts`,
  language: 'ts',
}, null, 2);

const scaffoldDesignerDraftJson = (context: BuilderContext): string => {
  const functionId = extractBoundFunctionIdFromChangeNode(context.changeNode);
  if (functionId) {
    return JSON.stringify(
      buildServerFunctionUiDesignerDraft(functionId, context.changeNode.expectedOutputs[0]),
      null,
      2,
    );
  }

  return JSON.stringify({
    schema: 'component-designer-draft',
    draftId: context.changeNode.targetRef.ref ?? context.changeNode.targetRef.targetId,
    title: context.changeNode.expectedOutputs[0] ?? context.changeNode.targetRef.ref ?? context.changeNode.targetRef.targetId,
    builder: describeBuilderPrimitive(context.changeNode),
  }, null, 2);
};

const scaffoldExperienceRouteJson = (context: BuilderContext): string => JSON.stringify({
  schema: 'appendoo-experience-route',
  slug: context.changeNode.targetRef.ref ?? context.changeNode.targetRef.targetId,
  title: context.changeNode.expectedOutputs[0] ?? context.changeNode.targetRef.ref ?? context.changeNode.targetRef.targetId,
  folder: 'appendoo',
}, null, 2);

const resolveDesignerDraftJson = (context: BuilderContext): string => {
  const fullDraft = tryBuildServerFunctionUiDraftFromChangeNode(context.changeNode);
  if (fullDraft) {
    return JSON.stringify(fullDraft, null, 2);
  }
  return scaffoldDesignerDraftJson(context);
};

/** AE-8.5 — persist builder mutations into workspace artifact store. */
export const writeBuilderWorkspaceArtifacts = (
  context: BuilderContext,
  mutationPaths: string[],
): void => {
  for (const path of mutationPaths) {
    if (path.endsWith('.metadata.json')) {
      workspaceArtifactStore.write({
        path,
        content: scaffoldMetadataJson(context),
        contentType: 'application/json',
      });
      continue;
    }

    if (path.includes('/workspace/server-functions/custom/') && path.endsWith('.ts')) {
      workspaceArtifactStore.write({
        path,
        content: scaffoldServerFunctionSource(context),
        contentType: 'text/typescript',
      });
      continue;
    }

    if (path.endsWith('/draft.json')) {
      workspaceArtifactStore.write({
        path,
        content: resolveDesignerDraftJson(context),
        contentType: 'application/json',
      });
      continue;
    }

    if (path.includes('/workspace/platform-registry/routes/') && path.endsWith('.json')) {
      workspaceArtifactStore.write({
        path,
        content: scaffoldExperienceRouteJson(context),
        contentType: 'application/json',
      });
      continue;
    }

    workspaceArtifactStore.write({
      path,
      content: `// AppEndoo workspace artifact scaffold for ${context.changeNode.operationType}\n`,
      contentType: 'text/plain',
    });
  }
};
