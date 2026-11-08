import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';

import type { ServerFunctionItem } from './types';

import {

  normalizeServerFunctionFolder,

  normalizeServerFunctionName,

} from './lib/duplicateServerFunctionIdentity';

import { isHiddenServerFunctionEditSlug as isHiddenReservedServerFunctionEditSlug } from '../../shared/api/contracts/server-functions/reservedFunctions';

import {

  buildNestedEditorEditRelativePath,

  resolveNestedEditorItemSlug,

} from '../../shared/routing/nestedEditorDeepLink';



export const SERVER_FUNCTION_LIST_SEGMENT = 'server-functions';

export const SERVER_FUNCTION_NEW_SLUG = 'new';



export function isHiddenServerFunctionEditSlug(slug: string): boolean {

  return isHiddenReservedServerFunctionEditSlug(slug);

}



export function buildServerFunctionEditSlug(

  fn: Pick<ServerFunctionItem, 'folder' | 'name'>,

): string {

  const folderSlug = normalizeServerFunctionFolder(fn.folder) || 'general';

  const nameSlug = normalizeServerFunctionName(fn.name);

  return `${folderSlug}/${nameSlug}`;

}



/** Strip mount/application prefixes and return the item slug from a server-functions URL suffix. */

export function resolveServerFunctionRouteSuffix(rawSuffix: string | undefined): string | undefined {

  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];

  if (segments.length === 0) {

    return undefined;

  }



  const routeIndex = segments.lastIndexOf(SERVER_FUNCTION_LIST_SEGMENT);

  if (routeIndex >= 0) {
    return resolveNestedEditorItemSlug(segments.slice(routeIndex + 1));
  }

  // React route splats often omit the list segment (e.g. `edit/auth/login`).
  return resolveNestedEditorItemSlug(segments);

}



export function parseServerFunctionEditSlug(rawSuffix: string | undefined): string | null {

  const routeSuffix = resolveServerFunctionRouteSuffix(rawSuffix);

  const slug = routeSuffix?.trim() ?? '';

  return slug || null;

}



export function findServerFunctionByEditSlug(

  functions: ServerFunctionItem[],

  slug: string,

): ServerFunctionItem | null {

  if (!slug || slug === SERVER_FUNCTION_NEW_SLUG) {

    return null;

  }



  const segments = slug.split('/').filter(Boolean);

  if (segments.length === 0) {

    return null;

  }



  if (segments.length === 1) {

    const byId = functions.find((fn) => fn.id === segments[0]);

    if (byId) {

      return byId;

    }



    const nameSlug = segments[0];

    return functions.find(

      (fn) => (normalizeServerFunctionFolder(fn.folder) || 'general') === 'general'

        && normalizeServerFunctionName(fn.name) === nameSlug,

    ) ?? null;

  }



  const folderSlug = segments[0];

  const nameSlug = segments.slice(1).join('/');



  return functions.find(

    (fn) => (normalizeServerFunctionFolder(fn.folder) || 'general') === folderSlug

      && normalizeServerFunctionName(fn.name) === nameSlug,

  ) ?? null;

}



export function buildServerFunctionListRelativePath(

  mountId: string = STUDIO_MOUNT_ID,

): string {

  if (mountId === STUDIO_MOUNT_ID) {

    return SERVER_FUNCTION_LIST_SEGMENT;

  }



  return toPortalRoutePattern(SERVER_FUNCTION_LIST_SEGMENT);

}



export function buildServerFunctionEditRelativePath(

  fn: Pick<ServerFunctionItem, 'folder' | 'name'>,

  mountId: string = STUDIO_MOUNT_ID,

): string {

  const editPath = buildNestedEditorEditRelativePath(

    SERVER_FUNCTION_LIST_SEGMENT,

    buildServerFunctionEditSlug(fn),

  );

  if (mountId === STUDIO_MOUNT_ID) {

    return editPath;

  }



  return toPortalRoutePattern(editPath);

}



export function buildServerFunctionNewRelativePath(

  mountId: string = STUDIO_MOUNT_ID,

): string {

  const newPath = buildNestedEditorEditRelativePath(

    SERVER_FUNCTION_LIST_SEGMENT,

    SERVER_FUNCTION_NEW_SLUG,

  );

  if (mountId === STUDIO_MOUNT_ID) {

    return newPath;

  }



  return toPortalRoutePattern(newPath);

}



function decodeServerFunctionEditSlugSegment(segment: string): string {

  try {

    return decodeURIComponent(segment);

  } catch {

    return segment;

  }

}



/** Best-effort display label from an edit URL slug before the catalog finishes loading. */

export function resolveServerFunctionItemLabelFromEditSlug(editSlug: string): string {

  if (editSlug === SERVER_FUNCTION_NEW_SLUG) {

    return 'Untitled function';

  }



  const segments = editSlug.split('/').filter(Boolean);

  if (segments.length === 0) {

    return 'Untitled function';

  }



  return decodeServerFunctionEditSlugSegment(segments[segments.length - 1] ?? '');

}


