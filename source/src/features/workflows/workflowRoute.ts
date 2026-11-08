import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';
import type { WorkflowDefinitionSummary } from './types';
import {
  buildNestedEditorEditRelativePath,
  NESTED_EDITOR_EDIT_SEGMENT,
  resolveNestedEditorItemSlug,
} from '../../shared/routing/nestedEditorDeepLink';

export const WORKFLOW_LIST_SEGMENT = 'workflows';

export function buildWorkflowEditSlug(
  definition: Pick<WorkflowDefinitionSummary, 'key'>,
): string {
  return definition.key;
}

/** Strip mount/application prefixes and return the workflow key from a workflows edit URL suffix. */
export function resolveWorkflowRouteSuffix(rawSuffix: string | undefined): string | undefined {
  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];
  if (segments.length === 0) {
    return undefined;
  }

  const listIndex = segments.lastIndexOf(WORKFLOW_LIST_SEGMENT);
  const segmentsAfterList = listIndex >= 0
    ? segments.slice(listIndex + 1)
    : segments;

  return resolveNestedEditorItemSlug(segmentsAfterList);
}

export function parseWorkflowEditSlug(rawSuffix: string | undefined): string | null {
  const routeSuffix = resolveWorkflowRouteSuffix(rawSuffix);
  const slug = routeSuffix?.trim() ?? '';
  return slug || null;
}

/** Parse a designer edit slug from a full browser pathname (culture + portal aware). */
export function parseWorkflowEditSlugFromPathname(pathname: string): string | null {
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const listIndex = segments.lastIndexOf(WORKFLOW_LIST_SEGMENT);
  if (listIndex < 0) {
    return null;
  }

  const slug = resolveNestedEditorItemSlug(segments.slice(listIndex + 1));
  return slug?.trim() || null;
}

function decodeWorkflowEditSlugSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Best-effort workflow label from an edit URL slug before definitions finish loading. */
export function resolveWorkflowItemLabelFromEditSlug(editSlug: string): string {
  const segments = editSlug.split('/').filter(Boolean);
  if (segments.length === 0) {
    return 'Untitled workflow';
  }

  return decodeWorkflowEditSlugSegment(segments[segments.length - 1] ?? '');
}

function decodeWorkflowEditSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function findWorkflowByEditSlug(
  definitions: WorkflowDefinitionSummary[],
  slug: string,
): WorkflowDefinitionSummary | null {
  if (!slug) {
    return null;
  }

  const decodedSlug = decodeWorkflowEditSlug(slug);

  if (/^\d+$/.test(decodedSlug)) {
    const byId = definitions.find((definition) => definition.id === Number(decodedSlug));
    if (byId) {
      return byId;
    }
  }

  return definitions.find((definition) => definition.key === decodedSlug) ?? null;
}

export function buildWorkflowListRelativePath(
  mountId: string = STUDIO_MOUNT_ID,
): string {
  if (mountId === STUDIO_MOUNT_ID) {
    return WORKFLOW_LIST_SEGMENT;
  }

  return toPortalRoutePattern(WORKFLOW_LIST_SEGMENT);
}

export function buildWorkflowEditRelativePath(
  definition: Pick<WorkflowDefinitionSummary, 'key'>,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  const editPath = buildNestedEditorEditRelativePath(
    WORKFLOW_LIST_SEGMENT,
    encodeURIComponent(definition.key),
  );
  if (mountId === STUDIO_MOUNT_ID) {
    return editPath;
  }

  return toPortalRoutePattern(editPath);
}

/** True when a pathname opens the workflow list (not the designer editor). */
export function isWorkflowListPathname(pathname: string): boolean {
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const workflowsIndex = segments.lastIndexOf(WORKFLOW_LIST_SEGMENT);
  if (workflowsIndex < 0) {
    return false;
  }

  return segments.slice(workflowsIndex + 1).length === 0;
}

/** True when a pathname opens a workflow in the designer editor. */
export function isWorkflowDesignerPathname(pathname: string): boolean {
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const workflowsIndex = segments.lastIndexOf(WORKFLOW_LIST_SEGMENT);
  if (workflowsIndex < 0) {
    return false;
  }

  return resolveNestedEditorItemSlug(segments.slice(workflowsIndex + 1)) !== undefined;
}

/** Map a workflows list nav path to its designer editor prefix. */
export function workflowDesignerNavPathFromListPath(workflowsNavPath: string): string {
  const editSuffix = `${WORKFLOW_LIST_SEGMENT}/${NESTED_EDITOR_EDIT_SEGMENT}`;

  if (workflowsNavPath.endsWith(`/${WORKFLOW_LIST_SEGMENT}`)) {
    return `${workflowsNavPath.slice(0, -(WORKFLOW_LIST_SEGMENT.length + 1))}/${editSuffix}`;
  }

  if (workflowsNavPath === `/${WORKFLOW_LIST_SEGMENT}` || workflowsNavPath === WORKFLOW_LIST_SEGMENT) {
    return `/${editSuffix}`;
  }

  return workflowsNavPath.replace(
    new RegExp(`/${WORKFLOW_LIST_SEGMENT}$`),
    `/${editSuffix}`,
  );
}

export function pathnameMatchesWorkflowDesignerNavPath(pathname: string, workflowsNavPath: string): boolean {
  const designerNavPath = workflowDesignerNavPathFromListPath(workflowsNavPath);
  return pathname === designerNavPath || pathname.startsWith(`${designerNavPath}/`);
}
