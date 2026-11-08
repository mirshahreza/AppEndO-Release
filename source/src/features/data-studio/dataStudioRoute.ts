import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';
import type { EdgeModelDefinition } from '../../shared/api/contracts/data-api';
import {
  buildNestedEditorEditRelativePath,
  NESTED_EDITOR_EDIT_SEGMENT,
  resolveNestedEditorItemSlug,
} from '../../shared/routing/nestedEditorDeepLink';

export const DATA_STUDIO_LIST_SEGMENT = 'data-studio';

const decodeSlug = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/** Canonical modeler slug = database object name (URL: `/data-studio/edit/{objectName}`). */
export function buildDataStudioModelerEditSlug(
  model: Pick<EdgeModelDefinition, 'objectName'>,
): string {
  return model.objectName.trim();
}

/**
 * Segments after `data-studio` → object-name slug.
 * Canonical: `edit/{objectName}`.
 * Legacy (parse-only / canonicalize): `{objectName}` or `edit/{modelId}`.
 */
export function resolveDataStudioRouteSuffix(rawSuffix: string | undefined): string | undefined {
  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];
  if (segments.length === 0) {
    return undefined;
  }

  const listIndex = segments.lastIndexOf(DATA_STUDIO_LIST_SEGMENT);
  const segmentsAfterList = listIndex >= 0
    ? segments.slice(listIndex + 1)
    : segments;

  if (segmentsAfterList.length === 0) {
    return undefined;
  }

  const nestedSlug = resolveNestedEditorItemSlug(segmentsAfterList);
  if (nestedSlug) {
    return nestedSlug;
  }

  // Legacy bookmark without `edit`: single objectName segment
  if (segmentsAfterList.length === 1 && segmentsAfterList[0] !== NESTED_EDITOR_EDIT_SEGMENT) {
    return segmentsAfterList[0];
  }

  return undefined;
}

export function parseDataStudioModelerEditSlug(rawSuffix: string | undefined): string | null {
  const routeSuffix = resolveDataStudioRouteSuffix(rawSuffix);
  const slug = routeSuffix?.trim() ?? '';
  return slug || null;
}

export function parseDataStudioModelerEditSlugFromPathname(pathname: string): string | null {
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const listIndex = segments.lastIndexOf(DATA_STUDIO_LIST_SEGMENT);
  if (listIndex < 0) {
    return null;
  }

  return parseDataStudioModelerEditSlug(segments.slice(listIndex + 1).join('/'));
}

export function findEdgeModelByEditSlug(
  models: EdgeModelDefinition[],
  editSlug: string,
  options?: { preferredDataSourceId?: string | null },
): EdgeModelDefinition | undefined {
  const decoded = decodeSlug(editSlug).trim();
  if (!decoded) {
    return undefined;
  }

  const pickPreferred = (candidates: EdgeModelDefinition[]): EdgeModelDefinition | undefined => {
    if (candidates.length === 0) {
      return undefined;
    }
    if (candidates.length === 1) {
      return candidates[0];
    }

    const preferredDataSourceId = options?.preferredDataSourceId?.trim();
    if (preferredDataSourceId) {
      const preferred = candidates.find((model) => model.dataSourceId === preferredDataSourceId);
      if (preferred) {
        return preferred;
      }
    }

    return candidates.find((model) => model.objectType === 'TABLE') ?? candidates[0];
  };

  const byObjectName = pickPreferred(
    models.filter((model) => model.objectName === decoded),
  );
  if (byObjectName) {
    return byObjectName;
  }

  const byObjectNameInsensitive = pickPreferred(
    models.filter((model) => model.objectName.toLowerCase() === decoded.toLowerCase()),
  );
  if (byObjectNameInsensitive) {
    return byObjectNameInsensitive;
  }

  // Legacy bookmark: slug was Edge model id under …/edit/{id}
  return models.find((model) => model.id === decoded);
}

export function resolveDataStudioModelerItemLabelFromEditSlug(editSlug: string): string {
  const decoded = decodeSlug(editSlug).trim();
  return decoded || 'Model';
}

export function buildDataStudioListRelativePath(mountId: string = STUDIO_MOUNT_ID): string {
  if (mountId === STUDIO_MOUNT_ID) {
    return DATA_STUDIO_LIST_SEGMENT;
  }

  return toPortalRoutePattern(DATA_STUDIO_LIST_SEGMENT);
}

export function buildDataStudioModelerEditRelativePath(
  model: Pick<EdgeModelDefinition, 'objectName'>,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  const editPath = buildNestedEditorEditRelativePath(
    DATA_STUDIO_LIST_SEGMENT,
    buildDataStudioModelerEditSlug(model),
  );

  if (mountId === STUDIO_MOUNT_ID) {
    return editPath;
  }

  return toPortalRoutePattern(editPath);
}
