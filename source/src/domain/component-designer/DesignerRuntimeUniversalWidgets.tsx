import * as React from 'react';
import * as LucideIcons from 'lucide-react';
import { readBoolean, readNumber, readString } from './runtimeShared';
import { hasDesignerNodeItemsBinding } from './designerOptionItems';
import { useDesignerOptionItems, type DesignerOptionItemView } from './useDesignerOptionItems';
import { evaluateDesignerCondition } from './visibilityConditionEngine';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import { resolveCanvasMockEventProps } from './bindingCanvasResolver';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';

const parseJsonArray = <T,>(raw: unknown, fallback: T[]): T[] => {
  if (Array.isArray(raw)) {
    return raw as T[];
  }
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};

const parseCommaList = (raw: unknown, fallback: string[]): string[] => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return fallback;
  }
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
};

const resolveLucideIcon = (name: string): React.ComponentType<{ className?: string; size?: number }> => {
  const icons = LucideIcons as Record<string, React.ComponentType<{ className?: string; size?: number }>>;
  return icons[name] ?? LucideIcons.Sparkles;
};

const variantClasses: Record<string, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-rose-200 bg-rose-50 text-rose-900',
};

export type UniversalWidgetStyleProps = {
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Bug found: switching Orientation to "vertical" only changed the DOM tag/aria-orientation —
 * the catalog's default `className` (`'w-full border-t border-slate-200'`) is horizontal-shaped
 * and gets set once on insertion, so it's never falsy — the vertical fallback classes
 * (`className ?? 'h-full w-px ...'`) could then never actually apply. Concatenating the two
 * class strings instead isn't reliable either: Tailwind's cascade is decided by compiled rule
 * order, not by className string order, so a stale `w-full` could keep silently winning over a
 * freshly-added `w-px`. The orientation-determining width/height/border/background are now
 * inline style, which always wins deterministically over any Tailwind class — `className`
 * becomes a purely additive cosmetic layer (margin, opacity, a color override, …) that can never
 * break the base shape regardless of what it contains.
 */
export const DesignerUniversalSeparator: React.FC<{ orientation?: string } & UniversalWidgetStyleProps> = ({
  orientation = 'horizontal',
  className,
  style,
}) => {
  const isVertical = orientation === 'vertical';
  const structuralStyle: React.CSSProperties = isVertical
    ? { width: '1px', alignSelf: 'stretch', backgroundColor: '#e2e8f0', ...style }
    : { width: '100%', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: '#e2e8f0', ...style };
  return isVertical
    ? <div className={className} style={structuralStyle} role="separator" aria-orientation="vertical" />
    : <hr className={className} style={structuralStyle} />;
};

export const DesignerUniversalSpacer: React.FC<{ size?: number; axis?: string } & UniversalWidgetStyleProps> = ({
  size = 24,
  axis = 'vertical',
  className,
  style,
}) => (
  <div
    className={className}
    style={{
      ...(axis === 'horizontal' ? { width: size, height: 1 } : { height: size, width: '100%' }),
      ...style,
    }}
    aria-hidden="true"
  />
);

export const DesignerUniversalAlert: React.FC<{
  title?: string;
  message?: string;
  variant?: string;
} & UniversalWidgetStyleProps> = ({ title, message, variant = 'info', className, style }) => (
  <div className={`rounded-lg border px-4 py-3 ${variantClasses[variant] ?? variantClasses.info} ${className ?? ''}`} style={style} role="alert">
    {title ? <p className="text-sm font-semibold">{title}</p> : null}
    {message ? <p className="mt-1 text-sm opacity-90">{message}</p> : null}
  </div>
);

export const DesignerUniversalBanner: React.FC<{
  title?: string;
  message?: string;
  variant?: string;
} & UniversalWidgetStyleProps> = (props) => (
  <DesignerUniversalAlert {...props} className={`${props.className ?? ''} text-center`.trim()} />
);

export const DesignerUniversalEmptyState: React.FC<{
  title?: string;
  description?: string;
  actionLabel?: string;
} & UniversalWidgetStyleProps> = ({ title, description, actionLabel, className, style }) => (
  <div className={`flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center ${className ?? ''}`} style={style}>
    <LucideIcons.Inbox className="h-10 w-10 text-slate-400" />
    {title ? <p className="text-base font-semibold text-slate-800">{title}</p> : null}
    {description ? <p className="max-w-md text-sm text-slate-600">{description}</p> : null}
    {actionLabel ? <span className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white">{actionLabel}</span> : null}
  </div>
);

export const DesignerUniversalResult: React.FC<{
  title?: string;
  description?: string;
  status?: string;
} & UniversalWidgetStyleProps> = ({ title, description, status = 'success', className, style }) => {
  const Icon = status === 'error' ? LucideIcons.CircleX : LucideIcons.CircleCheck;
  const tone = status === 'error' ? 'text-rose-600' : 'text-emerald-600';
  return (
    <div className={`flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-8 text-center ${className ?? ''}`} style={style}>
      <Icon className={`h-10 w-10 ${tone}`} />
      {title ? <p className="text-lg font-semibold text-slate-900">{title}</p> : null}
      {description ? <p className="text-sm text-slate-600">{description}</p> : null}
    </div>
  );
};

export const DesignerUniversalStepper: React.FC<{ steps?: string; activeStep?: number } & UniversalWidgetStyleProps> = ({
  steps = 'Step 1,Step 2,Step 3',
  activeStep = 0,
  className,
  style,
}) => {
  const items = parseCommaList(steps, ['Step 1', 'Step 2', 'Step 3']);
  return (
    <ol className={`flex flex-wrap items-center gap-2 ${className ?? ''}`} style={style}>
      {items.map((label, index) => (
        <li key={label} className="flex items-center gap-2 text-sm">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${index <= activeStep ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'}`}>{index + 1}</span>
          <span className={index <= activeStep ? 'font-medium text-slate-900' : 'text-slate-500'}>{label}</span>
          {index < items.length - 1 ? <span className="text-slate-300">→</span> : null}
        </li>
      ))}
    </ol>
  );
};

export const DesignerUniversalCarousel: React.FC<{ title?: string; slides?: string } & UniversalWidgetStyleProps> = ({
  title,
  slides,
  className,
  style,
}) => {
  const items = parseJsonArray<{ id?: string; quote?: string; name?: string }>(slides, []);
  const [index, setIndex] = React.useState(0);
  const current = items[index] ?? items[0];
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 ${className ?? ''}`} style={style}>
      {title ? <p className="mb-3 text-sm font-semibold text-slate-800">{title}</p> : null}
      <p className="min-h-[48px] text-sm text-slate-700">{current?.quote ?? 'Slide content'}</p>
      {current?.name ? <p className="mt-2 text-xs text-slate-500">— {current.name}</p> : null}
      {items.length > 1 ? (
        <div className="mt-3 flex items-center gap-2">
          <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => setIndex((value) => (value - 1 + items.length) % items.length)}>Prev</button>
          <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => setIndex((value) => (value + 1) % items.length)}>Next</button>
        </div>
      ) : null}
    </div>
  );
};

export const DesignerUniversalIcon: React.FC<{ iconName?: string; size?: number } & UniversalWidgetStyleProps> = ({
  iconName = 'Sparkles',
  size = 24,
  className,
  style,
}) => {
  const Icon = resolveLucideIcon(iconName);
  return <Icon className={className} size={size} style={style} aria-hidden="true" />;
};

/**
 * Bug found: `value` was a display-only prop (no way to pick a rating at all) and there was no
 * onChange target — clicking a star is now wired to emit a designer event carrying the picked
 * star's 1-based value, matching the {target:{value}} shape every other adapted widget uses.
 */
export const DesignerUniversalRating: React.FC<{ label?: string; defaultValue?: number; max?: number; onChange?: (event: Event) => void } & UniversalWidgetStyleProps> = ({
  label,
  defaultValue: value = 0,
  max = 5,
  onChange,
  className,
  style,
}) => (
  <div className={`flex flex-col gap-[2px] ${className ?? ''}`} style={style}>
    {label ? <span className="ps-[4px] text-sm text-slate-700">{label}</span> : null}
    <div className="flex gap-0.5" aria-label={`Rating ${value} of ${max}`}>
      {Array.from({ length: max }).map((_, index) => (
        <button
          key={index}
          type="button"
          className="p-0"
          aria-label={`Rate ${index + 1} of ${max}`}
          onClick={() => onChange?.({ target: { value: String(index + 1) } } as unknown as Event)}
        >
          <LucideIcons.Star className={`h-5 w-5 ${index < value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
        </button>
      ))}
    </div>
  </div>
);

/**
 * Bug found (this fix): `digits` was recomputed fresh from the `defaultValue` prop on every
 * render instead of being tracked as real state — since `defaultValue` never changes (each
 * `<input>` is intentionally uncontrolled), every keystroke's `onChange` closure captured the
 * SAME stale, all-empty `digits` array, so typing a second digit always overwrote the first
 * instead of combining with it (e.g. typing "1" then "5" produced onChange values `'1'` then
 * `'5'`, never `'15'`). Track the combined value as real component state instead.
 */
export const DesignerUniversalOtpInput: React.FC<{ label?: string; length?: number; defaultValue?: string; onChange?: (event: Event) => void } & UniversalWidgetStyleProps> = ({
  label,
  length = 6,
  defaultValue = '',
  onChange,
  className,
  style,
}) => {
  const [digits, setDigits] = React.useState<string[]>(
    () => Array.from({ length }, (_, index) => defaultValue[index] ?? ''),
  );

  return (
    <div className={`flex flex-col gap-[2px] ${className ?? ''}`} style={style}>
      {label ? <span className="ps-[4px] text-sm text-slate-700">{label}</span> : null}
      <div className="flex gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            type="text"
            inputMode="numeric"
            maxLength={1}
            defaultValue={digit}
            aria-label={`Digit ${index + 1} of ${length}`}
            className="flex h-10 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-center text-sm font-semibold text-slate-700"
            onChange={(event) => {
              const next = [...digits];
              next[index] = event.target.value.slice(-1);
              setDigits(next);
              onChange?.({ target: { value: next.join('') } } as unknown as Event);
            }}
          />
        ))}
      </div>
    </div>
  );
};

