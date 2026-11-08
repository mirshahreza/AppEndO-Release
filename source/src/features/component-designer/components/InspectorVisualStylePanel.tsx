import * as React from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Columns2,
  Link2,
  Rows2,
  Unlink2,
  WrapText,
} from 'lucide-react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import {
  applyResponsiveTailwindUtility,
  resolveResponsiveTailwindUtilityValue,
} from '../../../domain/component-designer/tailwindClasses';
import {
  TAILWIND_INSPECTOR_FIELDS,
  type TailwindInspectorField,
} from '../../../domain/component-designer/inspectorRegistry';
import {
  areSpacingSidesUniform,
  applySpacingToClassName,
  encodeGapClassName,
  encodeSpacingClassName,
  parseGapClassName,
  parseSpacingClassName,
  setAllSpacingSides,
  snapToTailwindSpacingScale,
  type SpacingKind,
  type SpacingSide,
  type SpacingSides,
} from '../../../domain/component-designer/tailwindSpacingCodec';
import {
  encodeOpacityClassName,
  FONT_WEIGHT_FIELD,
  FONT_WEIGHT_PRESETS,
  isRoundedPreset,
  OPACITY_FIELD,
  parseOpacityClassName,
  ROUNDED_FIELD,
  ROUNDED_PRESETS,
  SHADOW_FIELD,
  SHADOW_PRESETS,
  isShadowPreset,
  snapToTailwindOpacityScale,
  TEXT_ALIGN_FIELD,
  TEXT_ALIGN_PRESETS,
  TEXT_SIZE_FIELD,
  type BreakpointPrefix,
} from '../../../domain/component-designer/tailwindStyleCodec';
import { INSPECTOR_FIELD_HIGHLIGHT_CLASS } from '../../../domain/component-designer/inspectorFieldSearch';
import { UiInput, UiCombobox, type UiComboboxItem, FormSection } from '../../../shared/ui';
import { DESIGNER_STYLE_BREAKPOINTS } from '../lib/designerStyleBreakpoints';
import { DesignerFieldRow } from './DesignerFieldRow';
import { InspectorPropDialogField } from './InspectorPropDialogField';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';
import {
  InspectorMicroLabel,
  INSPECTOR_SEGMENTED_CONTROL_CLASS,
  INSPECTOR_SEGMENTED_OPTION_ACTIVE_CLASS,
  INSPECTOR_SEGMENTED_OPTION_INACTIVE_CLASS,
} from './inspectorFieldPrimitives';

export type InspectorVisualStylePanelProps = {
  className: string;
  /** Inline CSS `style` attribute — shown beside className in the Style section. */
  styleValue?: string;
  breakpoint: BreakpointPrefix;
  onBreakpointChange: (next: BreakpointPrefix) => void;
  onClassNameChange: (nextClassName: string) => void;
  onStyleChange?: (nextStyle: string) => void;
  highlightedFieldKeys?: ReadonlySet<string>;
  /** When false, hide flex/grid Layout controls (T1-11e capability: container). */
  showContainerLayout?: boolean;
  /**
   * True for `layout.grid-2`/`layout.grid-3`/`layout.columns` — structural grid items whose
   * column count also drives real child-slot creation/removal (`syncLayoutGridSlotChildren`),
   * so it can't sensibly vary per breakpoint (the same DOM children serve every viewport).
   * The "Columns" control always writes the base (unprefixed) utility for these, regardless of
   * which breakpoint tab is active — see the bug note on `applyGridCols` below.
   */
  isStructuralGrid?: boolean;
};

/** Test-only render counter — reset via `resetInspectorVisualStylePanelRenderCount()` in tests. */
export const inspectorVisualStylePanelRenderMetrics = { count: 0 };

export const resetInspectorVisualStylePanelRenderCount = (): void => {
  inspectorVisualStylePanelRenderMetrics.count = 0;
};

const areHighlightedFieldKeysEqual = (
  prev: ReadonlySet<string> | undefined,
  next: ReadonlySet<string> | undefined,
): boolean => {
  if (prev === next) {
    return true;
  }
  if (!prev || !next) {
    return false;
  }
  if (prev.size !== next.size) {
    return false;
  }
  for (const key of prev) {
    if (!next.has(key)) {
      return false;
    }
  }
  return true;
};

const areInspectorVisualStylePanelPropsEqual = (
  prev: InspectorVisualStylePanelProps,
  next: InspectorVisualStylePanelProps,
): boolean =>
  prev.className === next.className
  && prev.styleValue === next.styleValue
  && prev.breakpoint === next.breakpoint
  && prev.showContainerLayout === next.showContainerLayout
  && prev.isStructuralGrid === next.isStructuralGrid
  && prev.onBreakpointChange === next.onBreakpointChange
  && prev.onClassNameChange === next.onClassNameChange
  && prev.onStyleChange === next.onStyleChange
  && areHighlightedFieldKeysEqual(prev.highlightedFieldKeys, next.highlightedFieldKeys);

const tailwindField = (key: string): TailwindInspectorField => {
  const field = TAILWIND_INSPECTOR_FIELDS.find((entry) => entry.key === key);
  if (!field) {
    throw new Error(`Missing Tailwind inspector field: ${key}`);
  }
  return field;
};

const FLEX_DIRECTION_FIELD = tailwindField('twFlexDirection');
const ITEMS_FIELD = tailwindField('twItems');
const JUSTIFY_FIELD = tailwindField('twJustify');
const DISPLAY_FIELD = tailwindField('twDisplay');
const POSITION_FIELD = tailwindField('twPosition');
const OVERFLOW_FIELD = tailwindField('twOverflow');
const GRID_COLS_FIELD = tailwindField('twGridCols');
const WIDTH_FIELD = tailwindField('twWidth');
const HEIGHT_FIELD = tailwindField('twHeight');

const POSITION_OPTIONS = (POSITION_FIELD.options ?? [])
  .filter((option) => option.value.length > 0)
  .map((option) => ({ value: option.value, label: option.label }));

const OVERFLOW_OPTIONS = (OVERFLOW_FIELD.options ?? [])
  .filter((option) => option.value.length > 0)
  .map((option) => ({ value: option.value, label: option.label }));

/** Matches the plain `w-[…]`/`h-[…]` (or min-/max- variant) arbitrary-value utilities the custom
 * size input reads from and writes to — e.g. `w-[320px]` <-> the raw value `320px`. */
const CUSTOM_SIZE_UTILITY_PATTERN = /^(?:w|h|min-w|min-h|max-w|max-h)-\[(.+)\]$/;

