import { TYPE_CAPTION_CLASS, TYPE_PAGE_TITLE_CLASS } from './typographyRoles';

/** Hex fallback for native color inputs; matches default --app-accent-500 in index.css */
export const COLOR_PICKER_DEFAULT_HEX = '#00A28A';

/**
 * Named elevation scale (docs/standards/ui-design-system.md §5) — prefer these over picking
 * a raw `shadow-*` utility per component so layering stays consistent app-wide.
 */
export const SHADOW_FLAT = 'shadow-none';
export const SHADOW_RAISED = 'shadow-sm';
export const SHADOW_FLOATING = 'shadow-lg';
export const SHADOW_MODAL = 'shadow-2xl';

/** Modal body with soft linear gradient (no grid texture). */
export const SURFACE_MODAL_BODY_CLASS = 'bg-surface-modal-body-simple p-[15px]';

/** Hero field wrappers — default and invalid borders (UiInput, UiSelect, UiTextarea, SemVerInput, …). */
export const HEROUI_FIELD_BORDER_CLASS =
  '!border !border-[#e2e8f0] focus-within:!border-primary-500 data-[focus=true]:!border-primary-500 data-[focus-visible=true]:!border-primary-500';
export const HEROUI_FIELD_INVALID_BORDER_CLASS = '!border !border-rose-300';
/**
 * Borderless HeroUI field chrome for controls already inside a bordered/ringed nested card
 * (phase 13 border-stacking). Prefer pairing with `NESTED_LAYER_DIVIDER_CLASS` + CSS strip.
 */
export const HEROUI_FIELD_NESTED_BORDER_CLASS = '!border-0 !shadow-none';

export const resolveHeroUiFieldBorderClass = (
  isInvalid?: boolean,
  options?: { nested?: boolean },
): string => {
  if (isInvalid) return HEROUI_FIELD_INVALID_BORDER_CLASS;
  if (options?.nested) return HEROUI_FIELD_NESTED_BORDER_CLASS;
  return HEROUI_FIELD_BORDER_CLASS;
};

/**
 * Phase 13 — nested layer divider (no layout-stacking `border`).
 * Only the outermost layer of a nested group may keep a real `border`; inner layers use
 * background contrast, padding, and/or this inset `ring` (box-shadow; does not accumulate in layout).
 * Includes marker class `nested-layer-divider` for CSS field-border stripping in `index.css`.
 */
export const NESTED_LAYER_DIVIDER_CLASS =
  'nested-layer-divider ring-1 ring-inset ring-slate-200/80';

/** Create/Edit modal body slot — edge-aligned with header/footer; gradient only (no outer padding). */
export const CREATE_EDIT_MODAL_BODY_CLASS =
  'bg-surface-modal-body-simple -mx-[15px] flex-1 min-h-0 overflow-auto';

/** Inner white form host inside create/edit modal body (flush to body edges). */
export const CREATE_EDIT_MODAL_BODY_INNER_CLASS = 'bg-white w-full p-[15px] min-h-full';

/**
 * Admin dialog backdrop z-index — must sit above the docked AppEndoo panel (`z-[100]` in AppEndooPanel).
 * Nested pickers use `DIALOG_NESTED_BACKDROP_Z_CLASS` (`z-[120]`).
 */
export const DIALOG_ADMIN_BACKDROP_Z_CLASS = 'z-[110]';

/** Stacked admin dialog above an open base dialog (`DIALOG_ADMIN_BACKDROP_Z_CLASS`). */
export const DIALOG_NESTED_BACKDROP_Z_CLASS = 'z-[120]';

/** Toasts shown while an admin dialog is open — above `DIALOG_ADMIN_BACKDROP_Z_CLASS`. */
export const DIALOG_TOAST_Z_CLASS = 'z-[120]';

/** Deeply nested admin dialog (e.g. image editor opened from a nested picker). */
export const DIALOG_DEEP_NESTED_BACKDROP_Z_CLASS = 'z-[130]';

/** Create/Edit modal backdrop — centered with inset; use CREATE_EDIT_MODAL_BACKDROP_FULL_CLASS for full-screen. */
export const CREATE_EDIT_MODAL_BACKDROP_CLASS =
  'fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4';

/** Full-screen create/edit backdrop (no outer padding). */
export const CREATE_EDIT_MODAL_BACKDROP_FULL_CLASS =
  'fixed inset-0 z-[110] flex bg-slate-900/40 backdrop-blur-sm';

/** Create/Edit modal shell base — rounded, bordered; pair with CREATE_EDIT_MODAL_SIZE_CLASS. */
export const CREATE_EDIT_MODAL_SHELL_CLASS =
  'bg-white rounded-xl border border-slate-200 shadow-2xl p-[15px] flex flex-col gap-0 font-sans overflow-hidden min-h-min';

export type CreateEditModalSize =
  | 'auto'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | 'maximized'
  | 'full';

/**
 * Maximized create/edit shell — largest practical size with 16px inset on all sides (32px total).
 * Pair with `size="maximized"` on CreateEditModalShell (uses CREATE_EDIT_MODAL_BACKDROP_CLASS).
 */
export const CREATE_EDIT_MODAL_SHELL_MAXIMIZED_CLASS =
  'w-full h-[calc(100vh-32px)] max-h-[calc(100vh-32px)]';

/**
 * Flex column for Markdown / HTML / code editor dialogs.
 * Pair with `size="maximized"` — do not add `h-[85vh]` (overrides maximized height via tailwind-merge).
 */
export const CONTENT_EDITOR_DIALOG_SHELL_CLASS = 'flex min-h-0 flex-col overflow-hidden';

/** Fixed-height fill when a content editor dialog opener passes a non-maximized `size`. */
export const CONTENT_EDITOR_DIALOG_SIZED_SHELL_CLASS =
  'flex h-[85vh] max-h-[92vh] flex-col overflow-hidden';

/** Default `CreateEditModalShell` size for Markdown / HTML / code editor dialogs. */
export const CONTENT_EDITOR_DIALOG_DEFAULT_SIZE: CreateEditModalSize = 'maximized';

export const resolveContentEditorDialogShellClass = (
  size: CreateEditModalSize,
  shellClassName?: string,
): string => (
  shellClassName
    ?? (size === 'maximized' || size === 'full'
      ? CONTENT_EDITOR_DIALOG_SHELL_CLASS
      : CONTENT_EDITOR_DIALOG_SIZED_SHELL_CLASS)
);

/** Standalone maximized modal shell for custom div-based dialogs (pair with CREATE_EDIT_MODAL_BACKDROP_CLASS). */
export const MODAL_SHELL_MAXIMIZED_CLASS =
  'flex h-[calc(100vh-32px)] w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl';

/** Width/height presets for CreateEditModalShell; default opener should pass `size` or rely on `auto`. */
export const CREATE_EDIT_MODAL_SIZE_CLASS: Record<CreateEditModalSize, string> = {
  auto: 'w-auto max-w-[calc(100vw-32px)] max-h-[92vh]',
  sm: 'w-full max-w-sm max-h-[92vh]',
  md: 'w-full max-w-md max-h-[92vh]',
  lg: 'w-full max-w-lg max-h-[92vh]',
  xl: 'w-full max-w-xl max-h-[92vh]',
  '2xl': 'w-full max-w-2xl max-h-[92vh]',
  '3xl': 'w-full max-w-3xl max-h-[92vh]',
  '4xl': 'w-full max-w-4xl max-h-[92vh]',
  '5xl': 'w-full max-w-5xl max-h-[92vh]',
  maximized: CREATE_EDIT_MODAL_SHELL_MAXIMIZED_CLASS,
  full: 'w-full h-full max-h-full rounded-none border-0 shadow-2xl',
};

/** Near-fullscreen create/edit shell on phone and tablet — fixed header/footer, body scrolls. */
export const CREATE_EDIT_MODAL_PHONE_SHELL_CLASS =
  'flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col overflow-hidden rounded-none border-0 shadow-2xl';

/** Admin dialog backdrop on phone and tablet — edge-to-edge, no outer padding. */
export const CREATE_EDIT_MODAL_PHONE_BACKDROP_CLASS =
  'fixed inset-0 z-[110] flex items-stretch justify-center bg-black/50 p-0';

/** Edge-aligned create/edit modal header band. */
export const CREATE_EDIT_MODAL_HEADER_CLASS =
  '-mx-[15px] -mt-[15px] flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/80 px-[15px] py-2';

/** Canonical dialog / grid paging footer surface — slightly darker than body white. */
export const DIALOG_FOOTER_SURFACE_BG_CLASS = 'bg-slate-100/90';

/** Edge-aligned create/edit modal footer band. */
export const CREATE_EDIT_MODAL_FOOTER_CLASS =
  `-mx-[15px] -mb-[15px] mt-2 flex shrink-0 items-center gap-2 justify-end border-t border-slate-100 ${DIALOG_FOOTER_SURFACE_BG_CLASS} px-[15px] py-2`;

/** Admin dialog backdrop — lighter tint, same blur as default. */
export const DIALOG_BACKDROP_ADMIN_LIGHT_CLASS =
  'fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/25 backdrop-blur-sm p-4';

/** Admin dialog full-viewport backdrop — lighter tint. */
export const DIALOG_BACKDROP_ADMIN_LIGHT_FULL_CLASS =
  'fixed inset-0 z-[110] flex bg-slate-900/25 backdrop-blur-sm';

/** Admin dialog backdrop — default tint, reduced blur. */
export const DIALOG_BACKDROP_ADMIN_SOFT_BLUR_CLASS =
  'fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4';

/** Admin dialog full-viewport backdrop — reduced blur. */
export const DIALOG_BACKDROP_ADMIN_SOFT_BLUR_FULL_CLASS =
  'fixed inset-0 z-[110] flex bg-slate-900/40 backdrop-blur-[2px]';

export type DialogAdminBackdropProfile = 'admin' | 'adminLight' | 'adminSoftBlur';

/** Scrim darkness for div-based overlay backdrops. */
export type DialogBackdropTint = 'faint' | 'light' | 'medium';

/** Blur radius for div-based overlay backdrops. Keep light — no heavy frost. */
export type DialogBackdropBlur = 'soft' | 'default';

