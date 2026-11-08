import type * as React from 'react';
import type { DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import type { ShellBackdropTreatment } from '../../api/contracts/shell-designer';
import { shellBackdropStyle } from './shellVisualOptions';

export type ShellLayoutWidth = 'fluid' | 'bounded';
export type ShellBoundedEdge = 'hairline' | 'shadow' | 'outset';
export type ShellBoundedMaxWidth = 'sm' | 'md' | 'lg';

export const SHELL_LAYOUT_WIDTH_DEFAULT: ShellLayoutWidth = 'fluid';
export const SHELL_BOUNDED_MAX_WIDTH_DEFAULT: ShellBoundedMaxWidth = 'lg';
export const SHELL_BOUNDED_MAX_WIDTH_CLASS: Record<ShellBoundedMaxWidth, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
};
/** Bounded column horizontal inset — flush at every tier (page toolbars keep their own px). */
export const SHELL_BOUNDED_HORIZONTAL_PAD_CLASS = 'px-0';

export const SHELL_BOUNDED_EDGE_CLASS: Record<ShellBoundedEdge, string> = {
  hairline:
    'shadow-[0_0_0_1px_color-mix(in_srgb,hsl(var(--heroui-divider))_78%,transparent)]',
  shadow: 'shadow-xl shadow-slate-900/12',
  outset:
    'shadow-[0_0_0_1px_color-mix(in_srgb,hsl(var(--heroui-divider))_82%,transparent),0_20px_50px_-28px_rgba(15,23,42,0.35)]',
};

export function shellBoundedChromeBaseClass(boundedMaxWidth: ShellBoundedMaxWidth = SHELL_BOUNDED_MAX_WIDTH_DEFAULT): string {
  return [
    'mx-auto flex w-full min-h-0 min-w-0 flex-1 flex-col',
    SHELL_BOUNDED_MAX_WIDTH_CLASS[boundedMaxWidth],
    SHELL_BOUNDED_HORIZONTAL_PAD_CLASS,
  ].join(' ');
}

export function isShellBoundedMaxWidth(value: unknown): value is ShellBoundedMaxWidth {
  return value === 'sm' || value === 'md' || value === 'lg';
}

export function isShellLayoutWidth(value: unknown): value is ShellLayoutWidth {
  return value === 'fluid' || value === 'bounded';
}

export function findShellFrameNode(document: DesignerDocument): DesignerNode | undefined {
  return Object.values(document.nodes).find(
    (node) => node.componentRef?.refType === 'system' && node.componentRef.refId === 'ShellFrame',
  );
}

export function documentUsesShellFrame(document: DesignerDocument): boolean {
  return Boolean(findShellFrameNode(document));
}

export function readShellLayoutWidthUserControl(document: DesignerDocument): boolean {
  const metadata = document.metadata.shellLayoutWidthUserControl;
  if (metadata === false) {
    return false;
  }
  if (metadata === true) {
    return true;
  }
  const recipe = document.metadata.shellDesigner?.recipe?.visual?.layoutWidthUserControl;
  if (recipe === false) {
    return false;
  }
  if (recipe === true) {
    return true;
  }
  return readShellLayoutWidth(document) === 'bounded';
}

export function readShellLayoutWidth(document: DesignerDocument): ShellLayoutWidth {
  const metadataWidth = document.metadata.shellLayoutWidth;
  if (isShellLayoutWidth(metadataWidth)) {
    return metadataWidth;
  }
  const recipeWidth = document.metadata.shellDesigner?.recipe?.visual?.layoutWidth;
  if (isShellLayoutWidth(recipeWidth)) {
    return recipeWidth;
  }
  const frameWidth = findShellFrameNode(document)?.props?.layoutWidth;
  if (isShellLayoutWidth(frameWidth)) {
    return frameWidth;
  }
  return SHELL_LAYOUT_WIDTH_DEFAULT;
}

export function readShellBoundedMaxWidth(document: DesignerDocument): ShellBoundedMaxWidth {
  const metadataMax = document.metadata.shellBoundedMaxWidth;
  if (isShellBoundedMaxWidth(metadataMax)) {
    return metadataMax;
  }
  const recipeMax = document.metadata.shellDesigner?.recipe?.visual?.boundedMaxWidth;
  if (isShellBoundedMaxWidth(recipeMax)) {
    return recipeMax;
  }
  const frameMax = findShellFrameNode(document)?.props?.boundedMaxWidth;
  if (isShellBoundedMaxWidth(frameMax)) {
    return frameMax;
  }
  return SHELL_BOUNDED_MAX_WIDTH_DEFAULT;
}

export function readShellBoundedEdge(document: DesignerDocument): ShellBoundedEdge {
  const metadataEdge = document.metadata.shellBoundedEdge;
  if (metadataEdge === 'hairline' || metadataEdge === 'shadow' || metadataEdge === 'outset') {
    return metadataEdge;
  }
  const recipeEdge = document.metadata.shellDesigner?.recipe?.visual?.boundedEdge;
  if (recipeEdge === 'hairline' || recipeEdge === 'shadow' || recipeEdge === 'outset') {
    return recipeEdge;
  }
  const frameEdge = findShellFrameNode(document)?.props?.boundedEdge;
  if (frameEdge === 'hairline' || frameEdge === 'shadow' || frameEdge === 'outset') {
    return frameEdge;
  }
  return 'outset';
}

function readBackdropTreatment(document: DesignerDocument): ShellBackdropTreatment | undefined {
  const frame = findShellFrameNode(document);
  const frameBackdrop = frame?.props?.backdrop;
  if (frameBackdrop && typeof frameBackdrop === 'object' && !Array.isArray(frameBackdrop)) {
    return frameBackdrop as ShellBackdropTreatment;
  }
  return document.metadata.shellDesigner?.recipe?.visual?.backdrop;
}

export function resolveShellLayoutBackdropStyle(document: DesignerDocument): React.CSSProperties {
  return shellBackdropStyle(readBackdropTreatment(document));
}