const extractCustomSizeValue = (utility: string): string => {
  const match = utility.match(CUSTOM_SIZE_UTILITY_PATTERN);
  return match ? match[1] : '';
};

const SIZE_KEYWORD_UTILITIES = new Set(['full', 'auto', 'screen', 'min', 'max', 'fit']);

/**
 * Accepts messy typed size values and maps them to a Tailwind utility:
 * `320` / `320 px` → `w-[320px]`, `50%` → `w-[50%]`, `full` → `w-full`, presets unchanged.
 */
export const normalizeSizeInputToUtility = (
  raw: string,
  axis: 'w' | 'h',
  presetValues: ReadonlySet<string>,
): string => {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || /^(none|\(none\)|-)$/i.test(trimmed)) {
    return '';
  }

  if (presetValues.has(trimmed)) {
    return trimmed;
  }

  const collapsed = trimmed.replace(/\s+/g, '');
  if (presetValues.has(collapsed)) {
    return collapsed;
  }

  // Already a width/height family utility (including arbitrary brackets).
  if (/^(?:min-|max-)?[wh]-/i.test(collapsed)) {
    return collapsed;
  }

  const lower = collapsed.toLowerCase();
  if (SIZE_KEYWORD_UTILITIES.has(lower)) {
    return `${axis}-${lower}`;
  }

  if (/^\d+\/\d+$/.test(collapsed)) {
    return `${axis}-${collapsed}`;
  }

  if (collapsed === '100%') {
    return `${axis}-full`;
  }

  // "320", "320px", "320 px", "50 %", "1.5 rem"
  const spaced = trimmed.match(/^(\d+(?:\.\d+)?)\s*(px|%|rem|em|vh|vw|svh|lvh|dvh|ch|ex)?$/i);
  if (spaced) {
    const unit = (spaced[2] ?? 'px').toLowerCase();
    return `${axis}-[${spaced[1]}${unit}]`;
  }

  // Any other CSS-ish token → arbitrary value.
  return `${axis}-[${collapsed}]`;
};

export const sizeUtilityToComboboxDisplay = (
  utility: string,
  presetValues: ReadonlySet<string>,
): string => {
  if (!utility) {
    return '';
  }
  if (presetValues.has(utility)) {
    return utility;
  }
  return extractCustomSizeValue(utility) || utility;
};

const FLEX_WRAP_PATTERN = /^(?:[a-z0-9-]+:)?flex-wrap$/;

type DisplayLayoutFamily = 'flex' | 'grid' | 'other' | 'none';

/** Single select — matches Figma/Webflow (one Display control, not two segmented rows). */
const DISPLAY_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'block', label: 'Block' },
  { value: 'inline', label: 'Inline' },
  { value: 'inline-block', label: 'Inline Block' },
  { value: 'flex', label: 'Flex' },
  { value: 'inline-flex', label: 'Inline Flex' },
  { value: 'grid', label: 'Grid' },
  { value: 'inline-grid', label: 'Inline Grid' },
  { value: 'hidden', label: 'Hidden' },
] as const;

// Bug found: this capped at 6 while the underlying twGridCols field/CSS safelist (src/index.css)
// both support the full 1-12 range Tailwind's grid-cols-N utility offers — 7-12 were completely
// unreachable from this Style panel, the only place "Columns" is actually editable.
const GRID_COL_PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const resolveDisplayFamily = (display: string): DisplayLayoutFamily => {
  if (display === 'flex' || display === 'inline-flex') {
    return 'flex';
  }
  if (display === 'grid' || display === 'inline-grid') {
    return 'grid';
  }
  return 'other';
};

const isFlexDisplayValue = (display: string): boolean =>
  display === 'flex' || display === 'inline-flex';

const isGridDisplayValue = (display: string): boolean =>
  display === 'grid' || display === 'inline-grid';

const readUtility = (
  className: string,
  field: TailwindInspectorField,
  breakpoint: BreakpointPrefix,
): string => resolveResponsiveTailwindUtilityValue(className, field, breakpoint)
  .replace(/^(?:md:|lg:)/, '')
  .replace(/^!/, '');

const writeUtility = (
  className: string,
  field: TailwindInspectorField,
  value: string,
  breakpoint: BreakpointPrefix,
): string => applyResponsiveTailwindUtility(className, field, value, breakpoint);

const hasFlexWrap = (className: string, breakpoint: BreakpointPrefix): boolean => {
  const tokens = className.trim().split(/\s+/).filter(Boolean);
  return tokens.some((token) => {
    if (breakpoint) {
      return token === `${breakpoint}flex-wrap`;
    }
    return token === 'flex-wrap';
  });
};

const toggleFlexWrap = (className: string, breakpoint: BreakpointPrefix, enabled: boolean): string => {
  const tokens = className.trim().split(/\s+/).filter(Boolean).filter((token) => {
    if (breakpoint) {
      return !(token.startsWith(breakpoint) && FLEX_WRAP_PATTERN.test(token));
    }
    return !(!token.includes(':') && FLEX_WRAP_PATTERN.test(token));
  });
  if (enabled) {
    tokens.push(breakpoint ? `${breakpoint}flex-wrap` : 'flex-wrap');
  }
  return tokens.join(' ');
};

/** Prefer keeping inline-flex / inline-grid when already set; otherwise write the base mode. */
const ensureDisplayFamily = (
  className: string,
  family: 'flex' | 'grid',
  breakpoint: BreakpointPrefix,
): string => {
  const current = readUtility(className, DISPLAY_FIELD, breakpoint);
  if (family === 'flex' && isFlexDisplayValue(current)) {
    return className;
  }
  if (family === 'grid' && isGridDisplayValue(current)) {
    return className;
  }
  return writeUtility(className, DISPLAY_FIELD, family, breakpoint);
};

const stripFlexLayoutUtilities = (className: string, breakpoint: BreakpointPrefix): string => {
  let next = writeUtility(className, FLEX_DIRECTION_FIELD, '', breakpoint);
  next = toggleFlexWrap(next, breakpoint, false);
  return next;
};

const stripGridLayoutUtilities = (className: string, breakpoint: BreakpointPrefix): string =>
  writeUtility(className, GRID_COLS_FIELD, '', breakpoint);

/**
 * Resolve which layout sub-panel to show. Prefer explicit display; fall back to
 * utilities already on the className so orphaned flex-row / grid-cols stay editable.
 */