/** Extra see-through on the scrim layer only — never fades the dialog surface. */
export type DialogBackdropTransparency = 'opaque' | 'soft' | 'clear';

export const DIALOG_BACKDROP_TINT_CLASS: Record<DialogBackdropTint, string> = {
  faint: 'bg-slate-900/12',
  light: 'bg-slate-900/25',
  medium: 'bg-slate-900/40',
};

export const DIALOG_BACKDROP_BLUR_CLASS: Record<DialogBackdropBlur, string> = {
  soft: 'backdrop-blur-[2px]',
  default: 'backdrop-blur-[4px]',
};

export const DIALOG_BACKDROP_TRANSPARENCY_CLASS: Record<DialogBackdropTransparency, string> = {
  opaque: '',
  soft: 'opacity-70',
  clear: 'opacity-40',
};

export const DIALOG_BACKDROP_LAYOUT_CLASS =
  'fixed inset-0 z-[110] flex items-center justify-center p-4';

export const DIALOG_BACKDROP_LAYOUT_FULL_CLASS =
  'fixed inset-0 z-[110] flex';

export function resolveDialogAdminBackdropTone(
  profile: DialogAdminBackdropProfile,
): { tint: DialogBackdropTint; blur: DialogBackdropBlur } {
  switch (profile) {
    case 'adminLight':
      return { tint: 'light', blur: 'default' };
    case 'adminSoftBlur':
      return { tint: 'medium', blur: 'soft' };
    default:
      return { tint: 'medium', blur: 'default' };
  }
}

export function resolveDialogBackdropLayoutClass(fullViewport = false): string {
  return fullViewport ? DIALOG_BACKDROP_LAYOUT_FULL_CLASS : DIALOG_BACKDROP_LAYOUT_CLASS;
}

export function resolveDialogBackdropScrimClass(options: {
  tint: DialogBackdropTint;
  blur: DialogBackdropBlur;
  transparency?: DialogBackdropTransparency;
}): string {
  return [
    'pointer-events-none absolute inset-0',
    DIALOG_BACKDROP_TINT_CLASS[options.tint],
    DIALOG_BACKDROP_BLUR_CLASS[options.blur],
    DIALOG_BACKDROP_TRANSPARENCY_CLASS[options.transparency ?? 'opaque'],
  ].filter(Boolean).join(' ');
}

export function resolveDialogBackdropClass(options: {
  tint: DialogBackdropTint;
  blur: DialogBackdropBlur;
  fullViewport?: boolean;
}): string {
  return [
    resolveDialogBackdropLayoutClass(options.fullViewport),
    DIALOG_BACKDROP_TINT_CLASS[options.tint],
    DIALOG_BACKDROP_BLUR_CLASS[options.blur],
  ].join(' ');
}

export function resolveDialogAdminBackdropClass(
  profile: DialogAdminBackdropProfile,
  fullViewport: boolean,
): string {
  if (fullViewport) {
    switch (profile) {
      case 'adminLight':
        return DIALOG_BACKDROP_ADMIN_LIGHT_FULL_CLASS;
      case 'adminSoftBlur':
        return DIALOG_BACKDROP_ADMIN_SOFT_BLUR_FULL_CLASS;
      default:
        return CREATE_EDIT_MODAL_BACKDROP_FULL_CLASS;
    }
  }

  switch (profile) {
    case 'adminLight':
      return DIALOG_BACKDROP_ADMIN_LIGHT_CLASS;
    case 'adminSoftBlur':
      return DIALOG_BACKDROP_ADMIN_SOFT_BLUR_CLASS;
    default:
      return CREATE_EDIT_MODAL_BACKDROP_CLASS;
  }
}

/** Native designer dialog backdrop class (see index.css ::backdrop). */
export const DIALOG_BACKDROP_DESIGNER_CLASS = 'designer-dialog-native';

/**
 * Inline overlay host (Base Components catalog). Same designer tint/blur as
 * `.designer-dialog-native::backdrop`, positioned inside a relative ancestor.
 */
export const CONTAINED_DESIGNER_BACKDROP_CLASS =
  'absolute inset-0 z-10 flex items-center justify-center bg-slate-900/12 backdrop-blur-[4px] p-4';

/** Reposition a viewport overlay (`fixed` + `z-[110]`) inside a relative preview host. */
export function toContainedOverlayClass(className: string): string {
  return className.replaceAll('fixed', 'absolute').replaceAll('z-[110]', 'z-10');
}

/** Fixed-height primary dialog header band — layout only; pair with surface chrome header tokens. */
export const DIALOG_PRIMARY_HEADER_LAYOUT_CLASS =
  '-mx-[15px] -mt-[15px] flex min-h-10 shrink-0 items-center gap-2 px-3 py-1.5 sm:px-[15px] sm:py-0';

/** Fixed-height primary dialog header band — min height on phone for touch-friendly actions. */
export const DIALOG_PRIMARY_HEADER_CLASS =
  `${DIALOG_PRIMARY_HEADER_LAYOUT_CLASS} border-b border-border-subtle bg-surface-panel-muted`;

/** Danger/destructive confirmation header band — rose tint. */
export const DIALOG_PRIMARY_HEADER_DANGER_CLASS =
  '-mx-[15px] -mt-[15px] flex min-h-10 shrink-0 items-center gap-2 border-b border-rose-200 bg-rose-50/80 px-3 py-1.5 sm:px-[15px] sm:py-0';

export type DialogPrimaryHeaderTone = 'default' | 'danger';

/** Primary header title typography. */
export const DIALOG_PRIMARY_HEADER_TITLE_CLASS = 'min-w-0 flex-1 truncate font-bold text-sm text-slate-800';

/** Danger confirmation header title typography. */
export const DIALOG_PRIMARY_HEADER_DANGER_TITLE_CLASS =
  'min-w-0 flex-1 truncate font-bold text-sm text-rose-800';

/** Primary header trailing actions row (headerExtra + close). */
export const DIALOG_PRIMARY_HEADER_ACTIONS_CLASS = 'flex shrink-0 items-center gap-1';

/** Vertical separator between headerExtra icon actions and the close control. */
export const DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS = 'mx-[3px] h-3 border-s border-slate-200';

/** Danger header separator between headerExtra and close. */
export const DIALOG_PRIMARY_HEADER_DANGER_SEPARATOR_CLASS = 'mx-[3px] h-3 border-s border-rose-200';

export type DialogBandTone = 'muted' | 'elevated' | 'shell';

const DIALOG_BAND_LAYOUT_CLASS =
  '-mx-[15px] flex shrink-0 border-b border-border-subtle px-[15px] py-2';

/** Secondary dialog band tones — variable height; use for subtitles, step rows, enabled gates. */
export const DIALOG_BAND_CLASS: Record<DialogBandTone, string> = {
  muted: `${DIALOG_BAND_LAYOUT_CLASS} bg-surface-panel-muted`,
  elevated: `${DIALOG_BAND_LAYOUT_CLASS} border-border-divider bg-surface-elevated`,
  shell: `${DIALOG_BAND_LAYOUT_CLASS} border-border-divider bg-surface-shell`,
};

/** Dialog band layout without tone fill — pair with surface chrome headerBand tokens. */
export const DIALOG_BAND_LAYOUT_CHROME_CLASS = DIALOG_BAND_LAYOUT_CLASS;

/** Dialog body without outer gradient (wizard / pure-white body slot). */
export const DIALOG_BODY_OUTER_PLAIN_CLASS =
  'bg-white -mx-[15px] flex shrink-0 flex-col overflow-auto';

/** Scrollable body slot for tall create/edit shells (pairs with max-h on the shell). */
export const DIALOG_BODY_OUTER_SCROLL_CLASS =
  'bg-white -mx-[15px] flex flex-1 min-h-0 flex-col overflow-auto';

/** Auxiliary dialog footer — layout only; pair with surface chrome footer tokens. */
export const DIALOG_AUXILIARY_FOOTER_LAYOUT_CLASS =
  '-mx-[15px] flex shrink-0 items-center justify-between gap-2 border-t border-border-subtle px-[15px] py-2';

/** Auxiliary dialog footer — metadata / navigation between body and action footer. */
export const DIALOG_AUXILIARY_FOOTER_BASE_CLASS =
  `${DIALOG_AUXILIARY_FOOTER_LAYOUT_CLASS} ${DIALOG_FOOTER_SURFACE_BG_CLASS}`;

export const DIALOG_AUXILIARY_FOOTER_CLASS = `${DIALOG_AUXILIARY_FOOTER_BASE_CLASS} mt-2`;

/** Action dialog footer — layout only; pair with surface chrome footer tokens. */
export const DIALOG_ACTION_FOOTER_LAYOUT_CLASS =
  '-mx-[15px] -mb-[15px] flex shrink-0 items-center gap-2 justify-end border-t border-slate-100 px-[15px] py-2';

/** Action dialog footer — primary dialog buttons; must be the last footer. */
export const DIALOG_ACTION_FOOTER_BASE_CLASS =
  `${DIALOG_ACTION_FOOTER_LAYOUT_CLASS} ${DIALOG_FOOTER_SURFACE_BG_CLASS}`;

export const DIALOG_ACTION_FOOTER_CLASS = `${DIALOG_ACTION_FOOTER_BASE_CLASS} mt-2`;

/**
 * Phase 14 — StepWizardShell backdrop tint/blur aligned to DesignerDialog native `::backdrop`
 * (`rgba(15, 23, 42, 0.12)` + `blur(4px)` in `src/index.css`). Remains a div overlay because
 * merging StepWizardShell onto native `<dialog>` is out of phase-14 scope. Do not reuse
 * `CREATE_EDIT_MODAL_BACKDROP_CLASS` here (admin create/edit keeps the 40% tint).
 */
export const STEP_WIZARD_BACKDROP_CLASS =
  'fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/12 backdrop-blur-[4px] p-4';

/** Step wizard shell — fixed viewport height so step changes do not resize the dialog. */
export const STEP_WIZARD_SHELL_HEIGHT_CLASS = 'h-[85vh] max-h-[92vh]';

