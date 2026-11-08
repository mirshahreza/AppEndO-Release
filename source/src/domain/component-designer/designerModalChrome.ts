/**
 * Designer `heroui.modal` / `heroui.alert-dialog` chrome — mirrors Base Components
 * Dialog / CreateEditModalShell / ConfirmDialogShell tokens so published Client Components
 * match Studio admin dialogs visually.
 */

import React from 'react';
import { cn } from '../../lib/utils';
import {
  BUTTON_INTENT_CLASS,
  BUTTON_SM_BASE_CLASS,
} from '../../shared/ui/buttonSemantics';
import {
  CREATE_EDIT_MODAL_SHELL_CLASS,
  CREATE_EDIT_MODAL_SIZE_CLASS,
  DIALOG_FOOTER_SURFACE_BG_CLASS,
  DIALOG_PRIMARY_HEADER_DANGER_CLASS,
  DIALOG_PRIMARY_HEADER_DANGER_TITLE_CLASS,
  DIALOG_PRIMARY_HEADER_LAYOUT_CLASS,
  DIALOG_PRIMARY_HEADER_TITLE_CLASS,
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_CANCEL_CLASS,
  type CreateEditModalSize,
} from '../../shared/ui/surfaceClasses';
import type { DesignerNode } from './types';

/** Shell on Modal.Dialog — same tokens as CreateEditModalShell (incl. p-[15px]). */
export const DESIGNER_MODAL_DIALOG_SHELL_CLASS = CREATE_EDIT_MODAL_SHELL_CLASS;

/** Default (transactional) primary header — edge-aligned via shell padding + negative margins. */
export const DESIGNER_MODAL_HEADER_CLASS =
  `${DIALOG_PRIMARY_HEADER_LAYOUT_CLASS} border-b border-slate-200 bg-slate-50/80`;

/** Danger header for destructive alert-dialogs. */
export const DESIGNER_MODAL_HEADER_DANGER_CLASS = DIALOG_PRIMARY_HEADER_DANGER_CLASS;

export const DESIGNER_MODAL_TITLE_CLASS = DIALOG_PRIMARY_HEADER_TITLE_CLASS;

export const DESIGNER_MODAL_TITLE_DANGER_CLASS = DIALOG_PRIMARY_HEADER_DANGER_TITLE_CLASS;

/** Matches AppButton `closeIcon` (icon-sm + cancel hue). */
export const DESIGNER_MODAL_CLOSE_BUTTON_CLASS =
  `${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_CANCEL_CLASS} rounded p-1`;

/** Modal.Body — edge-aligned under shell padding; children own field/footer padding. */
export const DESIGNER_MODAL_BODY_CLASS = '-mx-[15px] flex min-h-0 flex-1 flex-col overflow-hidden p-0';

/**
 * Body inner override when hosting Designer form chrome inside CreateEditModalShell /
 * ConfirmDialogShell — form fields + message nodes own their p-[15px]. Do not set
 * `!min-h-0` alone here: with shell `overflow-hidden` that collapses body+footer to a
 * header-only strip. Maximized / full grid hosts use
 * `DESIGNER_MODAL_SHELL_BODY_INNER_FILL_CLASS` instead (flex chain to pin paging footers).
 */
export const DESIGNER_MODAL_SHELL_BODY_INNER_CLASS = '!p-0';

/**
 * Maximized / full Designer modal body — grow to shell height so nested AppTableGrid
 * paging footers stick to the bottom (ui-dialog §Create/Edit modals with a flex-growing body).
 */
export const DESIGNER_MODAL_SHELL_BODY_INNER_FILL_CLASS =
  'flex h-full min-h-0 flex-1 flex-col overflow-hidden !p-0';

/** Body-only Designer modals consume the shell's bottom inset; their content owns its footer chrome. */
export const DESIGNER_MODAL_SHELL_BODY_OUTER_FLUSH_CLASS = '-mb-[15px]';

/**
 * Maximized / full body-only outer slot — flush bottom inset + bounded flex column so the
 * grid fills and GridPagingFooter does not float under short content.
 */
export const DESIGNER_MODAL_SHELL_BODY_OUTER_FILL_FLUSH_CLASS =
  '-mb-[15px] flex min-h-0 flex-1 flex-col !overflow-hidden';