const resolveEffectiveLayoutFamily = (
  className: string,
  breakpoint: BreakpointPrefix,
): { display: string; family: DisplayLayoutFamily; inferred: boolean } => {
  const display = readUtility(className, DISPLAY_FIELD, breakpoint);
  const explicit = resolveDisplayFamily(display);
  if (explicit !== 'other') {
    return { display, family: explicit, inferred: false };
  }
  const flexDirection = readUtility(className, FLEX_DIRECTION_FIELD, breakpoint);
  if (flexDirection || hasFlexWrap(className, breakpoint)) {
    return { display, family: 'flex', inferred: true };
  }
  const gridCols = readUtility(className, GRID_COLS_FIELD, breakpoint);
  if (gridCols) {
    return { display, family: 'grid', inferred: true };
  }
  return { display, family: 'none', inferred: false };
};

/** Breakpoint cascade for reading inherited Tailwind values (mobile → tablet → desktop). */
const cascadePrefixesFor = (breakpoint: BreakpointPrefix): BreakpointPrefix[] => {
  if (breakpoint === 'lg:') {
    return ['', 'md:', 'lg:'];
  }
  if (breakpoint === 'md:') {
    return ['', 'md:'];
  }
  return [''];
};

/**
 * Effective layout family at the active Style breakpoint, including inheritance from
 * smaller breakpoints (so Desktop tab still shows Flex controls when only base `flex` exists).
 */
const resolveCascadedLayoutFamily = (
  className: string,
  breakpoint: BreakpointPrefix,
): { display: string; family: DisplayLayoutFamily; inferred: boolean } => {
  const prefixes = cascadePrefixesFor(breakpoint);
  let resolved = resolveEffectiveLayoutFamily(className, '');
  for (const prefix of prefixes) {
    const atPrefix = resolveEffectiveLayoutFamily(className, prefix);
    if (atPrefix.family !== 'none') {
      resolved = atPrefix;
    }
  }
  return resolved;
};

/** Read the winning utility at `breakpoint`, falling back through the mobile-first cascade. */
const readCascadedUtility = (
  className: string,
  field: TailwindInspectorField,
  breakpoint: BreakpointPrefix,
): string => {
  let winner = '';
  for (const prefix of cascadePrefixesFor(breakpoint)) {
    const value = readUtility(className, field, prefix);
    if (value) {
      winner = value;
    }
  }
  return winner;
};

type AlignCell = {
  justify: 'justify-start' | 'justify-center' | 'justify-end';
  items: 'items-start' | 'items-center' | 'items-end';
  label: string;
};

const ALIGN_GRID: AlignCell[] = [
  { justify: 'justify-start', items: 'items-start', label: 'Top start' },
  { justify: 'justify-center', items: 'items-start', label: 'Top center' },
  { justify: 'justify-end', items: 'items-start', label: 'Top end' },
  { justify: 'justify-start', items: 'items-center', label: 'Center start' },
  { justify: 'justify-center', items: 'items-center', label: 'Center' },
  { justify: 'justify-end', items: 'items-center', label: 'Center end' },
  { justify: 'justify-start', items: 'items-end', label: 'Bottom start' },
  { justify: 'justify-center', items: 'items-end', label: 'Bottom center' },
  { justify: 'justify-end', items: 'items-end', label: 'Bottom end' },
];

const iconButtonClass = (active: boolean): string =>
  [
    'inline-flex h-7 w-7 items-center justify-center rounded-md border text-slate-600 transition-colors',
    active
      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
  ].join(' ');

const segmentOptionClass = (active: boolean): string =>
  active ? INSPECTOR_SEGMENTED_OPTION_ACTIVE_CLASS : INSPECTOR_SEGMENTED_OPTION_INACTIVE_CLASS;

const trackSegmentOptionClass = (active: boolean): string =>
  [
    'inline-flex h-7 w-7 items-center justify-center transition-colors',
    active
      ? 'bg-white text-indigo-700 shadow-sm'
      : 'text-slate-500 hover:bg-white/80 hover:text-slate-700',
  ].join(' ');

const alignCellClass = (active: boolean): string =>
  [
    'inline-flex h-5 w-5 items-center justify-center rounded-[3px] transition-colors',
    active
      ? 'bg-white text-indigo-700 shadow-sm'
      : 'text-slate-400 hover:bg-white/80 hover:text-slate-600',
  ].join(' ');

const linkButtonClass = (linked: boolean): string =>
  [
    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors',
    linked
      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700',
  ].join(' ');

const StyleSectionCard: React.FC<{
  title: string;
  hint?: string;
  divided?: boolean;
  ink?: 'accent' | 'complement' | 'contrast';
  children: React.ReactNode;
}> = ({
  title,
  hint,
  divided = false,
  ink = 'accent',
  children,
}) => (
  <FormSection title={title} hint={hint} divided={divided} ink={ink}>
    <div className="space-y-2">{children}</div>
  </FormSection>
);

const highlightWrap = (key: string, highlightedFieldKeys: ReadonlySet<string> | undefined, children: React.ReactNode) => {
  const isHighlighted = highlightedFieldKeys?.has(key) === true;
  return (
    <div
      data-inspector-field={key}
      data-inspector-field-match={isHighlighted ? 'true' : undefined}
      className={isHighlighted ? INSPECTOR_FIELD_HIGHLIGHT_CLASS : undefined}
    >
      {children}
    </div>
  );
};

const SPACING_SIDE_ORDER: readonly SpacingSide[] = ['top', 'right', 'bottom', 'left'];
const SPACING_SIDE_SHORT: Record<SpacingSide, string> = {
  top: 'T',
  right: 'R',
  bottom: 'B',
  left: 'L',
};

type SpacingSideInputProps = {
  kind: SpacingKind;
  side: SpacingSide;
  value: number | 'auto' | null;
  locked: boolean;
  onChange: (side: SpacingSide, next: number | null) => void;
};

const SpacingSideInput: React.FC<SpacingSideInputProps> = ({ kind, side, value, locked, onChange }) => {
  const display = value === null || value === 'auto' ? '' : String(value);
  return (
    <input
      type="number"
      step={0.5}
      min={0}
      aria-label={`${kind} ${side}`}
      disabled={locked && side !== 'top'}
      placeholder={SPACING_SIDE_SHORT[side]}
      className={[
        `h-7 min-w-0 flex-1 px-0.5 text-center ${INSPECTOR_TEXT_2XS} font-semibold tabular-nums text-slate-700 outline-none`,
        'border-0 bg-transparent placeholder:font-medium placeholder:text-slate-400/90',
        'focus:bg-white focus:ring-1 focus:ring-inset focus:ring-indigo-300/70',
        'disabled:cursor-default disabled:opacity-60',
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
      ].join(' ')}
      value={display}
      onChange={(event) => {
        const raw = event.target.value.trim();
        if (raw.length === 0) {
          onChange(side, null);
          return;
        }
        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) {
          return;
        }
        onChange(side, snapToTailwindSpacingScale(numeric));
      }}
    />
  );
};