/** Step wizard title header — layout only; pair with surface chrome header tokens. */
export const STEP_WIZARD_TITLE_HEADER_LAYOUT_CLASS =
  '-mx-[15px] -mt-[15px] flex shrink-0 items-center justify-between px-[15px] py-2';

/** Step wizard title header — lighter theme band (title + close). */
export const STEP_WIZARD_TITLE_HEADER_CLASS =
  `${STEP_WIZARD_TITLE_HEADER_LAYOUT_CLASS} border-b border-border-subtle bg-surface-panel-muted`;

export const STEP_WIZARD_HEADER_TITLE_ROW_CLASS =
  'flex items-center justify-between w-full';

/**
 * Wizard header title ink — darkened theme, not bright `--app-accent-700`.
 * Same section-title token as nav group headers (`--app-nav-group-header-text`).
 */
export const STEP_WIZARD_HEADER_TITLE_INK_CLASS =
  'text-[color:var(--app-nav-group-header-text)]';

export const STEP_WIZARD_HEADER_TITLE_TEXT_CLASS =
  `whitespace-nowrap font-bold text-sm ${STEP_WIZARD_HEADER_TITLE_INK_CLASS}`;

/** Step wizard dossier / context band (header 2) — bleed through modal shell padding (15px). */
export const STEP_WIZARD_CONTEXT_HEADER_LAYOUT_CLASS =
  '-mx-[15px] flex min-w-0 max-w-none shrink-0 flex-col overflow-hidden px-0 py-0';

/** Step wizard steps header — layout only; pair with surface chrome headerBand tokens. */
export const STEP_WIZARD_STEPS_HEADER_LAYOUT_CLASS =
  '-mx-[15px] flex shrink-0 px-0 py-0';

/** Step wizard steps header — darker theme band with equal-width step cells. */
export const STEP_WIZARD_STEPS_HEADER_CLASS =
  `${STEP_WIZARD_STEPS_HEADER_LAYOUT_CLASS} border-b border-border-divider bg-surface-shell`;

/** Step wizard step indicator cell — flat corners (overrides global button radius). */
export const STEP_WIZARD_STEP_CELL_CLASS =
  'flex min-w-0 flex-col items-center justify-center gap-1 border-e border-border-divider px-2 py-2.5 text-center last:border-e-0 !rounded-none';

/** Step wizard description band — layout only; pair with STEP_WIZARD_DESCRIPTION_SURFACE_CLASS. */
export const STEP_WIZARD_DESCRIPTION_LAYOUT_CLASS =
  '-mx-[15px] flex shrink-0 px-[15px] py-3';

/**
 * Description band (header 3) — one shade darker than the step-indicator band.
 */
export const STEP_WIZARD_DESCRIPTION_SURFACE_CLASS =
  'border-b border-slate-200/80 bg-slate-200/50';

/** Step wizard description band — darker veil; icon + hint text. */
export const STEP_WIZARD_DESCRIPTION_CLASS =
  `${STEP_WIZARD_DESCRIPTION_LAYOUT_CLASS} ${STEP_WIZARD_DESCRIPTION_SURFACE_CLASS}`;

/** Step wizard body slot — pure white, edge-aligned with header/footer. */
export const STEP_WIZARD_BODY_CLASS =
  'bg-white -mx-[15px] flex flex-col flex-1 min-h-0 overflow-hidden';

/** Inner white step host inside step wizard body (flush to body edges). */
export const STEP_WIZARD_STEP_INNER_CLASS =
  'bg-white p-[15px] flex flex-col flex-1 min-h-0 overflow-auto';

/** Step wizard footer — layout only; pair with surface chrome footer tokens. */
export const STEP_WIZARD_FOOTER_LAYOUT_CLASS =
  '-mx-[15px] -mb-[15px] mt-2 flex shrink-0 items-center justify-between gap-2 px-[15px] py-2';

export const STEP_WIZARD_FOOTER_CLASS =
  `${STEP_WIZARD_FOOTER_LAYOUT_CLASS} border-t border-border-subtle ${DIALOG_FOOTER_SURFACE_BG_CLASS}`;

/** Ghost icon-only action button base (no border/background at rest). */
export const ICON_ACTION_BUTTON_BASE_CLASS =
  'inline-flex items-center justify-center rounded outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40';

/** Inline input / compact embed actions (fits inside h-7 fields without touching borders). */
export const ICON_ACTION_BUTTON_XS_CLASS = `${ICON_ACTION_BUTTON_BASE_CLASS} h-3 w-3 shrink-0 p-0 min-h-0 min-w-0`;

export const ICON_ACTION_BUTTON_SM_CLASS = `${ICON_ACTION_BUTTON_BASE_CLASS} h-5 w-5`;

export const ICON_ACTION_BUTTON_MD_CLASS = `${ICON_ACTION_BUTTON_BASE_CLASS} h-6 w-6`;

/** Confirm / positive action (check, save, apply). */
export const ICON_ACTION_CONFIRM_CLASS =
  'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700';

/** Cancel / close / dismiss neutral action. */
export const ICON_ACTION_CANCEL_CLASS =
  'text-slate-500 hover:bg-slate-100 hover:text-slate-700';

/** Delete / destructive action: gray at rest, rose on hover. */
export const ICON_ACTION_DELETE_CLASS =
  'text-slate-500 hover:bg-rose-50 hover:text-rose-600';

/** Edit action: gray at rest, indigo on hover. */
export const ICON_ACTION_EDIT_CLASS =
  'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600';

/** Duplicate / copy action: gray at rest, indigo on hover. */
export const ICON_ACTION_DUPLICATE_CLASS =
  'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600';

/** View / preview / auxiliary task action: gray at rest, cyan on hover. */
export const ICON_ACTION_VIEW_CLASS =
  'text-slate-500 hover:bg-cyan-50 hover:text-cyan-600';

/** Access-control editor opener (`AccessControlModal`): always-on cyan in grids and tool rows. */
export const GRID_ACTION_ACCESS_CLASS = 'text-cyan-600 hover:bg-cyan-50';

/** Allow-list server function access from Users/Roles grids. */
export const GRID_ACTION_FUNCTION_ALLOW_CLASS = 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50';

/** Unified server function access editor from Users/Roles grids. */
export const GRID_ACTION_FUNCTION_ACCESS_CLASS = 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50';

/** Deny-list server function access from Users/Roles grids. */
export const GRID_ACTION_FUNCTION_DENY_CLASS = 'text-rose-600 hover:text-rose-700 hover:bg-rose-50';

/** Admin manual password set (Users grid Change Password). */
export const GRID_ACTION_CHANGE_PASSWORD_CLASS = 'text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50';

/** Admin credential reset (Users grid Reset Password). */
export const GRID_ACTION_RESET_PASSWORD_CLASS = 'text-amber-600 hover:text-amber-700 hover:bg-amber-50';

export const FLOATING_ACTION_SEPARATOR_CLASS = 'mx-[3px] h-3 border-s border-slate-200';

export type CanvasToolbarPosition =
  | 'top-left'
  | 'top-right'
  | 'top-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center';

/** Absolute anchor for a canvas/workspace overlay toolbar group. */
export const CANVAS_TOOLBAR_ANCHOR_BASE_CLASS = 'absolute z-20 flex items-start gap-2';

/** Corner/center offsets for canvas toolbar anchors. */
export const CANVAS_TOOLBAR_ANCHOR_POSITION_CLASS: Record<CanvasToolbarPosition, string> = {
  'top-left': 'left-3 top-3 flex-col',
  'top-right': 'right-3 top-3 flex-col items-end',
  'top-center': 'left-1/2 top-3 -translate-x-1/2 flex-col items-center',
  'bottom-left': 'bottom-3 left-3 flex-col',
  'bottom-right': 'bottom-3 right-3 flex-col items-end',
  'bottom-center': 'bottom-3 left-1/2 -translate-x-1/2 flex-col items-center',
};

/** Floating toolbar group shell on canvas/workspace surfaces — bordered card with sm controls. */
export const CANVAS_TOOLBAR_GROUP_CLASS =
  'flex gap-1 rounded-md border border-slate-200 bg-white/95 p-1 shadow-sm';

/** Vertical stack layout inside a canvas toolbar group. */
export const CANVAS_TOOLBAR_GROUP_STACK_CLASS = 'flex-col';

/** Horizontal row layout inside a canvas toolbar group. */
export const CANVAS_TOOLBAR_GROUP_ROW_CLASS = 'flex-row items-center';

/** Segmented square control strip — React Flow Controls-style chrome for canvas overlays. */
export const CANVAS_SEGMENTED_CONTROL_CLASS =
  'flex overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm divide-x divide-slate-200';

/** Vertical zoom / fit cluster — gold sample is the workflow editor viewport controls. */
export const CANVAS_VIEWPORT_CONTROLS_CLASS =
  'flex flex-col overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm divide-y divide-slate-200';

/** Absolute anchor for the zoom cluster — always bottom-left. */
export const CANVAS_ZOOM_CONTROLS_ANCHOR_CLASS = 'absolute bottom-3 left-3 z-20';

/** Absolute anchor for the layout cluster — always bottom-right. */
export const CANVAS_LAYOUT_CONTROLS_ANCHOR_CLASS = 'absolute bottom-3 right-3 z-20';

/** Pan/zoom canvas host — no native scrollbars (`.ui-scroll-area-hide-thumb` beats the global `*` thumb). Pan with pointer drag. */
export const CANVAS_PAN_VIEWPORT_CLASS =
  'min-w-0 overflow-auto overscroll-none ui-scroll-area-hide-thumb';

/**
 * Design-canvas stage behind an artboard — slate well + 16px dot grid.
 * Living sample: Base Components → Canvas toolbar.
 */
export const CANVAS_STAGE_CLASS =
  'select-none bg-slate-100/80 bg-[radial-gradient(circle_at_1px_1px,#cbd5e1_1px,transparent_0)] [background-size:16px_16px]';

/** Square segment button inside {@link CANVAS_SEGMENTED_CONTROL_CLASS}. */
export const CANVAS_SEGMENTED_CONTROL_BUTTON_CLASS =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-white p-0 text-slate-700 outline-none transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';

