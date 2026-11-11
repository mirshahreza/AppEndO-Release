import type { CatalogInteractionState } from './catalogInteractionState';
import {
  HWY_MEMBER_FACE_SUBTLE_ACTIVE_APPLIED_CLASS,
  HWY_MEMBER_FACE_SUBTLE_HOVER_APPLIED_CLASS,
} from '../hwy/hwyMemberFaceInteraction';

/** Forced member-face chrome — must match production hover/active pseudo. */
export function catalogFaceAppliedStateClass(state: CatalogInteractionState | undefined): string {
  if (state === 'hover') {
    return HWY_MEMBER_FACE_SUBTLE_HOVER_APPLIED_CLASS;
  }
  if (state === 'active') {
    return HWY_MEMBER_FACE_SUBTLE_ACTIVE_APPLIED_CLASS;
  }
  return '';
}

/** Sky text links (electoral path segments, targhin view-full). */
export function catalogTextLinkSkyAppliedStateClass(state: CatalogInteractionState | undefined): string {
  if (state === 'hover') {
    return 'text-sky-700 underline';
  }
  if (state === 'active') {
    return 'text-sky-800 underline';
  }
  return '';
}

/** Primary inline links (targhin nego thread). */
export function catalogTextLinkPrimaryAppliedStateClass(state: CatalogInteractionState | undefined): string {
  if (state === 'hover') {
    return 'text-primary-800 underline';
  }
  if (state === 'active') {
    return 'text-primary-900 underline';
  }
  return '';
}

/** Legacy filter row clear (×) icon buttons. */
export function catalogFilterClearAppliedStateClass(state: CatalogInteractionState | undefined): string {
  if (state === 'hover') {
    return 'text-cyan-700';
  }
  if (state === 'active') {
    return 'text-cyan-800';
  }
  return '';
}

/** Toolbar filter toggle (`toggle-on` — catalog specimen uses active=true). */
export function catalogAppButtonSoftCyanAppliedStateClass(state: CatalogInteractionState | undefined): string {
  if (state === 'hover') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  }
  if (state === 'active') {
    return 'border-cyan-300 bg-cyan-100 text-cyan-800';
  }
  return '';
}

/** Toolbar filter toggle (`toggle-off`). */
export function catalogAppButtonSoftIndigoAppliedStateClass(state: CatalogInteractionState | undefined): string {
  if (state === 'hover') {
    return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  }
  if (state === 'active') {
    return 'border-indigo-300 bg-indigo-100 text-indigo-800';
  }
  return '';
}