type SpacingSidesLinkProps = {
  label: string;
  locked: boolean;
  onLockedChange: (locked: boolean) => void;
  sides: SpacingSides;
  onSidesChange: (sides: SpacingSides) => void;
};

const SpacingSidesLink: React.FC<SpacingSidesLinkProps> = ({
  label,
  locked,
  onLockedChange,
  sides,
  onSidesChange,
}) => (
  <button
    type="button"
    className={linkButtonClass(locked)}
    aria-label={locked ? `Unlock ${label} sides` : `Lock ${label} sides`}
    title={locked ? 'Sides linked' : 'Link all sides'}
    onClick={() => {
      const nextLocked = !locked;
      onLockedChange(nextLocked);
      if (nextLocked) {
        const seed = sides.top ?? sides.right ?? sides.bottom ?? sides.left ?? 0;
        onSidesChange(setAllSpacingSides(seed));
      }
    }}
  >
    {locked
      ? <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
      : <Unlink2 className="h-3.5 w-3.5" strokeWidth={2} />}
  </button>
);

type SpacingRowProps = {
  kind: 'padding' | 'margin';
  fieldKey: 'twPadding' | 'twMargin';
  sides: SpacingSides;
  locked: boolean;
  onLockedChange: (locked: boolean) => void;
  onSidesChange: (sides: SpacingSides) => void;
  highlightedFieldKeys?: ReadonlySet<string>;
};

const SpacingRow: React.FC<SpacingRowProps> = ({
  kind,
  fieldKey,
  sides,
  locked,
  onLockedChange,
  onSidesChange,
  highlightedFieldKeys,
}) => {
  const label = kind === 'padding' ? 'Padding' : 'Margin';
  const handleSideChange = (side: SpacingSide, next: number | null) => {
    if (locked) {
      onSidesChange(setAllSpacingSides(next));
      return;
    }
    onSidesChange({ ...sides, [side]: next });
  };

  return highlightWrap(
    fieldKey,
    highlightedFieldKeys,
    <DesignerFieldRow label={label}>
      <div className="flex min-w-0 items-center gap-1">
        <div
          role="group"
          aria-label={`${label} sides`}
          className={`flex min-w-0 flex-1 overflow-hidden rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white divide-x divide-slate-200`}
        >
          {SPACING_SIDE_ORDER.map((side) => (
            <SpacingSideInput
              key={side}
              kind={kind}
              side={side}
              value={sides[side]}
              locked={locked}
              onChange={handleSideChange}
            />
          ))}
        </div>
        <SpacingSidesLink
          label={label}
          locked={locked}
          onLockedChange={onLockedChange}
          sides={sides}
          onSidesChange={onSidesChange}
        />
      </div>
    </DesignerFieldRow>,
  );
};

type SpacingRowsProps = {
  paddingSides: SpacingSides;
  marginSides: SpacingSides;
  paddingLocked: boolean;
  marginLocked: boolean;
  onPaddingLockedChange: (locked: boolean) => void;
  onMarginLockedChange: (locked: boolean) => void;
  onPaddingChange: (sides: SpacingSides) => void;
  onMarginChange: (sides: SpacingSides) => void;
  highlightedFieldKeys?: ReadonlySet<string>;
};

const SpacingRows: React.FC<SpacingRowsProps> = ({
  paddingSides,
  marginSides,
  paddingLocked,
  marginLocked,
  onPaddingLockedChange,
  onMarginLockedChange,
  onPaddingChange,
  onMarginChange,
  highlightedFieldKeys,
}) => (
  <div className="space-y-2">
    <SpacingRow
      kind="margin"
      fieldKey="twMargin"
      sides={marginSides}
      locked={marginLocked}
      onLockedChange={onMarginLockedChange}
      onSidesChange={onMarginChange}
      highlightedFieldKeys={highlightedFieldKeys}
    />
    <SpacingRow
      kind="padding"
      fieldKey="twPadding"
      sides={paddingSides}
      locked={paddingLocked}
      onLockedChange={onPaddingLockedChange}
      onSidesChange={onPaddingChange}
      highlightedFieldKeys={highlightedFieldKeys}
    />
  </div>
);

const TEXT_SIZE_OPTIONS = (TEXT_SIZE_FIELD.options ?? []).filter((option) => option.value.length > 0);
const WIDTH_OPTIONS = WIDTH_FIELD.options ?? [];
const HEIGHT_OPTIONS = HEIGHT_FIELD.options ?? [];
const WIDTH_PRESET_VALUES = new Set(WIDTH_OPTIONS.map((option) => option.value));
const HEIGHT_PRESET_VALUES = new Set(HEIGHT_OPTIONS.map((option) => option.value));

const toSizeComboboxItems = (options: readonly { value: string; label: string }[]): UiComboboxItem[] =>
  options.map((option) => ({
    id: option.value,
    textValue: option.label || option.value || '(none)',
  }));

const WIDTH_COMBO_ITEMS = toSizeComboboxItems(WIDTH_OPTIONS);
const HEIGHT_COMBO_ITEMS = toSizeComboboxItems(HEIGHT_OPTIONS);

type SizeComboboxProps = {
  ariaLabel: string;
  axis: 'w' | 'h';
  utility: string;
  presetValues: ReadonlySet<string>;
  items: readonly UiComboboxItem[];
  onApplyUtility: (utility: string) => void;
};

/** Writable preset + freeform size field — dropdown helps, typing accepts messy values. */
const SizeCombobox: React.FC<SizeComboboxProps> = ({
  ariaLabel,
  axis,
  utility,
  presetValues,
  items,
  onApplyUtility,
}) => {
  const displayFromUtility = sizeUtilityToComboboxDisplay(utility, presetValues);
  const [draft, setDraft] = React.useState(displayFromUtility);

  React.useEffect(() => {
    setDraft(displayFromUtility);
  }, [displayFromUtility]);

  const commit = React.useCallback((raw: string) => {
    const nextUtility = normalizeSizeInputToUtility(raw, axis, presetValues);
    onApplyUtility(nextUtility);
    setDraft(sizeUtilityToComboboxDisplay(nextUtility, presetValues));
  }, [axis, onApplyUtility, presetValues]);

  return (
    <UiCombobox
      size="sm"
      ariaLabel={ariaLabel}
      autoDir={false}
      allowCustomValue
      menuTrigger="focus"
      placeholder="full, 320, 50%…"
      value={draft}
      items={items}
      onInputValueChange={setDraft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (presetValues.has(next) || next.trim().length === 0) {
          commit(next);
        }
      }}
      onBlur={() => commit(draft)}
    />
  );
};