/** Floating AppSearchBox chrome on a canvas — always top-left. */
export const CANVAS_SEARCH_BOX_CLASS =
  'min-h-8 w-[min(100%,18rem)] gap-1.5 rounded-md border border-slate-200 bg-white/95 px-2 py-0.5 shadow-sm';

/** Inline field segment inside {@link CANVAS_SEGMENTED_CONTROL_CLASS} (e.g. rename input). */
export const CANVAS_SEGMENTED_CONTROL_FIELD_CLASS =
  'flex h-6 min-w-0 flex-1 items-center bg-white px-1.5';

/** Stretch child buttons to the group width with left-aligned labels. */
export const CANVAS_TOOLBAR_GROUP_FULL_WIDTH_BUTTONS_CLASS = '[&_button]:w-full [&_button]:justify-start';

/** Left-align labels inside canvas toolbar buttons without forcing full width. */
export const CANVAS_TOOLBAR_GROUP_ALIGN_BUTTONS_CLASS = '[&_button]:justify-start';

/** Default bounds for compact toolbox floating panels (workflow palette reference). */
export const TOOLBOX_PANEL_DEFAULT_BOUNDS = {
  minWidth: 260,
  maxWidth: 480,
  minHeight: 320,
  maximizeInset: 24,
} as const;

/** Compact toolbox panel header row inside FloatingPanelShell. */
export const TOOLBOX_PANEL_HEADER_CLASS = 'h-8 px-2';

/** Toolbox panel title typography. */
export const TOOLBOX_PANEL_TITLE_CLASS = 'text-[13px] font-semibold text-slate-800';

/** Chrome that must not highlight while the user drags; inputs stay selectable. */
export const UI_CHROME_NO_SELECT_CLASS = 'select-none [&_input]:select-text [&_textarea]:select-text';

/**
 * Docked Live Designer side-panel header (Outline / Properties / Code).
 * Title is 13px — one pixel above `text-xs` (12px) so the panel name stays readable.
 */
export const LIVE_DESIGNER_DOCK_HEADER_CLASS =
  'flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-[7px] select-none';

export const LIVE_DESIGNER_DOCK_TITLE_CLASS =
  'inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase leading-none tracking-wide text-slate-500';

export const LIVE_DESIGNER_DOCK_SUBTITLE_CLASS =
  'mt-0.5 truncate font-mono text-[10px] text-slate-400';

/** Always-on Live Designer dock toggle — vertical labeled strip beside the canvas. */
export const LIVE_DESIGNER_DOCK_TOGGLE_RAIL_CLASS =
  'flex h-full min-h-0 w-7 shrink-0 self-stretch items-center justify-center rounded-none px-0 py-3 select-none';

export const LIVE_DESIGNER_DOCK_TOGGLE_RAIL_LABEL_CLASS =
  'max-h-full text-[11px] font-semibold uppercase tracking-[0.18em] [writing-mode:vertical-rl]';

/** Live Designer toolbox list stays white; accordion headers keep the shared theme wash. */
export const LIVE_DESIGNER_TOOLBOX_BODY_CLASS = `bg-white ${UI_CHROME_NO_SELECT_CLASS}`;
export const LIVE_DESIGNER_TOOLBOX_SECTION_CLASS = 'bg-white';

/** Search host below the toolbox header — compact AppSearchBox sizing. */
export const TOOLBOX_PANEL_SEARCH_HOST_CLASS =
  'select-none [&_.app-search-box-input]:h-6 [&_.app-search-box-input]:text-[11px] [&_*]:!select-none';

/** Accordion section shell inside a toolbox panel body. */
export const TOOLBOX_PANEL_SECTION_CLASS =
  'flex min-h-0 flex-col border-b border-[color:var(--app-accent-border)] bg-white';

/** Expanded accordion section grows to fill remaining toolbox height. */
export const TOOLBOX_PANEL_SECTION_EXPANDED_CLASS = 'flex-1';

/** Collapsed accordion section keeps natural height only. */
export const TOOLBOX_PANEL_SECTION_COLLAPSED_CLASS = 'shrink-0';

/**
 * Accordion section header — light theme band + brand ink.
 * Mixes `--app-accent-500` (not wash — wash is already near-paper) so the
 * row reads as a tinted strip on the white tool list. Open/hover lifts one step.
 */
export const TOOLBOX_PANEL_SECTION_HEADER_CLASS =
  'flex h-8 w-full shrink-0 items-center justify-between !rounded-none border-0 bg-[color-mix(in_srgb,var(--app-accent-500)_14%,white)] px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[color:color-mix(in_srgb,var(--app-accent-700)_64%,black)] hover:bg-[color-mix(in_srgb,var(--app-accent-500)_20%,white)] aria-expanded:bg-[color-mix(in_srgb,var(--app-accent-500)_20%,white)] select-none';

/** Chevron on toolbox accordion headers — same darkened ink as the label. */
export const TOOLBOX_PANEL_SECTION_CHEVRON_CLASS =
  'h-3 w-3 shrink-0 text-[color:color-mix(in_srgb,var(--app-accent-700)_64%,black)] opacity-80';

/** Scrollable accordion section body. */
export const TOOLBOX_PANEL_SECTION_BODY_CLASS = 'min-h-0 flex-1 overflow-y-auto';

/** Flat list row inside toolbox search results or accordion bodies. */
export const TOOLBOX_PANEL_ITEM_CLASS =
  'flex w-full min-w-0 cursor-grab items-center gap-1.5 border-b border-slate-100 px-2 py-1.5 text-start transition last:border-b-0 hover:bg-primary-50 active:cursor-grabbing select-none';

/** Toolbox panel empty-state message. */
export const TOOLBOX_PANEL_EMPTY_STATE_CLASS =
  'flex flex-1 items-center justify-center px-3 py-6 text-center text-xs text-slate-500';

/** Panel / satellite section empty message (Base Components → Loading, error & empty → section message). */
export const SECTION_EMPTY_STATE_CLASS =
  'rounded-lg border border-dashed border-slate-200/90 bg-slate-50/40 px-4 py-5 text-sm leading-relaxed text-slate-600 text-start';

/** Table cell or flush surface body — same copy tone without the dashed frame. */
export const SECTION_EMPTY_STATE_INLINE_CLASS =
  'px-3 py-3 text-sm leading-relaxed text-slate-600 text-start sm:px-4 sm:py-4';

/** Shared admin page toolbar container base (Users/Roles reference). */
export const PAGE_TOOLBAR_CONTAINER_BASE_CLASS =
  'page-toolbar border-b border-slate-200 bg-white shrink-0 px-3 select-none sm:px-5';

/**
 * Single-row page toolbar: stacks filters then actions on phone/tablet; single row from `lg` up.
 * Pair with PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS + PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS on direct children.
 */
export const PAGE_TOOLBAR_SINGLE_ROW_CLASS =
  `${PAGE_TOOLBAR_CONTAINER_BASE_CLASS} flex min-h-14 flex-col justify-between gap-2.5 py-2.5 lg:flex-row lg:items-center lg:gap-3 lg:py-0`;

/**
 * Multi-row page toolbar shell — only when desktop needs 2+ stacked filter rows.
 * `page-toolbar-multi-row` opts out of the single-row h-14 lock in `index.css`.
 */
export const PAGE_TOOLBAR_MULTI_ROW_CLASS =
  `${PAGE_TOOLBAR_CONTAINER_BASE_CLASS} page-toolbar-multi-row flex flex-col`;

/**
 * One logical toolbar row inside a multi-row shell — same height as PAGE_TOOLBAR_SINGLE_ROW_CLASS.
 * Repeat for each stacked row; pair with FILTERS / ACTIONS clusters inside.
 */
export const PAGE_TOOLBAR_INNER_ROW_CLASS =
  'page-toolbar-inner-row flex min-h-14 flex-col justify-between gap-2.5 py-2.5 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:py-0';

/** Filters/search cluster inside a page toolbar (left / top on phone/tablet). */
export const PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS =
  'page-toolbar-filters-cluster flex min-w-0 w-full flex-wrap items-center gap-2 max-lg:gap-2 lg:w-auto lg:min-w-0 lg:flex-1 lg:basis-0 lg:flex-nowrap lg:gap-3 lg:overscroll-x-contain';

/** Primary actions cluster inside a page toolbar (right / bottom on phone/tablet). */
export const PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS =
  'page-toolbar-actions-cluster flex w-full shrink-0 flex-wrap items-center justify-end gap-2 lg:w-auto lg:flex-nowrap';

/** Vertical separator before a distinct action group (e.g. refresh). Hidden until toolbar is single-row (`lg`). */
export const PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS = 'hidden h-5 w-px shrink-0 bg-slate-200 lg:block';

/** Toolbar labeled action — text label from `2xl`; icon-only square button `lg`–`xl` (room beside docked sidebar ~1280). */
export const TOOLBAR_ACTION_LABEL_CLASS = 'hidden 2xl:inline';

/** Square icon-only toolbar button below `xl`; restores labeled padding from `xl`. Pair with AppButton size="sm". */
export const TOOLBAR_ACTION_COMPACT_BUTTON_CLASS =
  'lg:!h-8 lg:!w-8 lg:!min-w-8 lg:!justify-center lg:!gap-0 lg:!px-0 2xl:!h-8 2xl:!w-auto 2xl:!min-w-0 2xl:!px-3 2xl:!gap-1.5';

/** Single toggle filter in a page toolbar — bordered label wrapping UiCheckbox; place last in PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS. */
export const PAGE_TOOLBAR_FILTER_CHECKBOX_LABEL_CLASS =
  'inline-flex h-8 w-auto shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 whitespace-nowrap';

/** Checkbox row inside PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS — content width only (overrides UiCheckboxChoice w-full). */
export const PAGE_TOOLBAR_FILTER_CHECKBOX_ITEM_CLASS =
  'inline-flex w-auto shrink-0 cursor-pointer select-none items-center gap-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap';

/** Multi-option checkbox filter group in a page toolbar — one bordered host for several toggles; place last in filters. */
export const PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS =
  'inline-flex min-h-8 w-auto max-w-full shrink-0 flex-wrap items-center gap-2 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 sm:gap-3 sm:whitespace-nowrap';

