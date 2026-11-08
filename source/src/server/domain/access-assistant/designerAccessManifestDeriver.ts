import { getDesignerDraft, listDesignerDrafts } from '../component-designer/draftIo';
import { parsePinnedDesignerLoaderRef } from '../../../domain/component-designer/publishLoaderRef';
import type { AccessAssistantPageManifest } from '../../../shared/api/contracts/access-assistant/types';
import type { PlatformPageModule } from '../../../shared/api/contracts/platform/types';

const resolveDraftIdFromLoaderRef = (loaderRef: string): string | null => {
  const { componentPath } = parsePinnedDesignerLoaderRef(loaderRef);
  const segments = componentPath.split('/').filter(Boolean);
  if (segments.length < 2) {
    return null;
  }
  const name = segments[segments.length - 1];
  const folder = segments.slice(0, -1).join('/');
  const match = listDesignerDrafts().find(
    (draft) => draft.folder === folder && draft.name === name,
  );
  return match?.id ?? null;
};

export function deriveDesignerAccessManifest(
  pageModule: PlatformPageModule,
  catalogFunctionIds: string[],
): AccessAssistantPageManifest | null {
  const loaderRef = pageModule.loaderRef?.trim();
  if (!loaderRef) {
    return null;
  }

  const draftId = resolveDraftIdFromLoaderRef(loaderRef);
  if (!draftId) {
    return null;
  }

  const draft = getDesignerDraft(draftId);
  if (!draft) {
    return null;
  }

  const corpus = `${JSON.stringify(draft.document)}\n${JSON.stringify(draft.bindingDefinitions ?? {})}`;
  const functionIds = catalogFunctionIds.filter((id) => corpus.includes(id));

  if (functionIds.length === 0) {
    return null;
  }

  return {
    pageKey: pageModule.pageKey,
    root: {
      surfaceId: `${pageModule.pageKey}-root`,
      title: pageModule.title || pageModule.pageKey,
      functionIds,
    },
    linkedSurfaces: [],
  };
}