/** Maximized / full outer when an action footer is also present. */
export const DESIGNER_MODAL_SHELL_BODY_OUTER_FILL_CLASS =
  'flex min-h-0 flex-1 flex-col !overflow-hidden';

/** Designer form bodies own their bottom padding, so the lifted footer must not add another gap. */
export const DESIGNER_MODAL_SHELL_FOOTER_CLASS = '!mt-0';

/** Modal form body slot — white inset matching CreateEditModalShell / records CRUD overlays. */
export const DESIGNER_MODAL_FORM_BODY_CONTENT_CLASS =
  'flex min-w-0 flex-col gap-2 bg-white p-[15px]';

/** Action footer band inside form/confirm overlays (when nested under Modal.Body). */
export const DESIGNER_DIALOG_FOOTER_CLASS =
  `-mb-[15px] flex w-full shrink-0 items-center justify-end gap-2 border-t border-slate-100 ${DIALOG_FOOTER_SURFACE_BG_CLASS} px-[15px] py-2`;

/**
 * Button row only — use when the host is CreateEditModalShell / ConfirmDialogShell
 * `footer` (DialogFooter already supplies band / edge alignment).
 */
export const DESIGNER_DIALOG_FOOTER_ACTIONS_CLASS =
  'flex w-full shrink-0 items-center justify-end gap-2';

/** True when a node is the records/CRUD action footer band (Cancel/Save row). */
export const isDesignerDialogActionFooterNode = (node: DesignerNode | null | undefined): boolean => {
  if (!node) {
    return false;
  }
  const className = typeof node.props.className === 'string' ? node.props.className : '';
  if (!className.includes('justify-end')) {
    return false;
  }
  return className.includes(DIALOG_FOOTER_SURFACE_BG_CLASS)
    || className.includes('-mb-[15px]')
    || className.includes(DESIGNER_DIALOG_FOOTER_ACTIONS_CLASS);
};

/**
 * Peel CRUD Cancel/Save (or confirm) footer into shell `footer` so DialogFooter
 * edge-aligns and short confirms do not scroll header+footer together.
 */
/**
 * Preview runtime wraps each overlay child in `React.Fragment` (keyed). When the action
 * footer is lifted into ConfirmDialogShell / CreateEditModalShell `footer`, merge the
 * actions-row class onto a real element — never `cloneElement` onto a Fragment.
 */
export const liftDesignerDialogFooterElement = (
  footerElement: React.ReactNode,
): React.ReactNode => {
  if (!React.isValidElement(footerElement)) {
    return footerElement;
  }

  const footerProps = footerElement.props as { className?: string; children?: React.ReactNode };
  const mergedClassName = cn(DESIGNER_DIALOG_FOOTER_ACTIONS_CLASS, footerProps.className);

  if (footerElement.type === React.Fragment) {
    return React.createElement('div', { className: mergedClassName }, footerProps.children);
  }

  return React.cloneElement(footerElement as React.ReactElement<{ className?: string }>, {
    className: mergedClassName,
  });
};

export const partitionDesignerOverlayChildIds = (
  childIds: readonly string[],
  nodes: Record<string, DesignerNode>,
): { bodyIds: string[]; footerId: string | undefined } => {
  if (childIds.length === 0) {
    return { bodyIds: [], footerId: undefined };
  }
  const lastId = childIds[childIds.length - 1]!;
  if (!isDesignerDialogActionFooterNode(nodes[lastId])) {
    return { bodyIds: [...childIds], footerId: undefined };
  }
  return { bodyIds: childIds.slice(0, -1), footerId: lastId };
};

export const DESIGNER_DIALOG_CANCEL_BUTTON_CLASS =
  `${BUTTON_SM_BASE_CLASS} ${BUTTON_INTENT_CLASS.cancel}`;

export const DESIGNER_DIALOG_PRIMARY_BUTTON_CLASS =
  `${BUTTON_SM_BASE_CLASS} ${BUTTON_INTENT_CLASS.primary}`;

export const DESIGNER_DIALOG_CREATE_BUTTON_CLASS =
  `${BUTTON_SM_BASE_CLASS} ${BUTTON_INTENT_CLASS.create}`;

export const DESIGNER_DIALOG_DESTRUCTIVE_BUTTON_CLASS =
  `${BUTTON_SM_BASE_CLASS} ${BUTTON_INTENT_CLASS.destructive}`;