/**
 * List Filter header 2 — applied where-builder summary between the page toolbar and the grid.
 * Render only when a filter is active so an empty band cannot break flush toolbar→grid adjacency.
 */
export const LIST_FILTER_SUMMARY_BAND_CLASS =
  'flex shrink-0 items-start gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 sm:items-center sm:px-5';

export const LIST_FILTER_SUMMARY_TEXT_CLASS =
  'min-w-0 flex-1 font-mono text-[11px] leading-relaxed text-slate-600 sm:truncate';

/**
 * Page header title cluster — metadata stacks below on phone, inline from sm.
 * Icon + title must sit in PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS (never loose siblings of this row).
 * Pair with PAGE_HEADER_TITLE_CLASS, PAGE_HEADER_META_CLASS, and PAGE_HEADER_META_SEPARATOR_CLASS.
 */
export const PAGE_HEADER_TITLE_ROW_CLASS =
  'flex min-w-0 w-full flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2.5';

/**
 * Icon beside a title or label. Compact surfaces (chips, option-card titles, labeled buttons) use gap-1.5.
 * Never place a Lucide glyph flush against text — the stroke sits on the box edge.
 */
export const ICON_LABEL_ROW_CLASS = 'inline-flex min-w-0 items-center gap-1.5';

/** Icon + page/section title (more air than compact labels). */
export const PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS = 'inline-flex min-w-0 max-w-full items-center gap-2';

/** Leading header icon slot — size the SVG so it cannot overflow into the title. */
export const PAGE_HEADER_ICON_SLOT_CLASS =
  'inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0';

/** Page header title beside inline metadata — tight line box for vertical centering. */
export const PAGE_HEADER_TITLE_CLASS = 'min-w-0 shrink-0 truncate leading-none';

/**
 * Optical nudge when metadata sits inline beside a larger bold title (sm+ only).
 * Keeps the horizontal midline of title and description aligned.
 */
export const PAGE_HEADER_META_INLINE_OFFSET_CLASS = 'sm:mt-[3px]';

/** Page header metadata line (description) — full width on phone, truncated inline from sm. */
export const PAGE_HEADER_META_CLASS =
  `min-w-0 ${TYPE_CAPTION_CLASS} leading-none text-slate-500 sm:truncate ${PAGE_HEADER_META_INLINE_OFFSET_CLASS}`;

/** Dot separator between page title and metadata — desktop only. */
export const PAGE_HEADER_META_SEPARATOR_CLASS = 'hidden shrink-0 leading-none text-slate-300 sm:inline';

/** Card / panel section header band (dashboard widgets, list sections). */
export const PAGE_SECTION_HEADER_CLASS = 'border-b border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3';

/** Section header title inside PAGE_SECTION_HEADER_CLASS. */
export const PAGE_SECTION_HEADER_TITLE_CLASS = 'text-sm font-semibold text-slate-800';

/** Section header subtitle inside PAGE_SECTION_HEADER_CLASS. */
export const PAGE_SECTION_HEADER_SUBTITLE_CLASS = 'mt-0.5 text-xs text-slate-500';

/**
 * Workspace editor header — stacks title block and actions on phone.
 * Use for graph/code editors with back link + metadata + action buttons.
 */
export const WORKSPACE_EDITOR_HEADER_CLASS =
  'flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4';

/**
 * ToolbarSearchInput host — full width on phone (stacked toolbar); 150px from md; 200px from xl.
 * Pair with ToolbarSearchInput; do not override width unless a feature spec requires it.
 */
export const TOOLBAR_SEARCH_INPUT_HOST_CLASS =
  'relative min-w-0 w-full shrink-0 md:w-[150px] md:max-w-[150px] xl:w-[200px] xl:max-w-[200px]';

/**
 * ToolbarFilterDateInput host — same reflow widths as toolbar search; legacy filter grids may override width.
 */
export const TOOLBAR_FILTER_DATE_INPUT_HOST_CLASS =
  'relative min-w-0 w-full shrink-0 md:w-[150px] md:max-w-[150px] xl:w-[11rem] xl:max-w-[11rem]';

/**
 * ToolbarFilterSelect host — reflow in `PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS` below `lg`
 * (Fluent reposition): flex-grow on compact, fixed width on desktop. See ui-toolbar.md.
 */
export const TOOLBAR_FILTER_SELECT_SINGLE_HOST_CLASS =
  'shrink-0 min-w-[9rem] max-w-[12rem] max-lg:flex-1 max-lg:basis-[9rem] max-lg:min-w-[9rem] max-lg:max-w-[14rem]';

export const TOOLBAR_FILTER_SELECT_MULTIPLE_HOST_CLASS =
  'shrink-0 max-lg:flex-1 max-lg:basis-[12rem] max-lg:min-w-[9rem] max-lg:max-w-[14rem] lg:min-w-[9rem] lg:max-w-[14rem] lg:w-[12rem] 2xl:w-[20rem] 2xl:min-w-[20rem] 2xl:max-w-[24rem]';

/** Fixed width for settings/sandbox workspace section nav (legacy w-72 minus 50px). */
export const WORKSPACE_SECTION_NAV_WIDTH_CLASS = 'w-[238px]';

/** Base link shell for settings/sandbox workspace section nav. */
export const WORKSPACE_SECTION_NAV_LINK_BASE_CLASS =
  'workspace-section-nav-item relative inline-flex w-full items-center justify-start gap-3 rounded-lg border px-3 py-1.5 text-start text-sm font-medium no-underline outline-none transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0';

/** Active state — pairs with tone-specific surface classes; accent bar via CSS ::after. */
export const WORKSPACE_SECTION_NAV_LINK_ACTIVE_CLASS = 'workspace-section-nav-item-active';

/** Small icon accent in workspace section nav (text-* only). */
export const WORKSPACE_SECTION_NAV_TONE_ICON_CLASS: Record<AppSurfaceBoxTone, string> = {
  slate: 'text-slate-600',
  violet: 'text-violet-600',
  cyan: 'text-cyan-600',
  indigo: 'text-indigo-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
};

/** Selected row shell — tinted bg/border per tone (CMS Settings / App Settings left rail). */
export const WORKSPACE_SECTION_NAV_TONE_ACTIVE_CLASS: Record<AppSurfaceBoxTone, string> = {
  slate: 'bg-white text-slate-900 border-slate-200 shadow-sm',
  violet: 'bg-violet-50/80 text-violet-950 border-violet-200 shadow-sm',
  cyan: 'bg-cyan-50/80 text-cyan-950 border-cyan-200 shadow-sm',
  indigo: 'bg-indigo-50/80 text-indigo-950 border-indigo-200 shadow-sm',
  emerald: 'bg-emerald-50/80 text-emerald-950 border-emerald-200 shadow-sm',
  amber: 'bg-amber-50/80 text-amber-950 border-amber-200 shadow-sm',
  rose: 'bg-rose-50/80 text-rose-950 border-rose-200 shadow-sm',
};

export function getWorkspaceSectionNavToneIconClass(tone: AppSurfaceBoxTone): string {
  return WORKSPACE_SECTION_NAV_TONE_ICON_CLASS[tone];
}

export function getWorkspaceSectionNavToneActiveClass(tone: AppSurfaceBoxTone): string {
  return WORKSPACE_SECTION_NAV_TONE_ACTIVE_CLASS[tone];
}

/** Grid paging footer shell — stacks on phone, single row from `sm` up. */
export const GRID_PAGING_FOOTER_CLASS =
  `flex flex-col gap-2 border-t border-slate-200 ${DIALOG_FOOTER_SURFACE_BG_CLASS} px-3 py-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-5`;

/**
 * Grid paging footer inside a dialog — 10px inset from the window L/R edges so the band
 * does not kiss the shell border. Applied automatically when GridPagingFooter is under
 * AppDialogShell (DialogHostContext), or when `edgeAlignInDialog` is set.
 */
export const CREATE_EDIT_MODAL_GRID_PAGING_FOOTER_CLASS =
  `mx-[10px] flex flex-col gap-2 border-t border-slate-200 ${DIALOG_FOOTER_SURFACE_BG_CLASS} px-0 py-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:gap-2`;

/**
 * Rounded card around a table + paging. Border thickness is set inline
 * (`borderWidth`); this class owns radius, clip, and color.
 * Border color matches the header band (`bg-slate-100`).
 */
export const APP_TABLE_GRID_JOINED_SHELL_CLASS =
  'overflow-hidden rounded-[8px] border-solid border-slate-100';

/** @see APP_TABLE_GRID_JOINED_SHELL_CLASS — hero chrome uses the same joined card. */
export const HERO_TABLE_JOINED_SHELL_CLASS = APP_TABLE_GRID_JOINED_SHELL_CLASS;

/** Header row fill + top corners matching the 8px joined shell. */
export const HERO_TABLE_HEADER_CORNER_CLASS =
  '[&_thead_tr:first-child>th]:bg-slate-100 [&_thead_tr:first-child>th:first-child]:rounded-ss-[8px] [&_thead_tr:first-child>th:last-child]:rounded-se-[8px]';

/**
 * Paging attached to AppTableGrid chrome=hero — classic First/Prev/page controls, body fill color.
 * Outer 1px + corner radius live on HERO_TABLE_JOINED_SHELL_CLASS; this band only
 * draws the internal 1px join under the table body.
 */
export const HERO_TABLE_PAGING_FOOTER_CLASS =
  'flex min-h-11 flex-col gap-2 border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-5';

/** Primary controls cluster in grid paging footer (range, sort, page size). */
export const GRID_PAGING_FOOTER_CONTROLS_CLASS =
  'flex flex-wrap items-center gap-x-2 gap-y-1';

/** Vertical separator between left-side control groups in the grid paging footer. */
export const GRID_PAGING_FOOTER_SEPARATOR_CLASS = 'h-4 w-px shrink-0 self-center bg-slate-200';

/** Pagination buttons cluster in grid paging footer. */
export const GRID_PAGING_FOOTER_NAV_CLASS =
  'flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-end';

/** Canonical surface box tones — change tone only to vary border/header tint across panels. */
export type AppSurfaceBoxTone = 'slate' | 'violet' | 'cyan' | 'indigo' | 'emerald' | 'amber' | 'rose';