const AlignIcon: React.FC<{ value: string; mirrored: boolean }> = ({ value, mirrored }) => {
  const className = [
    'h-3.5 w-3.5',
    mirrored ? '-scale-x-100' : '',
  ].filter(Boolean).join(' ');
  if (value === 'text-center') {
    return <AlignCenter className={className} strokeWidth={1.75} />;
  }
  if (value === 'text-right') {
    return <AlignRight className={className} strokeWidth={1.75} />;
  }
  if (value === 'text-justify') {
    return <AlignJustify className={className} strokeWidth={1.75} />;
  }
  return <AlignLeft className={className} strokeWidth={1.75} />;
};

type PreviewSelectOption = {
  value: string;
  label: string;
};

type PreviewSelectProps = {
  ariaLabel: string;
  value: string;
  options: readonly PreviewSelectOption[];
  emptyLabel?: string;
  renderOptionPreview: (option: PreviewSelectOption) => React.ReactNode;
  onChange: (value: string) => void;
};

const PreviewSelect: React.FC<PreviewSelectProps> = ({
  ariaLabel,
  value,
  options,
  emptyLabel = '(none)',
  renderOptionPreview,
  onChange,
}) => {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`flex h-8 w-full items-center justify-between gap-2 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white px-2 text-left ${INSPECTOR_TEXT_XS} text-slate-700 hover:border-slate-300`}
        onClick={() => setOpen((previous) => !previous)}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected ? renderOptionPreview(selected) : (
            <span className="text-slate-400">{emptyLabel}</span>
          )}
          {selected ? <span className="truncate text-slate-600">{selected.label}</span> : null}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
      </button>
      {open ? (
        <div className={`absolute inset-x-0 z-20 mt-1 max-h-48 overflow-auto rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white py-1 shadow-md`}>
          <button
            type="button"
            className={`flex w-full items-center gap-2 px-2 py-1.5 text-left ${INSPECTOR_TEXT_XS} hover:bg-slate-50 ${value === '' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            {emptyLabel}
          </button>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left ${INSPECTOR_TEXT_XS} hover:bg-slate-50 ${value === option.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {renderOptionPreview(option)}
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const InspectorVisualStylePanelInner: React.FC<InspectorVisualStylePanelProps> = ({
  className,
  styleValue = '',
  breakpoint,
  onBreakpointChange,
  onClassNameChange,
  onStyleChange,
  highlightedFieldKeys,
  showContainerLayout = true,
  isStructuralGrid = false,
}) => {
  inspectorVisualStylePanelRenderMetrics.count += 1;

  const culture = useOptionalCulture();
  const isRtl = culture?.direction === 'rtl'
    || (typeof document !== 'undefined' && document.documentElement.getAttribute('dir') === 'rtl');

  const {
    display,
    position,
    overflow,
    layoutFamily,
    layoutInferred,
    flexDirection,
    items,
    justify,
    wrapEnabled,
    gridCols,
    textSize,
    fontWeight,
    textAlign,
    rounded,
    shadow,
    width,
    height,
    opacityPercent,
    paddingSides,
    marginSides,
    gapValue,
  } = React.useMemo(() => {
    const layout = resolveCascadedLayoutFamily(className, breakpoint);
    return {
      // Cascaded reads so Desktop/Tablet tabs reflect inherited mobile styles in the UI,
      // while writes still target the active breakpoint prefix.
      display: readCascadedUtility(className, DISPLAY_FIELD, breakpoint),
      position: readCascadedUtility(className, POSITION_FIELD, breakpoint),
      overflow: readCascadedUtility(className, OVERFLOW_FIELD, breakpoint),
      layoutFamily: layout.family,
      layoutInferred: layout.inferred,
      flexDirection: readCascadedUtility(className, FLEX_DIRECTION_FIELD, breakpoint),
      items: readCascadedUtility(className, ITEMS_FIELD, breakpoint),
      justify: readCascadedUtility(className, JUSTIFY_FIELD, breakpoint),
      wrapEnabled: cascadePrefixesFor(breakpoint).some((prefix) => hasFlexWrap(className, prefix)),
      gridCols: readCascadedUtility(className, GRID_COLS_FIELD, breakpoint),
      textSize: readCascadedUtility(className, TEXT_SIZE_FIELD, breakpoint),
      fontWeight: readCascadedUtility(className, FONT_WEIGHT_FIELD, breakpoint),
      textAlign: readCascadedUtility(className, TEXT_ALIGN_FIELD, breakpoint),
      rounded: readCascadedUtility(className, ROUNDED_FIELD, breakpoint),
      shadow: readCascadedUtility(className, SHADOW_FIELD, breakpoint),
      width: readCascadedUtility(className, WIDTH_FIELD, breakpoint),
      height: readCascadedUtility(className, HEIGHT_FIELD, breakpoint),
      opacityPercent: (() => {
        let winner: number | null = null;
        for (const prefix of cascadePrefixesFor(breakpoint)) {
          const value = parseOpacityClassName(className, prefix);
          if (value !== null) {
            winner = value;
          }
        }
        return winner;
      })(),
      paddingSides: (() => {
        let winner = parseSpacingClassName(className, 'padding', '');
        for (const prefix of cascadePrefixesFor(breakpoint)) {
          const value = parseSpacingClassName(className, 'padding', prefix);
          if (Object.values(value).some((side) => side !== null)) {
            winner = value;
          }
        }
        return winner;
      })(),
      marginSides: (() => {
        let winner = parseSpacingClassName(className, 'margin', '');
        for (const prefix of cascadePrefixesFor(breakpoint)) {
          const value = parseSpacingClassName(className, 'margin', prefix);
          if (Object.values(value).some((side) => side !== null)) {
            winner = value;
          }
        }
        return winner;
      })(),
      gapValue: (() => {
        let winner: ReturnType<typeof parseGapClassName> = null;
        for (const prefix of cascadePrefixesFor(breakpoint)) {
          const value = parseGapClassName(className, prefix);
          if (value !== null) {
            winner = value;
          }
        }
        return winner;
      })(),
    };
  }, [className, breakpoint]);

  const [paddingLocked, setPaddingLocked] = React.useState(() => areSpacingSidesUniform(paddingSides) || (
    paddingSides.top === null && paddingSides.right === null && paddingSides.bottom === null && paddingSides.left === null
  ));
  const [marginLocked, setMarginLocked] = React.useState(() => areSpacingSidesUniform(marginSides) || (
    marginSides.top === null && marginSides.right === null && marginSides.bottom === null && marginSides.left === null
  ));

  const [roundedCustomMode, setRoundedCustomMode] = React.useState(
    () => rounded.length > 0 && !isRoundedPreset(rounded),
  );
  const [shadowCustomMode, setShadowCustomMode] = React.useState(
    () => shadow.length > 0 && !isShadowPreset(shadow),
  );

  // Re-sync link state when the authored className / breakpoint changes (node switch or
  // external edit). Do not depend on sides alone — unlocking while values are still uniform
  // must not immediately re-lock.
  React.useEffect(() => {
    setPaddingLocked(areSpacingSidesUniform(paddingSides) || (
      paddingSides.top === null && paddingSides.right === null && paddingSides.bottom === null && paddingSides.left === null
    ));
    setMarginLocked(areSpacingSidesUniform(marginSides) || (
      marginSides.top === null && marginSides.right === null && marginSides.bottom === null && marginSides.left === null
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: re-derive only from class source
  }, [className, breakpoint]);

  React.useEffect(() => {
    if (rounded.length > 0 && !isRoundedPreset(rounded)) {
      setRoundedCustomMode(true);
    }
  }, [rounded]);

  React.useEffect(() => {
    if (shadow.length > 0 && !isShadowPreset(shadow)) {
      setShadowCustomMode(true);
    }
  }, [shadow]);

  const applySpacing = React.useCallback((kind: SpacingKind, sides: SpacingSides) => {
    const encoded = encodeSpacingClassName(sides, kind, breakpoint);
    onClassNameChange(applySpacingToClassName(className, kind, encoded, breakpoint));
  }, [breakpoint, className, onClassNameChange]);

  const applyGap = React.useCallback((next: number | null) => {
    let nextClassName = className;
    if (layoutFamily === 'flex') {
      nextClassName = ensureDisplayFamily(nextClassName, 'flex', breakpoint);
    } else if (layoutFamily === 'grid') {
      nextClassName = ensureDisplayFamily(nextClassName, 'grid', breakpoint);
    }
    const encoded = encodeGapClassName(next, breakpoint);
    onClassNameChange(applySpacingToClassName(nextClassName, 'gap', encoded, breakpoint));
  }, [breakpoint, className, layoutFamily, onClassNameChange]);

  const applyUtility = React.useCallback((field: TailwindInspectorField, value: string) => {
    onClassNameChange(writeUtility(className, field, value, breakpoint));
  }, [breakpoint, className, onClassNameChange]);

  const applyDisplay = React.useCallback((nextDisplay: string) => {
    const previousFamily = resolveDisplayFamily(display);
    const nextFamily = resolveDisplayFamily(nextDisplay);
    let next = writeUtility(className, DISPLAY_FIELD, nextDisplay, breakpoint);
    if (previousFamily === 'flex' && nextFamily !== 'flex') {
      next = stripFlexLayoutUtilities(next, breakpoint);
    }
    if (previousFamily === 'grid' && nextFamily !== 'grid') {
      next = stripGridLayoutUtilities(next, breakpoint);
    }
    onClassNameChange(next);
  }, [breakpoint, className, display, onClassNameChange]);

  const applyFlexDirection = React.useCallback((value: string) => {
    let next = ensureDisplayFamily(className, 'flex', breakpoint);
    next = writeUtility(next, FLEX_DIRECTION_FIELD, value, breakpoint);
    onClassNameChange(next);
  }, [breakpoint, className, onClassNameChange]);

  const applyFlexWrap = React.useCallback((enabled: boolean) => {
    let next = ensureDisplayFamily(className, 'flex', breakpoint);
    next = toggleFlexWrap(next, breakpoint, enabled);
    onClassNameChange(next);
  }, [breakpoint, className, onClassNameChange]);

  const applyFlexAlign = React.useCallback((nextJustify: string, nextItems: string) => {
    let next = ensureDisplayFamily(className, layoutFamily === 'grid' ? 'grid' : 'flex', breakpoint);
    next = writeUtility(next, JUSTIFY_FIELD, nextJustify, breakpoint);
    next = writeUtility(next, ITEMS_FIELD, nextItems, breakpoint);
    onClassNameChange(next);
  }, [breakpoint, className, layoutFamily, onClassNameChange]);

  const applyGridCols = React.useCallback((cols: number) => {
    // Bug found: for structural grid items (layout.grid-2/grid-3/columns), column count also
    // drives real child-slot add/remove (syncLayoutGridNodeColumnSizing/syncLayoutGridSlotChildren
    // in the reducer) — that sync always resolves the count from the *base* utility and discards
    // any breakpoint-prefixed one, so writing e.g. `lg:grid-cols-4` while the Desktop breakpoint
    // tab was active (the panel's default tab) got silently stripped back to the old base value
    // on every click, making the Columns control look completely dead. Always write the base
    // utility for these items regardless of the active breakpoint tab.
    const effectiveBreakpoint = isStructuralGrid ? '' : breakpoint;
    let next = ensureDisplayFamily(className, 'grid', effectiveBreakpoint);
    next = writeUtility(next, GRID_COLS_FIELD, `grid-cols-${cols}`, effectiveBreakpoint);
    onClassNameChange(next);
  }, [breakpoint, className, isStructuralGrid, onClassNameChange]);

  const applyOpacity = React.useCallback((percent: number | null) => {
    const encoded = encodeOpacityClassName(percent);
    onClassNameChange(writeUtility(className, OPACITY_FIELD, encoded, breakpoint));
  }, [breakpoint, className, onClassNameChange]);

  const showFlexControls = showContainerLayout && layoutFamily === 'flex';
  const showGridControls = showContainerLayout && layoutFamily === 'grid';
  const showSharedLayoutControls = showFlexControls || showGridControls;
  const gridColsCount = (() => {
    const match = gridCols.match(/^grid-cols-(\d+)$/);
    return match ? Number(match[1]) : null;
  })();

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between gap-2 px-0.5 py-1">
        <InspectorMicroLabel className="uppercase tracking-wider">Breakpoint</InspectorMicroLabel>
        <div className={INSPECTOR_SEGMENTED_CONTROL_CLASS} role="group" aria-label="Style breakpoint">
          {DESIGNER_STYLE_BREAKPOINTS.map((option) => {
            const active = breakpoint === option.prefix;
            return (
              <button
                key={option.id}
                type="button"
                className={segmentOptionClass(active)}
                onClick={() => onBreakpointChange(option.prefix)}
                title={option.title}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <StyleSectionCard title="Layout" ink="accent">
          {highlightWrap('twDisplay', highlightedFieldKeys, (
            <DesignerFieldRow
              label="Display"
              hint={
                layoutInferred
                  ? 'Display inferred from layout classes — pick Flex or Grid to lock it in.'
                  : showContainerLayout && (layoutFamily === 'other' || layoutFamily === 'none')
                    ? 'Choose Flex or Grid to edit direction, align, gap, and columns.'
                    : undefined
              }
            >
              <PreviewSelect
                ariaLabel="Display"
                value={display}
                emptyLabel="Default"
                options={DISPLAY_OPTIONS.filter((option) => option.value.length > 0)}
                renderOptionPreview={() => null}
                onChange={applyDisplay}
              />
            </DesignerFieldRow>
          ))}

          {highlightWrap('twPosition', highlightedFieldKeys, (
            <DesignerFieldRow label="Position">
              <PreviewSelect
                ariaLabel="Position"
                value={position}
                emptyLabel="Default"
                options={POSITION_OPTIONS}
                renderOptionPreview={() => null}
                onChange={(value) => applyUtility(POSITION_FIELD, value)}
              />
            </DesignerFieldRow>
          ))}

          {highlightWrap('twOverflow', highlightedFieldKeys, (
            <DesignerFieldRow label="Overflow">
              <PreviewSelect
                ariaLabel="Overflow"
                value={overflow}
                emptyLabel="Default"
                options={OVERFLOW_OPTIONS}
                renderOptionPreview={() => null}
                onChange={(value) => applyUtility(OVERFLOW_FIELD, value)}
              />
            </DesignerFieldRow>
          ))}

          {showFlexControls ? (
            highlightWrap('twFlexDirection', highlightedFieldKeys, (
              <DesignerFieldRow label="Direction">
                <div className={`inline-flex rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-100 p-0.5`} role="group" aria-label="Flex layout">
                  <button
                    type="button"
                    className={trackSegmentOptionClass(flexDirection === 'flex-col')}
                    aria-label="Flex column"
                    title="Column"
                    onClick={() => applyFlexDirection('flex-col')}
                  >
                    <Rows2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    className={trackSegmentOptionClass(flexDirection === 'flex-row')}
                    aria-label="Flex row"
                    title="Row"
                    onClick={() => applyFlexDirection('flex-row')}
                  >
                    <Columns2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    className={trackSegmentOptionClass(wrapEnabled)}
                    aria-label="Flex wrap"
                    title="Wrap"
                    onClick={() => applyFlexWrap(!wrapEnabled)}
                  >
                    <WrapText className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </DesignerFieldRow>
            ))
          ) : null}

          {showGridControls ? (
            highlightWrap('twGridCols', highlightedFieldKeys, (
              <DesignerFieldRow label="Columns" align="start">
                <div className={`grid w-full grid-cols-6 gap-0.5 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-100 p-0.5`} role="group" aria-label="Grid columns">
                  {GRID_COL_PRESETS.map((cols) => (
                    <button
                      key={cols}
                      type="button"
                      className={[
                        `inline-flex h-7 items-center justify-center rounded-md ${INSPECTOR_TEXT_2XS} font-semibold tabular-nums transition-colors`,
                        gridColsCount === cols
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-500 hover:bg-white/80 hover:text-slate-700',
                      ].join(' ')}
                      aria-label={`${cols} columns`}
                      aria-pressed={gridColsCount === cols}
                      title={`${cols} columns`}
                      onClick={() => applyGridCols(cols)}
                    >
                      {cols}
                    </button>
                  ))}
                </div>
              </DesignerFieldRow>
            ))
          ) : null}

          {showSharedLayoutControls ? (
            <>
              <div
                data-inspector-field="twItems"
                data-inspector-field-match={highlightedFieldKeys?.has('twItems') || highlightedFieldKeys?.has('twJustify') ? 'true' : undefined}
                className={
                  highlightedFieldKeys?.has('twItems') || highlightedFieldKeys?.has('twJustify')
                    ? INSPECTOR_FIELD_HIGHLIGHT_CLASS
                    : undefined
                }
              >
                <span data-inspector-field="twJustify" className="sr-only">Justify Content</span>
                <DesignerFieldRow label="Align">
                  <div className={`grid grid-cols-3 gap-0.5 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-100 p-0.5`}>
                    {ALIGN_GRID.map((cell) => {
                      const active = justify === cell.justify && items === cell.items;
                      const justifyPos = cell.justify === 'justify-start' ? 'start' : cell.justify === 'justify-end' ? 'end' : 'center';
                      const itemsPos = cell.items === 'items-start' ? 'start' : cell.items === 'items-end' ? 'end' : 'center';
                      return (
                        <button
                          key={`${cell.justify}:${cell.items}`}
                          type="button"
                          className={alignCellClass(active)}
                          aria-label={cell.label}
                          title={cell.label}
                          onClick={() => applyFlexAlign(cell.justify, cell.items)}
                        >
                          <span
                            className="grid h-3 w-3"
                            style={{
                              placeItems: `${itemsPos} ${justifyPos}`,
                            }}
                          >
                            <span className={`h-1 w-1 rounded-[1px] ${active ? 'bg-indigo-600' : 'bg-slate-400'}`} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </DesignerFieldRow>
              </div>

              {highlightWrap('twGap', highlightedFieldKeys, (
                <DesignerFieldRow label="Gap">
                  <div className="w-full max-w-[5.5rem]">
                    <UiInput
                      size="sm"
                      type="number"
                      step={1}
                      min={0}
                      value={gapValue === null ? '' : String(gapValue)}
                      placeholder="—"
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        if (raw.length === 0) {
                          applyGap(null);
                          return;
                        }
                        const numeric = Number(raw);
                        if (!Number.isFinite(numeric)) {
                          return;
                        }
                        applyGap(snapToTailwindSpacingScale(numeric));
                      }}
                    />
                  </div>
                </DesignerFieldRow>
              ))}
            </>
          ) : null}
      </StyleSectionCard>

      <StyleSectionCard
        title="Spacing"
        ink="complement"
        divided
        hint="Top / Right / Bottom / Left on the Tailwind spacing scale. Use the link icon to edit all sides together."
      >
          <SpacingRows
            paddingSides={paddingSides}
            marginSides={marginSides}
            paddingLocked={paddingLocked}
            marginLocked={marginLocked}
            onPaddingLockedChange={setPaddingLocked}
            onMarginLockedChange={setMarginLocked}
            onPaddingChange={(sides) => applySpacing('padding', sides)}
            onMarginChange={(sides) => applySpacing('margin', sides)}
            highlightedFieldKeys={highlightedFieldKeys}
          />
      </StyleSectionCard>

      <StyleSectionCard title="Size" ink="contrast" divided>
          {highlightWrap('twWidth', highlightedFieldKeys, (
            <DesignerFieldRow label="Width">
              <SizeCombobox
                ariaLabel="Width"
                axis="w"
                utility={width}
                presetValues={WIDTH_PRESET_VALUES}
                items={WIDTH_COMBO_ITEMS}
                onApplyUtility={(utility) => applyUtility(WIDTH_FIELD, utility)}
              />
            </DesignerFieldRow>
          ))}

          {highlightWrap('twHeight', highlightedFieldKeys, (
            <DesignerFieldRow label="Height">
              <SizeCombobox
                ariaLabel="Height"
                axis="h"
                utility={height}
                presetValues={HEIGHT_PRESET_VALUES}
                items={HEIGHT_COMBO_ITEMS}
                onApplyUtility={(utility) => applyUtility(HEIGHT_FIELD, utility)}
              />
            </DesignerFieldRow>
          ))}
      </StyleSectionCard>

      <StyleSectionCard title="Typography" ink="accent" divided>
        {highlightWrap('twTextSize', highlightedFieldKeys, (
          <DesignerFieldRow label="Size">
            <PreviewSelect
              ariaLabel="Text size"
              value={textSize}
              options={TEXT_SIZE_OPTIONS}
              renderOptionPreview={(option) => (
                <span className={`leading-none text-slate-800 ${option.value}`} aria-hidden>
                  Aa
                </span>
              )}
              onChange={(value) => applyUtility(TEXT_SIZE_FIELD, value)}
            />
          </DesignerFieldRow>
        ))}

        {highlightWrap('twFontWeight', highlightedFieldKeys, (
          <DesignerFieldRow label="Weight">
            <div className="flex flex-wrap gap-1">
              {FONT_WEIGHT_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={[
                    `h-7 min-w-[3.25rem] rounded-md border px-1.5 ${INSPECTOR_TEXT_XS} transition-colors`,
                    preset.previewClass,
                    fontWeight === preset.value
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                  aria-label={preset.label}
                  title={preset.label}
                  onClick={() => applyUtility(FONT_WEIGHT_FIELD, fontWeight === preset.value ? '' : preset.value)}
                >
                  Aa
                </button>
              ))}
            </div>
          </DesignerFieldRow>
        ))}

        {highlightWrap('twTextAlign', highlightedFieldKeys, (
          <DesignerFieldRow label="Align">
            <div
              className={`inline-flex rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-100 p-0.5`}
              dir={isRtl ? 'rtl' : 'ltr'}
              data-align-rtl={isRtl ? 'true' : undefined}
            >
              {TEXT_ALIGN_PRESETS.map((preset) => {
                const mirrored = isRtl && preset.mirrorInRtl;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    className={trackSegmentOptionClass(textAlign === preset.value)}
                    aria-label={preset.label}
                    title={preset.label}
                    data-align-value={preset.value}
                    data-align-mirrored={mirrored ? 'true' : undefined}
                    onClick={() => applyUtility(TEXT_ALIGN_FIELD, textAlign === preset.value ? '' : preset.value)}
                  >
                    <AlignIcon value={preset.value} mirrored={mirrored} />
                  </button>
                );
              })}
            </div>
          </DesignerFieldRow>
        ))}
      </StyleSectionCard>

      <StyleSectionCard title="Appearance" ink="complement" divided>
        {highlightWrap('twRounded', highlightedFieldKeys, (
          <DesignerFieldRow label="Rounded">
            <div className="flex flex-wrap gap-1">
              {ROUNDED_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={iconButtonClass(rounded === preset.value)}
                  aria-label={preset.label}
                  title={preset.label}
                  onClick={() => applyUtility(ROUNDED_FIELD, rounded === preset.value ? '' : preset.value)}
                >
                  <span
                    className={`h-4 w-4 border border-slate-400 bg-slate-100 ${preset.previewClass}`}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </DesignerFieldRow>
        ))}

        {highlightWrap('twShadow', highlightedFieldKeys, (
          <DesignerFieldRow label="Shadow">
            <div className="flex flex-wrap gap-1">
              {SHADOW_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={iconButtonClass(shadow === preset.value)}
                  aria-label={`Shadow ${preset.label}`}
                  title={preset.label}
                  onClick={() => applyUtility(SHADOW_FIELD, shadow === preset.value ? '' : preset.value)}
                >
                  <span
                    className={`inline-block h-3.5 w-5 rounded-[2px] ${NESTED_LAYER_DIVIDER_CLASS} bg-white ${preset.previewClass}`}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </DesignerFieldRow>
        ))}

        {highlightWrap('twOpacity', highlightedFieldKeys, (
          <DesignerFieldRow label="Opacity" className="mt-1">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                aria-label="Opacity percent"
                className="h-1.5 w-full accent-indigo-600"
                value={opacityPercent ?? 100}
                onChange={(event) => {
                  const next = snapToTailwindOpacityScale(Number(event.target.value));
                  applyOpacity(next);
                }}
              />
              <span className={`w-10 shrink-0 text-end ${INSPECTOR_TEXT_XS} tabular-nums text-slate-600`}>
                {`${opacityPercent ?? 100}%`}
              </span>
              {opacityPercent !== null ? (
                <button
                  type="button"
                  className={`${INSPECTOR_TEXT_2XS} font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline`}
                  onClick={() => applyOpacity(null)}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </DesignerFieldRow>
        ))}
      </StyleSectionCard>

      <div className="space-y-2 pt-3">
        <div data-inspector-field="className">
          <InspectorPropDialogField
            label="className"
            value={className}
            placeholder="flex gap-4 p-4"
            dialogTitle="Edit className"
            onChange={onClassNameChange}
          />
        </div>
        {onStyleChange ? (
          <div data-inspector-field="style">
            <InspectorPropDialogField
              label="Inline Style"
              value={styleValue}
              placeholder="color: red; padding: 8px"
              dialogTitle="Edit inline style"
              onChange={onStyleChange}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const InspectorVisualStylePanel = React.memo(
  InspectorVisualStylePanelInner,
  areInspectorVisualStylePanelPropsEqual,
);

/** Style-tier field keys replaced by the visual Style panel (T1-11c / T1-11d). */
export const VISUAL_STYLE_REPLACED_FIELD_KEYS = new Set([
  'twDisplay',
  'twPosition',
  'twOverflow',
  'twFlexDirection',
  'twItems',
  'twJustify',
  'twGap',
  'twGridCols',
  'twPadding',
  'twMargin',
  'twTextSize',
  'twFontWeight',
  'twTextAlign',
  'twRounded',
  'twShadow',
  'twOpacity',
  'twWidth',
  'twHeight',
  'className',
  'style',
]);