type UniversalTimeInputProps = {
  label?: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  step?: number;
  granularity?: string;
  hourCycle?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  onChange?: (event: Event) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
} & UniversalWidgetStyleProps;

const resolveTimeInputStep = (granularity: string | undefined, step: number | undefined): number | undefined => {
  if (Number.isFinite(step) && (step as number) > 0) {
    return step;
  }
  switch (granularity) {
    case 'hour':
      return 3600;
    case 'second':
      return 1;
    case 'minute':
    default:
      return 60;
  }
};

/**
 * Bug found: this previously rendered `<input type="time" readOnly>` — a native input that a
 * user could literally never type into or change, in canvas preview or exported code. Now
 * uncontrolled-but-editable (matches the Slider/Switch "uncontrolled + adapter" pattern) and
 * dispatches onChange to the designer event system when a handler is supplied.
 */
export const DesignerUniversalTimeInput: React.FC<UniversalTimeInputProps> = ({
  label,
  defaultValue: value = '09:30',
  min,
  max,
  step,
  granularity,
  hourCycle,
  isRequired,
  isDisabled,
  isInvalid,
  errorMessage,
  onChange,
  onBlur,
  className,
  style,
}) => {
  const resolvedStep = resolveTimeInputStep(granularity, step);
  const inputClassName = `h-8 rounded-md border bg-white px-2.5 text-xs text-slate-800 ${
    isInvalid ? 'border-rose-400' : 'border-slate-300'
  }`;

  return (
    <div className={`flex w-full flex-col gap-[2px] ${className ?? ''}`} style={style}>
      {label ? <span className="ps-[4px] text-sm text-slate-700">{label}</span> : null}
      <input
        type="time"
        defaultValue={value}
        min={min?.trim() || undefined}
        max={max?.trim() || undefined}
        step={resolvedStep}
        required={isRequired || undefined}
        disabled={isDisabled || undefined}
        aria-invalid={isInvalid || undefined}
        data-hour-cycle={hourCycle?.trim() || undefined}
        className={inputClassName}
        onChange={onChange as React.ChangeEventHandler<HTMLInputElement> | undefined}
        onBlur={onBlur}
      />
      {isInvalid && errorMessage ? (
        <p className="ps-[4px] text-xs text-rose-600" data-designer-field-error="true">{errorMessage}</p>
      ) : null}
    </div>
  );
};