export type AppSurfaceBoxToneTokens = {
  shell: string;
  header: string;
  title: string;
  strip: string;
};

export const APP_SURFACE_BOX_TONE_CLASS: Record<AppSurfaceBoxTone, AppSurfaceBoxToneTokens> = {
  slate: {
    shell: 'border-slate-200',
    header: 'border-b border-slate-100 bg-slate-50/80',
    title: 'text-slate-600',
    strip: 'border-slate-200 bg-slate-50/80',
  },
  violet: {
    shell: 'border-violet-200',
    header: 'border-b border-violet-100 bg-violet-50/70',
    title: 'text-violet-800',
    strip: 'border-violet-200 bg-violet-50/70',
  },
  cyan: {
    shell: 'border-cyan-200',
    header: 'border-b border-cyan-100 bg-cyan-50/70',
    title: 'text-cyan-800',
    strip: 'border-cyan-200 bg-cyan-50/70',
  },
  indigo: {
    shell: 'border-indigo-200',
    header: 'border-b border-indigo-100 bg-indigo-50/70',
    title: 'text-indigo-800',
    strip: 'border-indigo-200 bg-indigo-50/70',
  },
  emerald: {
    shell: 'border-emerald-200',
    header: 'border-b border-emerald-100 bg-emerald-50/70',
    title: 'text-emerald-800',
    strip: 'border-emerald-200 bg-emerald-50/70',
  },
  amber: {
    shell: 'border-amber-200',
    header: 'border-b border-amber-100 bg-amber-50/70',
    title: 'text-amber-800',
    strip: 'border-amber-200 bg-amber-50/70',
  },
  rose: {
    shell: 'border-rose-200',
    header: 'border-b border-rose-100 bg-rose-50/70',
    title: 'text-rose-800',
    strip: 'border-rose-200 bg-rose-50/70',
  },
};

export function resolveAppSurfaceBoxTone(
  value: unknown,
  fallback: AppSurfaceBoxTone = 'slate',
): AppSurfaceBoxTone {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(APP_SURFACE_BOX_TONE_CLASS, value)
    ? value as AppSurfaceBoxTone
    : fallback;
}

/** Nested-editor inspector rail — width/wash tokens in `src/index.css`. */
export const INSPECTOR_RAIL_DEFAULT_WIDTH_PX = 370;
export const INSPECTOR_RAIL_MIN_WIDTH_PX = 280;
export const INSPECTOR_RAIL_MAX_WIDTH_PX = 560;

export const INSPECTOR_RAIL_ASIDE_CLASS =
  'flex w-[var(--app-inspector-rail-width,370px)] shrink-0 flex-col overflow-x-hidden overflow-y-auto border-s border-[color:var(--app-inspector-rail-border)] bg-[var(--app-inspector-rail-bg)]';

export const INSPECTOR_RAIL_INNER_CLASS = 'flex flex-col space-y-6 p-4';

export const INSPECTOR_RAIL_CARD_CLASS =
  'overflow-hidden rounded-lg border border-[color:var(--app-inspector-rail-card-border)] bg-[var(--color-surface-elevated,#ffffff)] p-4 shadow-none';

export const INSPECTOR_RAIL_TITLE_CLASS =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-400';

export const INSPECTOR_RAIL_KV_CLASS =
  'grid grid-cols-3 items-start gap-x-3 gap-y-2';

export const INSPECTOR_RAIL_LABEL_CLASS =
  'col-span-1 flex min-h-8 items-center text-xs font-normal leading-snug text-slate-500';

export const INSPECTOR_RAIL_VALUE_CLASS =
  'col-span-2 flex min-h-8 min-w-0 items-center text-start';

/** Surface box shell — rounded bordered white panel (pair with tone shell border class). */
export const APP_SURFACE_BOX_SHELL_CLASS = 'overflow-hidden rounded-lg border bg-white';

/** Surface box header band — wraps on phone when headerExtra is present; fixed height from sm. */
export const APP_SURFACE_BOX_HEADER_CLASS =
  'flex min-h-9 min-w-0 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 sm:h-9 sm:flex-nowrap sm:py-0';

/** Surface box title label in header. */
export const APP_SURFACE_BOX_TITLE_CLASS =
  'shrink-0 text-[10px] font-bold uppercase tracking-wider';

/** Surface box body padding host. */
export const APP_SURFACE_BOX_BODY_CLASS = 'p-3';

/** Strip layout — compact tinted row without a header band. */
export const APP_SURFACE_BOX_STRIP_CLASS = 'shrink-0 overflow-hidden rounded-lg border px-3 py-2';

/** Panel/sidebar search bar host — edge-aligned band above scrollable content (AppSearchBox). */
export const APP_SEARCH_BOX_BAR_CLASS =
  'relative flex shrink-0 min-h-8 items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-[9px]';

/** Search icon inside AppSearchBox. */
export const APP_SEARCH_BOX_ICON_CLASS = 'h-3.5 w-3.5 shrink-0 text-slate-400';

/** Grouped sidebar menu search — frost pill; focus chrome lives in `.admin-sidebar-nav-search`. */
export const SIDEBAR_MENU_SEARCH_HOST_CLASS =
  'admin-sidebar-nav-search relative flex w-full shrink-0 items-stretch overflow-hidden rounded-md';

export const SIDEBAR_MENU_SEARCH_ADDON_CLASS =
  'admin-sidebar-nav-search-addon flex shrink-0 items-center px-2';

export const SIDEBAR_MENU_SEARCH_INPUT_CLASS =
  'h-full min-h-0 max-h-full w-full !h-full !min-h-0 !max-h-full !border-0 !bg-transparent !px-1.5 !py-0 !shadow-none font-normal text-slate-700 outline-none placeholder:text-slate-400 hover:!bg-transparent data-[hover=true]:!bg-transparent';

export const SIDEBAR_MENU_SEARCH_CLEAR_CLASS =
  'flex h-[1.875rem] w-[1.875rem] shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-slate-400 outline-none transition-colors hover:text-slate-600';

/** Borderless native input inside AppSearchBox; always reserve pe-6 so clear icon does not shift layout. */
export const APP_SEARCH_BOX_INPUT_CLASS =
  'h-8 w-full bg-transparent pe-6 font-sans text-xs font-medium text-slate-800 !border-0 !shadow-none outline-none placeholder-slate-400 focus:border-none focus:outline-none focus:ring-0';

export const APP_SEARCH_BOX_INPUT_STYLE = {
  background: 'transparent',
  WebkitAppearance: 'none',
} as const;

/** Icon-only clear control for AppSearchBox (ghost; no border/background at rest). */
export const APP_SEARCH_BOX_CLEAR_BUTTON_CLASS =
  'absolute top-1/2 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-indigo-700 outline-none transition-colors hover:text-cyan-700';

export const APP_SEARCH_BOX_CLEAR_BUTTON_POSITION_CLASS = 'end-3';

/** Apply with AppTableGrid `scrollGutter="overlay"` (default) — native bars hidden; use overlay thumbs. */
export const APP_TABLE_GRID_SCROLL_OVERLAY_CLASS = 'app-table-grid-scroll-overlay';

/** Platform scroll hosts (shell outlet, panels) — same overlay contract as grid scrollports. */
export const APP_SCROLL_OVERLAY_CLASS = APP_TABLE_GRID_SCROLL_OVERLAY_CLASS;

/** Scroll host for page table grids (fills remaining page height). */
export const APP_TABLE_GRID_SCROLL_CLASS = 'flex-1 min-h-0 min-w-0 overflow-auto';

/** Scroll host when Height is content — hug rows instead of filling the parent. */
export const APP_TABLE_GRID_CONTENT_SCROLL_CLASS = 'min-w-0 overflow-auto';

/** Outer host when Height is 100% (page list composition). */
export const APP_TABLE_GRID_FILL_HOST_CLASS = 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden';

/** Outer host when Height is content. */
export const APP_TABLE_GRID_CONTENT_HOST_CLASS = 'flex w-full flex-col';

/** Right inset for grid header/body cells (same value as start; set via --app-table-grid-cell-px). */
export const APP_TABLE_GRID_CELL_PE_CLASS = 'pe-[var(--app-table-grid-cell-px,5px)]';

/** Start inset for grid columns (same as end; overridden per grid via --app-table-grid-cell-px). */
export const APP_TABLE_GRID_CELL_PS_CLASS = 'ps-[var(--app-table-grid-cell-px,5px)]';

/** Start inset for the first visible column (header + body). */
export const APP_TABLE_GRID_FIRST_COLUMN_PS_CLASS = APP_TABLE_GRID_CELL_PS_CLASS;

/** @deprecated Use APP_TABLE_GRID_CELL_PE_CLASS */
export const APP_TABLE_GRID_CELL_PR_CLASS = APP_TABLE_GRID_CELL_PE_CLASS;

/** @deprecated Use APP_TABLE_GRID_CELL_PS_CLASS */
export const APP_TABLE_GRID_CELL_PL_CLASS = APP_TABLE_GRID_CELL_PS_CLASS;

/** @deprecated Use APP_TABLE_GRID_FIRST_COLUMN_PS_CLASS */
export const APP_TABLE_GRID_FIRST_COLUMN_PL_CLASS = APP_TABLE_GRID_FIRST_COLUMN_PS_CLASS;

/**
 * Table-level cell inline padding: every column uses --app-table-grid-cell-px (default 5px).
 * Prefer APP_TABLE_GRID_TABLE_CLASS on every grid table so cells need only APP_TABLE_GRID_CELL_PE_CLASS.
 */
export const APP_TABLE_GRID_TABLE_FIRST_COLUMN_INSET_CLASS =
  '[&_tr>th]:ps-[var(--app-table-grid-cell-px,5px)] [&_tr>td]:ps-[var(--app-table-grid-cell-px,5px)] [&_tr>th]:pe-[var(--app-table-grid-cell-px,5px)] [&_tr>td]:pe-[var(--app-table-grid-cell-px,5px)]';

/** Extra inline padding on the last column so overlay scroll thumbs do not cover cell content. */
export const APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_PX = 13;

export const APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_VAR = '--app-table-grid-last-column-overlay-inset';

