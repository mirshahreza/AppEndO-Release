import type { DesignerHandoffPayload } from '../../../shared/api/contracts/ai/agentTypes';
import {
  buildDesignerComponentPath,
  parseDesignerComponentPath,
  resolveDesignerDraftIdFromComponentPath,
  resolveExperienceManifestPageKey,
  resolveDesignerComponentLoaderRef,
  resolveStudioMountPathPrefix,
} from '../../../shared/lib/designerComponentPath';
import {
  buildComponentDesignerEditRelativePath,
  buildComponentDesignerEditRelativePathFromSlug,
  buildComponentDesignerNewRelativePath,
} from '../componentDesignerRoute';

export {
  buildDesignerComponentPath,
  parseDesignerComponentPath,
  resolveDesignerDraftIdFromComponentPath,
  resolveExperienceManifestPageKey,
  resolveDesignerComponentLoaderRef,
  resolveStudioMountPathPrefix,
};

export function buildComponentDesignerDraftUrl(
  mountPathPrefix: string,
  folder: string,
  componentName: string,
): string {
  const normalizedPrefix = mountPathPrefix.replace(/\/+$/, '') || '';
  return `${normalizedPrefix}/${buildComponentDesignerEditRelativePath({ folder, name: componentName })}`;
}

export const DESIGNER_NEW_DRAFT_PARAM = 'new';

export function isDesignerNewDraftSearchParam(value: string | null | undefined): boolean {
  return value === '1' || value === 'true';
}

export function buildComponentDesignerNewUrl(mountPathPrefix: string): string {
  const normalizedPrefix = mountPathPrefix.replace(/\/+$/, '') || '';
  return `${normalizedPrefix}/${buildComponentDesignerNewRelativePath()}`;
}

/** Deep link for AppEndoo / apply handoff into Component Designer. */
export function buildDesignerHandoffUrl(
  mountPathPrefix: string,
  handoff: Pick<DesignerHandoffPayload, 'layoutId' | 'componentPath'>,
): string {
  const normalizedPrefix = resolveStudioMountPathPrefix(mountPathPrefix).replace(/\/+$/, '') || '/studio';
  const componentPath = handoff.componentPath?.trim();
  if (componentPath) {
    return `${normalizedPrefix}/${buildComponentDesignerEditRelativePathFromSlug(componentPath)}`;
  }

  const params = new URLSearchParams();
  params.set('load', handoff.layoutId.trim());
  return `${normalizedPrefix}/client-components?${params.toString()}`;
}