type UniversalDateTimeInputProps = UniversalTimeInputProps & {
  timeZone?: string;
};

/**
 * Bug found: this previously rendered `<input type="datetime-local" readOnly>` — same defect as
 * DesignerUniversalTimeInput above; fixed the same way.
 */
export const DesignerUniversalDateTimeInput: React.FC<UniversalDateTimeInputProps> = ({
  label,
  defaultValue: value = '2026-07-07T09:30',
  min,
  max,
  step,
  granularity,
  hourCycle,
  timeZone,
  isRequired,
  isDisabled,
  isInvalid,
  errorMessage,
  onChange,
  onBlur,
  className,
  style,
}) => {
  const resolvedStep = resolveTimeInputStep(granularity, step);
  const inputClassName = `h-8 rounded-md border bg-white px-2.5 text-xs text-slate-800 ${
    isInvalid ? 'border-rose-400' : 'border-slate-300'
  }`;

  return (
    <div className={`flex w-full flex-col gap-[2px] ${className ?? ''}`} style={style}>
      {label ? <span className="ps-[4px] text-sm text-slate-700">{label}</span> : null}
      <input
        type="datetime-local"
        defaultValue={value}
        min={min?.trim() || undefined}
        max={max?.trim() || undefined}
        step={resolvedStep}
        required={isRequired || undefined}
        disabled={isDisabled || undefined}
        aria-invalid={isInvalid || undefined}
        data-hour-cycle={hourCycle?.trim() || undefined}
        data-time-zone={timeZone?.trim() || undefined}
        className={inputClassName}
        onChange={onChange as React.ChangeEventHandler<HTMLInputElement> | undefined}
        onBlur={onBlur}
      />
      {isInvalid && errorMessage ? (
        <p className="ps-[4px] text-xs text-rose-600" data-designer-field-error="true">{errorMessage}</p>
      ) : null}
    </div>
  );
};