export const APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CLASS = [
  `[&_tr>th:last-child]:ps-[calc(var(--app-table-grid-cell-px,5px)+var(${APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_VAR},13px))]`,
  `[&_tr>td:last-child]:ps-[calc(var(--app-table-grid-cell-px,5px)+var(${APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_VAR},13px))]`,
  `[&_tr>th:last-child]:pe-[calc(var(--app-table-grid-cell-px,5px)+var(${APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_VAR},13px))]`,
  `[&_tr>td:last-child]:pe-[calc(var(--app-table-grid-cell-px,5px)+var(${APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_VAR},13px))]`,
].join(' ');

/** Cell-level inset wins over column `!px-*` overrides (nominate columns, tight action cells). */
export const APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CELL_CLASS = [
  `!ps-[calc(var(--app-table-grid-cell-px,5px)+var(${APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_VAR},13px))]`,
  `!pe-[calc(var(--app-table-grid-cell-px,5px)+var(${APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_VAR},13px))]`,
].join(' ');

/** Base table styles for AppTableGrid and composed grid tables. */
export const APP_TABLE_GRID_TABLE_CLASS =
  `w-full table-fixed text-start border-collapse ${APP_TABLE_GRID_TABLE_FIRST_COLUMN_INSET_CLASS}`;

/** Clip cell values at the column edge and show an ellipsis when the remainder is hidden. */
export const APP_TABLE_GRID_CELL_CLIP_CLASS = 'min-w-0 max-w-full truncate';

/** Wrap long cell values inside the column instead of a single-line ellipsis. */
export const APP_TABLE_GRID_CELL_WRAP_CLASS = 'min-w-0 max-w-full overflow-hidden whitespace-pre-wrap break-words';

/**
 * @deprecated Do not set physical LTR on columns. Use `textDirection: 'culture'` (default)
 * on `AppTableGridColumnDef`, or `opposite` / explicit `ltr` | `rtl` when required.
 */
export const APP_TABLE_GRID_DATA_ALIGN_CLASS = '';

/** Action column header/body alignment — logical end (mirrors in RTL). */
export const APP_TABLE_GRID_ACTION_HEADER_CLASS = 'text-end';
export const APP_TABLE_GRID_ACTION_CELL_CLASS = 'text-end';

/**
 * Split-header band: sticky pinned header cells (z≈20) sit above `border-b` and break the rule on
 * the last column — draw one continuous line on the band above all header cells.
 */
const APP_TABLE_GRID_SPLIT_HEADER_BAND_BOTTOM_RULE =
  'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-[25] after:h-px after:content-[""]';

/** Sticky table header band — stays visible while grid body scrolls (single-scroll table). */
export const APP_TABLE_GRID_THEAD_CLASS =
  'sticky top-0 z-10 bg-slate-100 border-b border-slate-300 shadow-[0_1px_0_0_rgb(203_213_225)]';

/** Fixed header band when the grid body has its own scroll region. */
export const APP_TABLE_GRID_THEAD_BAND_CLASS =
  `relative bg-slate-100 ${APP_TABLE_GRID_SPLIT_HEADER_BAND_BOTTOM_RULE} after:bg-slate-300`;

/** Hero chrome header — same slate-100 band, quieter divider, no extra shadow. */
export const APP_TABLE_GRID_HERO_THEAD_CLASS =
  'sticky top-0 z-10 bg-slate-100 border-b border-slate-200';

/** Hero fixed header band for split body scroll. */
export const APP_TABLE_GRID_HERO_THEAD_BAND_CLASS =
  `relative bg-slate-100 ${APP_TABLE_GRID_SPLIT_HEADER_BAND_BOTTOM_RULE} after:bg-slate-200`;

/** Standard tbody row divider styling. */
export const APP_TABLE_GRID_TBODY_CLASS = 'divide-y divide-slate-100';

/** Standard data row hover treatment. */
export const APP_TABLE_GRID_ROW_CLASS = 'hover:bg-slate-100/80 transition-colors';

/**
 * Row wrapper for hover-revealed inline actions (link buttons beside badges, etc.).
 * Pair child controls with APP_TABLE_GRID_ROW_HOVER_REVEAL_CLASS — see index.css.
 */
export const APP_TABLE_GRID_ROW_HOVER_GROUP_CLASS = 'app-table-grid-row';

/** Hidden until the parent APP_TABLE_GRID_ROW_HOVER_GROUP_CLASS row is hovered or focus-within. */
export const APP_TABLE_GRID_ROW_HOVER_REVEAL_CLASS = 'app-table-grid-row-hover-reveal';

/**
 * Grid workflow action (e.g. Send): visible ghost label until row hover, then button chrome.
 * Pair with APP_TABLE_GRID_WORKFLOW_ACTION_OPEN_CLASS when popover is open.
 */
export const APP_TABLE_GRID_WORKFLOW_ACTION_CLASS = 'app-table-grid-workflow-action';
export const APP_TABLE_GRID_WORKFLOW_ACTION_OPEN_CLASS = 'app-table-grid-workflow-action--open';

/** Centered loading/empty placeholder inside grid scroll area. */
export const APP_TABLE_GRID_STATE_PANEL_CLASS = 'flex items-center justify-center h-40 text-sm text-slate-400';

/** Fixed width for Created/Updated audit timestamp columns in admin CRUD grids. */
export const APP_TABLE_GRID_AUDIT_COLUMN_WIDTH = 150;

/** Date/actor ink in classic CRUD grids — stronger than caption slate-400 for wide-table scanning. */
export const APP_TABLE_GRID_AUDIT_TEXT_CLASS = 'font-mono text-xs text-slate-600';
export const APP_TABLE_GRID_ACTOR_TEXT_CLASS = 'text-xs text-slate-600';

/** Soft cap for long free-text columns (Note) so action icon groups keep a stable end column. */
export const APP_TABLE_GRID_NOTE_COLUMN_MAX_WIDTH = 280;

/** Cell horizontal padding when the table cannot use APP_TABLE_GRID_TABLE_FIRST_COLUMN_INSET_CLASS. */
export function appTableGridCellPxClass(isFirstColumn = false): string {
  return isFirstColumn
    ? `${APP_TABLE_GRID_FIRST_COLUMN_PS_CLASS} ${APP_TABLE_GRID_CELL_PE_CLASS}`
    : `${APP_TABLE_GRID_CELL_PS_CLASS} ${APP_TABLE_GRID_CELL_PE_CLASS}`;
}

/** Standard sticky header cell styling for AppTableGrid composed and column-mode grids. */
export const APP_TABLE_GRID_HEADER_CELL_CLASS =
  `${APP_TABLE_GRID_CELL_PE_CLASS} py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500`;

/** Hero chrome header cell — airier vertical padding, same eyebrow type. */
export const APP_TABLE_GRID_HERO_HEADER_CELL_CLASS =
  `${APP_TABLE_GRID_CELL_PE_CLASS} py-4 font-bold text-[10px] uppercase tracking-wider text-slate-500`;

/** Header cell class with explicit first-column left inset (composed grids without table inset). */
export function appTableGridHeaderCellClass(isFirstColumn = false, chrome: 'classic' | 'hero' = 'classic'): string {
  const py = chrome === 'hero' ? 'py-4' : 'py-3';
  return `${appTableGridCellPxClass(isFirstColumn)} ${py} font-bold text-[10px] uppercase tracking-wider text-slate-500`;
}

/** Default body cell padding for AppTableGrid column mode. */
export const APP_TABLE_GRID_BODY_CELL_CLASS =
  `${APP_TABLE_GRID_CELL_PE_CLASS} min-w-0 overflow-hidden py-3 align-middle leading-5`;

/** Hero chrome body cell — taller row so badges, booleans, and actions breathe. */
export const APP_TABLE_GRID_HERO_BODY_CELL_CLASS =
  `${APP_TABLE_GRID_CELL_PE_CLASS} min-w-0 overflow-hidden py-4 align-middle leading-5`;

/** Empty / null cell placeholder — stronger than caption slate-400 so `--` stays scannable. */
export const APP_TABLE_GRID_EMPTY_VALUE = '--';
export const APP_TABLE_GRID_EMPTY_VALUE_CLASS = 'text-xs font-normal tabular-nums text-slate-500';

/**
 * Shared gutter for list-page card grids (AppTableGrid compact + DevelopmentCatalogCardGrid).
 * Same inset on phone/tablet so cards stay raised tiles edge-to-edge in the bounded shell — never a borderless “flat list”.
 */
/** Vertical rhythm between list cards — same on catalog grids and AppTableGrid compact hosts. */
export const LIST_PAGE_CARD_GRID_GAP_CLASS = 'gap-2';

/** Pixel gap for `LIST_PAGE_CARD_GRID_GAP_CLASS` (`gap-2`) — required for virtualized card lists. */
export const LIST_PAGE_CARD_GRID_GAP_PX = 8;

/** Horizontal/vertical inset for list card hosts (matches page toolbar content inset on phone). */
export const LIST_PAGE_CARD_GRID_INSET_CLASS = 'px-3 py-2 sm:px-4';

export const LIST_PAGE_CARD_GRID_GUTTER_CLASS =
  `${LIST_PAGE_CARD_GRID_GAP_CLASS} ${LIST_PAGE_CARD_GRID_INSET_CLASS}`;

/** Card list host for adaptive AppTableGrid presentation. */
export const APP_TABLE_GRID_CARD_LIST_CLASS =
  `flex flex-col ${LIST_PAGE_CARD_GRID_GUTTER_CLASS}`;

/** Multi-column card host when tablet compact layout uses 2–3 cards per row. */
export function appTableGridCardListClass(cardsPerRow: 1 | 2 | 3 = 1): string {
  if (cardsPerRow <= 1) {
    return APP_TABLE_GRID_CARD_LIST_CLASS;
  }
  const cols = cardsPerRow === 2 ? 'grid-cols-2' : 'grid-cols-3';
  return `grid ${cols} items-stretch ${LIST_PAGE_CARD_GRID_GUTTER_CLASS}`;
}

/** Nested member-card grids (e.g. dossier kasb links) — phone 1 col, wider viewports more. */
export const LIST_PAGE_MEMBER_CARD_GRID_RESPONSIVE_CLASS =
  `grid grid-cols-1 items-stretch ${LIST_PAGE_CARD_GRID_GAP_CLASS} sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`;