export const DESIGNER_DIALOG_CONFIRM_BUTTON_CLASS =
  `${BUTTON_SM_BASE_CLASS} ${BUTTON_INTENT_CLASS.confirm}`;

export type DesignerModalHeaderTone = 'default' | 'danger';

const CREATE_EDIT_SIZE_VALUES = new Set<string>(Object.keys(CREATE_EDIT_MODAL_SIZE_CLASS));

/** Map Designer/HeroUI size prop onto CreateEditModalShell size tokens. */
export const resolveDesignerCreateEditModalSize = (
  sizeProp: unknown,
  fallback: CreateEditModalSize = 'lg',
): CreateEditModalSize => {
  if (typeof sizeProp === 'string' && CREATE_EDIT_SIZE_VALUES.has(sizeProp)) {
    return sizeProp as CreateEditModalSize;
  }
  if (sizeProp === 'xs') {
    return 'sm';
  }
  return fallback;
};

/** Tall shells that must stretch nested grids to the paging footer. */
export const isDesignerModalFillSize = (size: CreateEditModalSize): boolean => (
  size === 'maximized' || size === 'full'
);

export const resolveDesignerModalShellBodyClassNames = (input: {
  size: CreateEditModalSize;
  hasActionFooter: boolean;
}): { bodyOuterClassName?: string; bodyClassName: string } => {
  if (isDesignerModalFillSize(input.size)) {
    return {
      bodyOuterClassName: input.hasActionFooter
        ? DESIGNER_MODAL_SHELL_BODY_OUTER_FILL_CLASS
        : DESIGNER_MODAL_SHELL_BODY_OUTER_FILL_FLUSH_CLASS,
      bodyClassName: DESIGNER_MODAL_SHELL_BODY_INNER_FILL_CLASS,
    };
  }
  return {
    bodyOuterClassName: input.hasActionFooter
      ? undefined
      : DESIGNER_MODAL_SHELL_BODY_OUTER_FLUSH_CLASS,
    bodyClassName: DESIGNER_MODAL_SHELL_BODY_INNER_CLASS,
  };
};

export const resolveDesignerModalHeaderTone = (
  paletteItemId: string,
  toneProp: unknown,
): DesignerModalHeaderTone => {
  if (toneProp === 'default' || toneProp === 'danger') {
    return toneProp;
  }
  return paletteItemId === 'heroui.alert-dialog' ? 'danger' : 'default';
};

export const resolveDesignerModalHeaderClassName = (tone: DesignerModalHeaderTone): string => (
  tone === 'danger' ? DESIGNER_MODAL_HEADER_DANGER_CLASS : DESIGNER_MODAL_HEADER_CLASS
);

export const resolveDesignerModalTitleClassName = (tone: DesignerModalHeaderTone): string => (
  tone === 'danger' ? DESIGNER_MODAL_TITLE_DANGER_CLASS : DESIGNER_MODAL_TITLE_CLASS
);

/**
 * Merge author className onto the standard shell. Width/size utilities from builders
 * are dropped — size comes from CreateEditModalShell tokens.
 */
export const mergeDesignerModalDialogClassName = (
  authorClassName?: string,
  sizeProp?: unknown,
): string => {
  const sizeClass = CREATE_EDIT_MODAL_SIZE_CLASS[
    resolveDesignerCreateEditModalSize(sizeProp, 'lg')
  ];
  const author = (authorClassName ?? '').trim();
  if (!author) {
    return `${DESIGNER_MODAL_DIALOG_SHELL_CLASS} ${sizeClass}`;
  }
  const stripped = author
    .split(/\s+/)
    .filter((token) => {
      if (!token) return false;
      if (token === 'shadow-xl' || token === 'shadow-2xl' || token === 'shadow-lg') return false;
      if (token === 'rounded-xl' || token === 'bg-white' || token === 'overflow-hidden') return false;
      if (token.startsWith('border') || token.startsWith('p-') || token.startsWith('p[')) return false;
      if (token.startsWith('bg-amber') || token.startsWith('text-amber') || token.startsWith('bg-rose')) return false;
      if (token === 'w-full' || token.startsWith('max-w-') || token.startsWith('max-h-')) return false;
      return true;
    })
    .join(' ');
  return stripped
    ? `${DESIGNER_MODAL_DIALOG_SHELL_CLASS} ${sizeClass} ${stripped}`
    : `${DESIGNER_MODAL_DIALOG_SHELL_CLASS} ${sizeClass}`;
};