export const DesignerUniversalDescriptionList: React.FC<{ title?: string; data?: string } & UniversalWidgetStyleProps> = ({
  title,
  data,
  className,
  style,
}) => {
  const rows = parseJsonArray<{ term?: string; detail?: string }>(data, []);
  return (
    <div className={className} style={style}>
      {title ? <p className="mb-2 text-sm font-semibold text-slate-800">{title}</p> : null}
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={`${row.term}-${row.detail}`} className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <dt className="text-xs uppercase tracking-wide text-slate-500">{row.term}</dt>
            <dd className="text-sm font-medium text-slate-800">{row.detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export const DesignerUniversalStatTrend: React.FC<{
  label?: string;
  value?: string;
  valueClassName?: string;
  trend?: string;
  trendDirection?: string;
} & UniversalWidgetStyleProps> = ({ label, value, valueClassName, trend, trendDirection = 'up', className, style }) => (
  <div className={`rounded-lg border border-slate-200 bg-white p-4 ${className ?? ''}`} style={style}>
    {label ? <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p> : null}
    {value ? <p className={`mt-1 text-2xl font-semibold ${valueClassName ?? 'text-slate-900'}`}>{value}</p> : null}
    {trend ? (
      <p className={`mt-1 text-sm font-medium ${trendDirection === 'down' ? 'text-rose-600' : 'text-emerald-600'}`}>{trend}</p>
    ) : null}
  </div>
);

type SegmentedOptionSource = {
  value: string;
  label: string;
};

const normalizeSegmentedOptionItems = (
  items: Array<{ id?: string; value?: string; textValue?: string; label?: string }> | DesignerOptionItemView[] | undefined,
): SegmentedOptionSource[] => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  return items
    .map((item) => {
      const value = String(
        ('value' in item && item.value) || ('id' in item && item.id) || '',
      ).trim();
      const label = String(
        ('label' in item && item.label)
        || ('textValue' in item && item.textValue)
        || value,
      ).trim();
      if (!value && !label) {
        return null;
      }
      return { value: value || label, label: label || value };
    })
    .filter((entry): entry is SegmentedOptionSource => entry !== null);
};

/**
 * Bug found: every option rendered as a plain, non-interactive `<span>` — clicking a segment
 * could never change the selection in canvas, interactive preview, or the exported/published
 * app; `selected` could only ever be set via the (also previously broken) static/bound prop.
 * Now a real, clickable control with local state seeded from `selected`, emitting a designer
 * event on click the same way every other adapted widget does.
 */
export const DesignerUniversalSegmentedControl: React.FC<{
  options?: string;
  selected?: string;
  items?: Array<{ id?: string; value?: string; textValue?: string; label?: string }> | DesignerOptionItemView[];
  isLoading?: boolean;
  onSelectionChange?: (event: Event) => void;
} & UniversalWidgetStyleProps> = ({
  options = 'Day,Week,Month',
  selected = 'Week',
  items: boundItems,
  isLoading = false,
  onSelectionChange,
  className,
  style,
}) => {
  const [selectedValue, setSelectedValue] = React.useState(selected);

  React.useEffect(() => {
    setSelectedValue(selected);
  }, [selected]);

  if (isLoading) {
    return (
      <div
        className={`inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs text-slate-500 ${className ?? ''}`}
        style={style}
        role="tablist"
        aria-busy="true"
      >
        Loading options…
      </div>
    );
  }

  const fromItems = normalizeSegmentedOptionItems(boundItems);
  const resolved = fromItems.length > 0
    ? fromItems
    : parseCommaList(options, ['Day', 'Week', 'Month']).map((label) => ({ value: label, label }));

  return (
    <div className={`inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 ${className ?? ''}`} style={style} role="tablist">
      {resolved.map((item) => {
        const isSelected = item.value === selectedValue || item.label === selectedValue;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={`rounded-md px-3 py-1.5 text-sm ${isSelected ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => {
              setSelectedValue(item.value);
              onSelectionChange?.({ target: { value: item.value } } as unknown as Event);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

/** Preview path: LOV / items binding via shared `useDesignerOptionItems` (ChoiceGroup pattern). */
export const DesignerRuntimeSegmentedControl: React.FC<{
  node: DesignerNode;
  options: RuntimeRenderOptions;
  /**
   * Bug found (parity audit item 5): this widget is Dual-Mode content-bindable (options come
   * from an API), and export correctly emits a real `options={...}` computed from the bound
   * rows. But this component always re-derived its labels from the STATIC `node.props.options`
   * itself, bypassing `resolveBoundUniversalOverrides`'s Dual-Mode override entirely (every
   * other Dual-Mode widget goes through that override via `designerUniversalRuntime.tsx`'s
   * `props` variable; this was the one case still passing the raw node through). Now accepts
   * the already-Dual-Mode-resolved value from the caller instead of re-reading the static prop.
   *
   * Bug found (parity audit items 79/80): Property Binding on the legacy CSV `options` field
   * and on `selected` was still dead here — `optionsOverride`/`selectedOverride` now carry the
   * values already resolved through `resolveUniversalPropsFromNode`'s binding-aware `text()`
   * helper (Dual-Mode still wins for options via `resolveBoundUniversalOverrides`).
   */
  optionsOverride?: string;
  selectedOverride?: string;
}> = ({ node, options, optionsOverride, selectedOverride }) => {
  const optionNode = React.useMemo(() => {
    if (hasDesignerNodeItemsBinding(node)) {
      return node;
    }
    const rawItems = node.props.items;
    const hasExplicitItems = Array.isArray(rawItems)
      || (typeof rawItems === 'string' && rawItems.trim().length > 0);
    if (hasExplicitItems) {
      return node;
    }
    const labels = parseCommaList(optionsOverride ?? node.props.options, ['Day', 'Week', 'Month']);
    return {
      ...node,
      props: {
        ...node.props,
        items: JSON.stringify(labels.map((label) => ({ id: label, textValue: label }))),
      },
    };
  }, [node, optionsOverride]);

  const { items, isLoading } = useDesignerOptionItems(optionNode, options);
  const selected = readString(selectedOverride ?? node.props.selected, items[0]?.label ?? 'Week');
  const className = readString(node.props.className, 'w-full');
  const eventProps = options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);

  return (
    <DesignerUniversalSegmentedControl
      items={items}
      selected={selected}
      isLoading={isLoading}
      onSelectionChange={eventProps.onSelectionChange}
      className={className}
      style={options.style}
    />
  );
};

export const DesignerUniversalFaqAccordion: React.FC<{ title?: string; data?: string } & UniversalWidgetStyleProps> = ({
  title,
  data,
  className,
  style,
}) => {
  const items = parseJsonArray<{ id?: string; question?: string; answer?: string }>(data, []);
  const [openId, setOpenId] = React.useState(items[0]?.id ?? '');
  return (
    <div className={`space-y-2 ${className ?? ''}`} style={style}>
      {title ? <p className="text-base font-semibold text-slate-900">{title}</p> : null}
      {items.map((item) => (
        <div key={item.id ?? item.question} className="rounded-lg border border-slate-200 bg-white">
          <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-800" onClick={() => setOpenId(item.id ?? item.question ?? '')}>
            {item.question}
            <LucideIcons.ChevronDown className={`h-4 w-4 transition ${openId === (item.id ?? item.question) ? 'rotate-180' : ''}`} />
          </button>
          {openId === (item.id ?? item.question) && item.answer ? (
            <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">{item.answer}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export const DesignerUniversalTestimonialCarousel: React.FC<{ title?: string; data?: string } & UniversalWidgetStyleProps> = ({
  title,
  data,
  className,
  style,
}) => <DesignerUniversalCarousel title={title} slides={data} className={className} style={style} />;

export const DesignerUniversalPricingTable: React.FC<{ title?: string; data?: string } & UniversalWidgetStyleProps> = ({
  title,
  data,
  className,
  style,
}) => {
  const tiers = parseJsonArray<{ id?: string; name?: string; price?: string; period?: string; features?: string[] | string; cta?: string; featured?: boolean | string }>(data, []);
  return (
    <div className={className} style={style}>
      {title ? <p className="mb-4 text-center text-lg font-semibold text-slate-900">{title}</p> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((tier) => {
          // Bug found (parity audit item P4.21): the new structured Inspector editor for
          // pricing tiers (InspectorContentRecordsField) only round-trips plain strings — it
          // stores `features` as a comma-separated string (matching the existing "Steps
          // (comma-separated)" convention already used elsewhere in this file) and `featured`
          // as the string "true"/"false" via a checkbox control, not a real array/boolean.
          // Accept both forms so pre-existing JSON documents (real array/boolean, e.g.
          // MOCK_PRICING_TIERS_JSON) and newly-edited ones keep working identically.
          const features = Array.isArray(tier.features) ? tier.features : parseCommaList(tier.features, []);
          const isFeatured = tier.featured === true || tier.featured === 'true';
          return (
            <div key={tier.id ?? tier.name} className={`rounded-xl border p-4 ${isFeatured ? 'border-primary bg-primary/5 shadow-md' : 'border-slate-200 bg-white'}`}>
              <p className="text-sm font-semibold text-slate-800">{tier.name}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{tier.price}<span className="text-sm font-normal text-slate-500">{tier.period}</span></p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {features.map((feature) => <li key={feature}>• {feature}</li>)}
              </ul>
              {tier.cta ? <span className="mt-4 inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white">{tier.cta}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DesignerUniversalHeroCta: React.FC<{
  title?: string;
  subtitle?: string;
  primaryCta?: string;
  secondaryCta?: string;
} & UniversalWidgetStyleProps> = ({ title, subtitle, primaryCta, secondaryCta, className, style }) => (
  <section className={`rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 px-8 py-12 text-white ${className ?? ''}`} style={style}>
    {title ? <h2 className="text-3xl font-bold tracking-tight">{title}</h2> : null}
    {subtitle ? <p className="mt-3 max-w-2xl text-base text-slate-200">{subtitle}</p> : null}
    <div className="mt-6 flex flex-wrap gap-3">
      {primaryCta ? <span className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900">{primaryCta}</span> : null}
      {secondaryCta ? <span className="rounded-md border border-white/40 px-4 py-2 text-sm font-medium text-white">{secondaryCta}</span> : null}
    </div>
  </section>
);

export const DesignerUniversalFeatureGrid: React.FC<{ title?: string; data?: string } & UniversalWidgetStyleProps> = ({
  title,
  data,
  className,
  style,
}) => {
  const features = parseJsonArray<{ id?: string; title?: string; description?: string }>(data, []);
  return (
    <div className={className} style={style}>
      {title ? <p className="mb-4 text-lg font-semibold text-slate-900">{title}</p> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.id ?? feature.title} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">{feature.title}</p>
            <p className="mt-1 text-sm text-slate-600">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DesignerUniversalBlogCardList: React.FC<{ title?: string; data?: string } & UniversalWidgetStyleProps> = ({
  title,
  data,
  className,
  style,
}) => {
  const posts = parseJsonArray<{ id?: string; title?: string; summary?: string; date?: string }>(data, []);
  return (
    <div className={`space-y-3 ${className ?? ''}`} style={style}>
      {title ? <p className="text-lg font-semibold text-slate-900">{title}</p> : null}
      {posts.map((post) => (
        <article key={post.id ?? post.title} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="font-semibold text-slate-900">{post.title}</p>
          <p className="mt-1 text-sm text-slate-600">{post.summary}</p>
          {post.date ? <p className="mt-2 text-xs text-slate-400">{post.date}</p> : null}
        </article>
      ))}
    </div>
  );
};

export const DesignerUniversalTeamGrid: React.FC<{ title?: string; data?: string } & UniversalWidgetStyleProps> = ({
  title,
  data,
  className,
  style,
}) => {
  const members = parseJsonArray<{ id?: string; name?: string; role?: string; bio?: string }>(data, []);
  return (
    <div className={className} style={style}>
      {title ? <p className="mb-4 text-lg font-semibold text-slate-900">{title}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <div key={member.id ?? member.name} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">{member.name}</p>
            <p className="text-sm text-primary">{member.role}</p>
            <p className="mt-2 text-sm text-slate-600">{member.bio}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DesignerUniversalContactFormBlock: React.FC<{ title?: string; submitLabel?: string } & UniversalWidgetStyleProps> = ({
  title,
  submitLabel = 'Send',
  className,
  style,
}) => (
  <form className={`space-y-3 rounded-lg border border-slate-200 bg-white p-4 ${className ?? ''}`} style={style}>
    {title ? <p className="text-base font-semibold text-slate-900">{title}</p> : null}
    <input className="h-8 w-full rounded-md border border-slate-300 px-2.5 text-xs" placeholder="Name" readOnly />
    <input className="h-8 w-full rounded-md border border-slate-300 px-2.5 text-xs" placeholder="Email" readOnly />
    <textarea className="min-h-[80px] w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" placeholder="Message" readOnly />
    <span className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">{submitLabel}</span>
  </form>
);

export const DesignerUniversalNewsletterSignup: React.FC<{
  title?: string;
  placeholder?: string;
  buttonLabel?: string;
} & UniversalWidgetStyleProps> = ({ title, placeholder = 'Email', buttonLabel = 'Subscribe', className, style }) => (
  <div className={`rounded-lg border border-slate-200 bg-white p-4 ${className ?? ''}`} style={style}>
    {title ? <p className="mb-3 font-semibold text-slate-900">{title}</p> : null}
    <div className="flex gap-2">
      <input className="h-8 flex-1 rounded-md border border-slate-300 px-2.5 text-xs" placeholder={placeholder} readOnly />
      <span className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-white">{buttonLabel}</span>
    </div>
  </div>
);

export const DesignerUniversalCtaBanner: React.FC<{
  title?: string;
  description?: string;
  actionLabel?: string;
} & UniversalWidgetStyleProps> = ({ title, description, actionLabel, className, style }) => (
  <div className={`flex flex-col items-start justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center ${className ?? ''}`} style={style}>
    <div>
      {title ? <p className="text-base font-semibold text-slate-900">{title}</p> : null}
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
    </div>
    {actionLabel ? <span className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">{actionLabel}</span> : null}
  </div>
);

export const DesignerUniversalAspectRatio: React.FC<{ ratio?: string; children?: React.ReactNode } & UniversalWidgetStyleProps> = ({
  ratio = '16/9',
  children,
  className,
  style,
}) => (
  <div className={className} style={{ aspectRatio: ratio.replace('/', ' / '), ...style }}>
    {children ?? <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-500">Media area</div>}
  </div>
);

export const DesignerUniversalStickyContainer: React.FC<{ offset?: number; children?: React.ReactNode } & UniversalWidgetStyleProps> = ({
  offset = 0,
  children,
  className,
  style,
}) => (
  <div className={className} style={{ top: offset, ...style }}>
    {children}
  </div>
);

export const DesignerUniversalOverlayContainer: React.FC<{ overlayLabel?: string; children?: React.ReactNode } & UniversalWidgetStyleProps> = ({
  overlayLabel = 'Overlay',
  children,
  className,
  style,
}) => (
  <div className={`relative ${className ?? ''}`} style={style}>
    {children}
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/20 text-sm font-medium text-white">
      {overlayLabel}
    </div>
  </div>
);

export type DesignerSplitMediaType = 'image' | 'video' | 'audio' | 'lottie';

const resolveSplitMediaType = (raw: unknown): DesignerSplitMediaType => {
  if (raw === 'video' || raw === 'audio' || raw === 'lottie' || raw === 'image') {
    return raw;
  }
  return 'image';
};

export const DesignerUniversalSplitMedia: React.FC<{
  title?: string;
  mediaSide?: string;
  mediaSrc?: string;
  /** Phase 53 — defaults to `image` so existing drafts keep prior <img> behavior. */
  mediaType?: DesignerSplitMediaType | string;
  children?: React.ReactNode;
} & UniversalWidgetStyleProps> = ({
  title,
  mediaSide = 'right',
  mediaSrc,
  mediaType = 'image',
  children,
  className,
  style,
}) => {
  const resolvedType = resolveSplitMediaType(mediaType);
  const src = mediaSrc?.trim() ?? '';

  let mediaPane: React.ReactNode;
  if (!src) {
    mediaPane = <div className="min-h-[120px] rounded-lg bg-slate-100" data-media-type={resolvedType} />;
  } else if (resolvedType === 'video') {
    mediaPane = (
      <div className="min-h-[120px] overflow-hidden rounded-lg bg-slate-900" data-media-type="video">
        <video src={src} controls playsInline className="h-full w-full object-cover" />
      </div>
    );
  } else if (resolvedType === 'audio') {
    mediaPane = (
      <div className="flex min-h-[120px] items-center rounded-lg bg-slate-100 p-3" data-media-type="audio">
        <audio src={src} controls className="w-full" />
      </div>
    );
  } else if (resolvedType === 'lottie') {
    mediaPane = (
      <div
        className="flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-violet-300 bg-violet-50 p-3 text-center"
        data-media-type="lottie"
      >
        <p className="text-sm font-medium text-violet-900">Lottie animation</p>
        <p className="max-w-full truncate text-xs text-violet-700">{src}</p>
      </div>
    );
  } else {
    mediaPane = (
      <div className="min-h-[120px] overflow-hidden rounded-lg bg-slate-100" data-media-type="image">
        <img src={src} alt={title || 'Media'} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`grid gap-4 md:grid-cols-2 ${className ?? ''}`} style={style} data-media-type={resolvedType}>
      {mediaSide === 'left' ? mediaPane : null}
      <div>
        {title ? <p className="mb-2 text-lg font-semibold text-slate-900">{title}</p> : null}
        {children ?? <p className="text-sm text-slate-600">Content column</p>}
      </div>
      {mediaSide !== 'left' ? mediaPane : null}
    </div>
  );
};

export const DesignerUniversalVisibilityContainer: React.FC<{
  visibleCondition?: string;
  /** Live designer store / data context to evaluate `visibleCondition` against (preview + export). */
  designerStore?: Record<string, unknown> | null;
  dataContext?: Record<string, unknown> | null;
  /**
   * The enclosing `logic.repeater`'s current item/index, when nested inside one — needed for
   * `item.<field>`-scoped conditions. Bug found (parity audit item 18): this component never
   * accepted a scope at all (always evaluated with `{}`), so a nested visibility-container's
   * `item.`-scoped condition always saw `item` as undefined and stayed permanently hidden, in
   * both the live/interactive preview and the exported/published bundle alike.
   */
  scope?: { item?: unknown; index?: number };
  /** In canvas "design" edit mode content always renders so the node stays selectable/editable. */
  mode?: 'design' | 'runtime';
  children?: React.ReactNode;
} & UniversalWidgetStyleProps> = ({
  visibleCondition,
  designerStore,
  dataContext,
  scope,
  mode,
  children,
  className,
  style,
}) => {
  const isVisible = mode === 'design'
    ? true
    : evaluateDesignerCondition(designerStore ?? {}, dataContext ?? null, scope ?? {}, visibleCondition ?? '');

  if (!isVisible) {
    return null;
  }

  return (
    <div className={className} style={style} data-visible-condition={visibleCondition || undefined}>
      {children}
    </div>
  );
};

/**
 * Bug found (parity audit item 2, systemic): every scalar prop on every Universal widget
 * (content.*, feedback.*, marketing.*, form.rating, etc — ~29 elements) was always read
 * directly off the static `node.props`, never consulting `options.previewBindings` — the mechanism
 * `runtimeRenderer.tsx` (card/accordion-item/modal/drawer) and Pagination already use for
 * exactly this. A Property Binding on e.g. feedback.alert's `title` worked correctly in export
 * but always showed the static literal in the live/interactive preview. `resolveTextProp`/
 * `resolveNumberProp` fall back to the static value when unbound or no bridge is supplied
 * (design-time/export-adjacent callers), so this is purely additive — no behavior change for
 * the static case.
 */
export const resolveUniversalPropsFromNode = (node: DesignerNode, options?: RuntimeRenderOptions) => {
  const previewBindings = options?.previewBindings;
  const text = (key: string, fallback = ''): string =>
    previewBindings?.resolveTextProp
      ? previewBindings.resolveTextProp(node, key, readString(node.props[key], fallback))
      : readString(node.props[key], fallback);
  const number = (key: string, fallback: number): number =>
    previewBindings?.resolveNumberProp
      ? previewBindings.resolveNumberProp(node, key, readNumber(node.props[key], fallback))
      : readNumber(node.props[key], fallback);

  return {
    className: readString(node.props.className),
    title: text('title'),
    message: text('message'),
    description: text('description'),
    subtitle: text('subtitle'),
    variant: text('variant', 'info'),
    status: text('status', 'success'),
    actionLabel: text('actionLabel'),
    submitLabel: text('submitLabel'),
    buttonLabel: text('buttonLabel'),
    placeholder: text('placeholder'),
    primaryCta: text('primaryCta'),
    secondaryCta: text('secondaryCta'),
    orientation: readString(node.props.orientation, 'horizontal'),
    axis: readString(node.props.axis, 'vertical'),
    size: number('size', 24),
    steps: text('steps'),
    activeStep: number('activeStep', 0),
    slides: readString(node.props.slides),
    data: readString(node.props.data),
    iconName: text('iconName', 'Sparkles'),
    label: text('label'),
    value: text('value'),
    numericValue: number('value', 0),
    max: number('max', 5),
    length: number('length', 6),
    trend: text('trend'),
    trendDirection: text('trendDirection', 'up'),
    // Bug found (parity audit items 79/80/81): `options`/`selected`/`visibleCondition` were
    // the last three scalar props still reading `node.props` raw after the systemic preview
    // binding fix (item 2) — Property Binding stayed dead in Canvas/Preview while Export worked.
    options: text('options'),
    selected: text('selected'),
    ratio: text('ratio', '16/9'),
    offset: number('offset', 0),
    overlayLabel: text('overlayLabel', 'Overlay'),
    visibleCondition: text('visibleCondition'),
    mediaSide: text('mediaSide', 'right'),
    mediaSrc: text('mediaSrc'),
    mediaType: text('mediaType', 'image'),
    src: text('src'),
    poster: text('poster'),
    captionsSrc: text('captionsSrc'),
    aspectRatio: text('aspectRatio', '16 / 9'),
    errorCorrectionLevel: text('errorCorrectionLevel', 'M'),
    logoOverlay: text('logoOverlay'),
    format: text('format', 'CODE128'),
    autoplay: readBoolean(node.props.autoplay),
    loop: readBoolean(node.props.loop),
    muted: readBoolean(node.props.muted),
    controls: node.props.controls === false ? false : true,
    showCaptions: readBoolean(node.props.showCaptions),
    showWaveform: readBoolean(node.props.showWaveform),
    playbackSpeedControl: node.props.playbackSpeedControl === false ? false : true,
    downloadable: readBoolean(node.props.downloadable),
    showValue: node.props.showValue === false ? false : true,
  };
};