/** Multi-column gallery card host. */
export const APP_TABLE_GRID_GALLERY_CARD_GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] items-stretch gap-[5px] px-[5px] py-2';

/** Sticky first-column freeze for compact table-scroll. */
export const APP_TABLE_GRID_FROZEN_START_COLUMN_CLASS =
  'sticky start-0 z-[21] bg-[var(--app-table-grid-pin-bg,#ffffff)] shadow-[1px_0_0_0_rgb(226_232_240)]';

/**
 * Raised list-page card shell — Server Functions catalog + AppTableGrid compact (one contract).
 * Padding, shadow, hover, and border must not diverge per page or viewport tier.
 */
export const LIST_PAGE_CARD_SHELL_CLASS =
  'rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-primary-500/30 hover:bg-primary-subtle/15 hover:shadow-md hover:shadow-primary-500/25';

/** Alias for LIST_PAGE_CARD_SHELL_CLASS (AppTableGrid + legacy imports). */
export const APP_TABLE_GRID_CARD_CLASS = LIST_PAGE_CARD_SHELL_CLASS;

/** Card shell that stretches to the grid row height (multi-column card view). */
export const APP_TABLE_GRID_CARD_SHELL_CLASS =
  `${LIST_PAGE_CARD_SHELL_CLASS} group flex h-full min-w-0 flex-col`;

/** Card field label in adaptive AppTableGrid presentation (inline beside value). */
export const APP_TABLE_GRID_CARD_FIELD_LABEL_CLASS =
  'shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500';

/** Card labeled field row in adaptive AppTableGrid presentation. */
export const APP_TABLE_GRID_CARD_FIELD_ROW_CLASS =
  'flex min-w-0 items-start gap-2';

/** Card field value in adaptive AppTableGrid presentation. */
export const APP_TABLE_GRID_CARD_FIELD_VALUE_CLASS =
  'min-w-0 flex-1 text-slate-700';

/** Card meta row in adaptive AppTableGrid presentation. */
export const APP_TABLE_GRID_CARD_META_CLASS =
  'flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400';

/** Card footer band — matches DevelopmentCatalogCardFooter spacing. */
export const APP_TABLE_GRID_CARD_ACTIONS_CLASS =
  'mt-1 flex items-center gap-2 border-t border-slate-100 pt-1';

/** Horizontal scroll table wrapper for tablet adaptive presentation. */
export const APP_TABLE_GRID_TABLE_SCROLL_INNER_CLASS = 'min-w-max';

/** Admin shell root — themed gradient + geometric atmosphere behind chrome. */
export const ADMIN_SHELL_ROOT_CLASS =
  'admin-shell-surface shell-atmosphere h-screen w-full flex overflow-hidden relative ps-[var(--appendoo-dock-padding-inline-start,0px)] pe-[var(--appendoo-dock-padding-inline-end,0px)] transition-[padding-inline] duration-200';

/** Admin shell sidebar — overlay drawer below lg; docked rail from desktop (1024px). */
export const ADMIN_SHELL_SIDEBAR_CLASS =
  'admin-shell-surface admin-shell-chrome lg:relative lg:z-30 flex shrink-0 flex-col select-none transition-transform duration-300 ease-out lg:translate-x-0';

/** Overlay drawer on phone and tablet. Applied only when overlay nav is active. */
export const ADMIN_SHELL_SIDEBAR_OVERLAY_CLASS =
  'admin-shell-sidebar-overlay fixed inset-y-0 start-0 z-[60] h-full shadow-xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]';

/** Toggle anchors on the content-facing sidebar edge (logical end); position in `index.css`. */
export const ADMIN_SHELL_SIDEBAR_COLLAPSE_BUTTON_CLASS =
  'admin-shell-sidebar-collapse-toggle absolute hidden lg:flex items-center justify-center w-6 h-6 rounded-full border border-border-subtle text-text-nav-icon hover:text-primary-700 hover:bg-primary-subtle/60 transition-colors z-40 cursor-pointer bg-nav-active shadow-sm';

/** Logo row in designer / published admin sidebar — height tightens when the rail is collapsed. */
export const ADMIN_SHELL_SIDEBAR_LOGO_REGION_CLASS = 'admin-shell-sidebar-logo-region';

/** Portal menu (and similar) inset below the logo — padding matches AppShellSidebar when collapsed. */
export const ADMIN_SHELL_SIDEBAR_INSET_CLASS = 'admin-shell-sidebar-inset';

/** Host wrapping side `platform-nav` — padding matches AppShellSidebar nav when collapsed. */
export const ADMIN_SHELL_SIDEBAR_NAV_HOST_CLASS = 'admin-shell-sidebar-nav-host';

export const ADMIN_SHELL_MOBILE_BACKDROP_CLASS =
  'fixed inset-0 z-[55] bg-slate-900/50';

const ADMIN_SHELL_HAMBURGER_BUTTON_BASE_CLASS =
  'flex shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-nav-active p-2 text-primary-700 shadow-sm transition-colors hover:bg-primary-subtle/60';

/** Mobile/tablet drawer trigger; hidden on lg unless `visibleOnDesktop` (fully hidden sidebar). */
export const adminShellHamburgerButtonClass = (options?: { visibleOnDesktop?: boolean }) =>
  `${ADMIN_SHELL_HAMBURGER_BUTTON_BASE_CLASS}${options?.visibleOnDesktop ? '' : ' lg:hidden'}`;

export const ADMIN_SHELL_HAMBURGER_BUTTON_CLASS = adminShellHamburgerButtonClass();

/** Admin shell main column — header + content host stack. */
export const ADMIN_SHELL_MAIN_CLASS =
  'admin-shell-surface admin-shell-chrome flex-1 flex flex-col min-w-0 min-h-0 relative z-20 h-full overflow-x-clip overflow-y-visible';

/** Admin shell top header — flush with content host; no bottom separator; compact below lg. */
export const ADMIN_SHELL_HEADER_CLASS =
  'admin-shell-surface admin-shell-chrome admin-shell-header-band relative z-30 flex h-[calc(52px+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-2 overflow-visible ps-3 pe-2 select-none [&_input]:select-text [&_textarea]:select-text max-lg:ps-[max(0.75rem,env(safe-area-inset-inline-start,env(safe-area-inset-left)))] max-lg:pe-[max(0.5rem,env(safe-area-inset-inline-end,env(safe-area-inset-right)))] max-lg:pt-[env(safe-area-inset-top)] max-sm:h-auto max-sm:min-h-[calc(52px+env(safe-area-inset-top))] max-sm:items-stretch lg:h-[59px] lg:min-h-[59px] lg:gap-0 lg:ps-8 lg:pe-[12px]';

/** Inner header row — fills the header band so children center on the same midline. */
export const ADMIN_SHELL_HEADER_INNER_CLASS =
  'relative z-10 flex h-full w-full min-w-0 items-center justify-between max-sm:h-auto max-sm:min-h-[52px] max-sm:flex-wrap';

/** Second header band on very narrow screens — centered page title when row 1 cannot hold it. */
export const ADMIN_SHELL_HEADER_TITLE_ROW_CLASS =
  'hidden h-9 w-full basis-full items-center justify-center px-3 max-sm:flex';

/** Page title in the shell header — Title role, stronger than action chrome. */
export const ADMIN_SHELL_HEADER_TITLE_CLASS =
  `min-w-0 flex-1 leading-tight ${TYPE_PAGE_TITLE_CLASS}`;

/** Slash between group / trail segments and the active page title — must stay readable on shell chrome. */
export const ADMIN_SHELL_HEADER_TITLE_TRAIL_SEPARATOR_CLASS =
  'hidden shrink-0 mx-[2px] font-bold text-slate-500 lg:inline';

/** Caption under the page title — muted, never competing with the heading. */
export const ADMIN_SHELL_HEADER_SUBTITLE_CLASS =
  `mt-0.5 hidden min-w-0 truncate leading-none text-slate-500 lg:block ${TYPE_CAPTION_CLASS}`;

/** Portal for page-local header actions (layout toggles, catalogs). Separated from the title cluster. */
export const ADMIN_SHELL_HEADER_ACTION_SLOT_CLASS =
  'hidden h-8 shrink-0 self-center items-center gap-4 border-s border-border-divider ms-5 ps-5 data-[active=true]:lg:flex';

/** Right-side shell utilities — feedback/tour/nav, bell, then account + page chrome at the end. */
export const ADMIN_SHELL_HEADER_ACTIONS_CLUSTER_CLASS =
  'relative flex shrink-0 items-center gap-2';
/** Feedback, tour guide, and header nav shortcuts — before the notification bell. */
export const ADMIN_SHELL_HEADER_UTILITY_CLUSTER_CLASS =
  'flex items-center gap-1';

/** Vertical rule between header action groups (utilities, bell, account chrome). */
export const ADMIN_SHELL_HEADER_VERTICAL_SEPARATOR_CLASS =
  'ms-0.5 hidden h-5 shrink-0 self-center border-s-2 border-slate-300/90 sm:inline';

/** Square header chrome control (fullscreen, page guide, notification bell, …). */
export const ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS =
  'relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-primary-700 transition-colors [&_svg]:stroke-[1.75] hover:bg-primary-subtle/55 hover:[&_svg]:stroke-[2.25]';

/** Admin shell content wrapper — overflow visible so the start-edge lift shadow can breathe. */
export const ADMIN_SHELL_CONTENT_WRAPPER_CLASS =
  'admin-shell-chrome relative flex-1 min-h-0 transition-all duration-200 h-full min-h-0 overflow-hidden flex flex-col';

/** Admin shell content host — white surface; start border + radius only when the sidebar is docked (lg+). */
export const ADMIN_SHELL_CONTENT_HOST_CLASS =
  'flex-1 min-h-0 flex flex-col bg-white border-t border-shell-content-border overflow-hidden h-full relative z-[1] font-sans shadow-content-host lg:border-s lg:rounded-ss-[var(--admin-shell-content-radius,8px)] lg:rounded-se-none lg:rounded-es-none lg:rounded-ee-none';
