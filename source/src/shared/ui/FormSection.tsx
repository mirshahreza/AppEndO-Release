import React from 'react';
import { cn } from '../../lib/utils';
import type { AppSurfaceBoxTone } from './surfaceClasses';
import { APP_SURFACE_BOX_TONE_CLASS, resolveAppSurfaceBoxTone } from './surfaceClasses';
import {
  DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  type FieldFeedbackPlacement,
} from './fieldFeedback';
import { FieldHintTooltip } from './FieldHintTooltip';
import { FormAccessorySlot } from './formTabOrder';
import { PAGE_GUIDE_GROUP_ATTR, pageGuideProps } from './shell/pageGuide/pageGuide.attrs';
import {
  FORM_THEME_INK_BAR_CLASS,
  FORM_THEME_INK_LABEL_CLASS,
  FORM_THEME_INK_TITLE_CLASS,
  FORM_THEME_INK_WASH_CLASS,
  type FormThemeInk,
} from './formThemeInk';

export const FORM_FIELD_LABEL_CLASS =
  'text-xs font-normal uppercase tracking-wider text-slate-600 ps-[4px]';

export const FORM_FIELD_ERROR_CLASS =
  'text-[11px] font-medium text-rose-600 ps-[4px]';

export const FORM_SECTION_DESC_CLASS =
  'text-xs font-medium leading-relaxed text-slate-500 ps-[4px]';

/** Fixed 16×16 slot so pair-grid neighbors with/without `hint` stay vertically aligned. */
export const FORM_FIELD_HINT_SLOT_CLASS =
  'inline-flex h-4 w-4 shrink-0 items-center justify-center';

export const FORM_SECTION_ACCENT_BAR_CLASS: Record<AppSurfaceBoxTone, string> = {
  slate: 'bg-slate-400',
  violet: 'bg-violet-400',
  cyan: 'bg-cyan-500',
  indigo: 'bg-indigo-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
};

/** Vertical gap between section header and body. */
export const FORM_SECTION_BODY_STACK_CLASS = 'space-y-2';

/** Top spacing before a divided section (after the first group). */
export const FORM_SECTION_DIVIDED_CLASS = 'pt-3';

const FormSectionInkContext = React.createContext<FormThemeInk | undefined>(undefined);

type FormSectionProps = {
  title: string;
  tone?: AppSurfaceBoxTone;
  description?: string;
  descriptionClassName?: string;
  /** Overrides the tone title color (Settings content uses a darker step than AppSurfaceBox). */
  titleClassName?: string;
  /** Overrides the accent bar fill (Settings content uses a darker step than the default bar). */
  accentBarClassName?: string;
  /**
   * Operator hint via HeroUI info icon after the title.
   * Prefer this over a visible description paragraph on dense surfaces.
   */
  hint?: string;
  /**
   * Theme-channel ink for the section title, accent bar, and nested field labels.
   * `accent` = operator theme, `complement` = +42° overlay, `contrast` = +196° overlay.
   */
  ink?: FormThemeInk;
  /** When true, adds top spacing before this section (after the first group). */
  divided?: boolean;
  /** Count shown immediately after the title, before the hint icon. */
  count?: number;
  /** Optional content rendered immediately after the section title. */
  titleExtra?: React.ReactNode;
  headerExtra?: React.ReactNode;
  /** When false, omits the section title row (e.g. wizard shows step title elsewhere on phone). Default true. */
  showTitle?: boolean;
  className?: string;
  children: React.ReactNode;
};

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  tone = 'indigo',
  description,
  descriptionClassName,
  titleClassName,
  accentBarClassName,
  hint,
  ink,
  divided = false,
  count,
  titleExtra,
  headerExtra,
  showTitle = true,
  className,
  children,
}) => {
  const resolvedTone = resolveAppSurfaceBoxTone(tone);
  const accent = APP_SURFACE_BOX_TONE_CLASS[resolvedTone];
  const trimmedHint = hint?.trim() ?? '';
  const guideHint = trimmedHint || description?.trim() || '';
  const titleInkClass = cn(
    ink ? FORM_THEME_INK_TITLE_CLASS[ink] : accent.title,
    titleClassName,
  );
  const barInkClass = cn(
    ink ? FORM_THEME_INK_BAR_CLASS[ink] : FORM_SECTION_ACCENT_BAR_CLASS[resolvedTone],
    accentBarClassName,
  );

  return (
    <FormSectionInkContext.Provider value={ink}>
    <section
      className={cn(
        FORM_SECTION_BODY_STACK_CLASS,
        divided && FORM_SECTION_DIVIDED_CLASS,
        className,
      )}
      {...{ [PAGE_GUIDE_GROUP_ATTR]: '' }}
    >
      {showTitle ? (
      <div className="space-y-1">
        <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 items-center gap-2 ps-[4px]">
            <div
              className={cn(
                'flex min-w-0 items-center gap-1',
                ink && cn('rounded-md px-1.5 py-1 -ms-1', FORM_THEME_INK_WASH_CLASS[ink]),
              )}
              {...(guideHint
                ? pageGuideProps({ title, hint: guideHint, priority: 40, surface: true })
                : {})}
            >
              <span
                className={cn(
                  'shrink-0 rounded-full',
                  ink ? 'h-3.5 w-1' : 'h-3.5 w-0.5',
                  barInkClass,
                )}
                aria-hidden
              />
              <h3 className={cn('text-[11px] font-bold uppercase tracking-wider leading-none', titleInkClass)}>
                {title}
              </h3>
              {count != null ? (
                <span
                  className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-slate-200/90 px-1.5 text-[10px] font-bold tabular-nums normal-case tracking-normal text-slate-600"
                  aria-label={`${count}`}
                >
                  {count}
                </span>
              ) : null}
              {trimmedHint ? (
                <span className={FORM_FIELD_HINT_SLOT_CLASS}>
                  <FieldHintTooltip hint={trimmedHint} label={title} ink={ink} />
                </span>
              ) : null}
            </div>
            {titleExtra ? <div className="min-w-0 flex items-center">{titleExtra}</div> : null}
          </div>
          {headerExtra ? <div className="shrink-0 flex items-center">{headerExtra}</div> : null}
        </div>
        {!trimmedHint && description ? (
          <p className={cn(FORM_SECTION_DESC_CLASS, descriptionClassName)}>{description}</p>
        ) : null}
      </div>
      ) : null}
      {children}
    </section>
    </FormSectionInkContext.Provider>
  );
};

/** Label-over-input (product forms) vs label-beside-control (dense inspectors). */
export type FormFieldLayout = 'stack' | 'side';

const FormFieldLayoutContext = React.createContext<FormFieldLayout>('stack');

export const FormFieldLayoutProvider: React.FC<{
  layout: FormFieldLayout;
  children: React.ReactNode;
}> = ({ layout, children }) => (
  <FormFieldLayoutContext.Provider value={layout}>{children}</FormFieldLayoutContext.Provider>
);

/** Fixed label column for `layout="side"` — label and control share one horizontal midline. */
export const FORM_FIELD_SIDE_LABEL_CLASS =
  'min-w-0 flex-1 ps-[4px] text-[11px] font-normal leading-snug text-slate-600';

export const FORM_FIELD_SIDE_LABEL_COLUMN_CLASS =
  'flex min-h-8 w-[6.75rem] shrink-0 items-center gap-0.5';

export type FormFieldProps = {
  label: string;
  required?: boolean;
  error?: string | null;
  /** When true, passes isInvalid to the child control (UiInput, UiSelect, SemVerInput, …). */
  invalid?: boolean;
  /** When false, invalid border still applies but helper error text is hidden. Default true. */
  showError?: boolean;
  /** Validation hint placement — default overlay (prefer above, flip below when tight). */
  feedbackPlacement?: FieldFeedbackPlacement;
  className?: string;
  /**
   * Operator hint shown via HeroUI `FieldHintTooltip` (info icon after the label).
   * Do not put ordinary under-field helper paragraphs or native `title` hints instead.
   */
  hint?: string;
  /** Overrides the default (or section `ink`) label color. */
  labelClassName?: string;
  /**
   * Reserve a fixed 16×16 hint icon slot after the label (default true) so two-column
   * neighbors with/without `hint` do not stair-step vertically.
   */
  reserveHintSlot?: boolean;
  /** Optional action rendered beside the field label (e.g. EUA context suggest). */
  labelExtra?: React.ReactNode;
  /**
   * `stack` (default) is label-over-input. `side` places the label in a fixed
   * column beside the control. Omit to inherit `FormFieldLayoutProvider`.
   */
  layout?: FormFieldLayout;
  children: React.ReactNode;
};

const applyFormFieldProps = (
  children: React.ReactNode,
  options: {
    isInvalid: boolean;
    error?: string | null;
    showError: boolean;
    feedbackPlacement: FieldFeedbackPlacement;
  },
): React.ReactNode => {
  if (!React.isValidElement(children)) return children;
  // Host nodes (`div`, `span`, …) cannot take control props; cloning them
  // makes React log a DOM unknown-prop error overlay in Vite.
  if (typeof children.type === 'string') return children;

  const props: Record<string, unknown> = {};
  if (children.props.isInvalid === undefined) {
    props.isInvalid = options.isInvalid;
  }
  if (options.showError && options.error && children.props.errorMessage === undefined) {
    props.errorMessage = options.error;
  }
  if (children.props.feedbackPlacement === undefined) {
    props.feedbackPlacement = options.feedbackPlacement;
  }

  return Object.keys(props).length > 0 ? React.cloneElement(children, props) : children;
};

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  error,
  invalid,
  showError = true,
  feedbackPlacement = DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  className,
  hint,
  labelClassName,
  reserveHintSlot = true,
  labelExtra,
  layout: layoutProp,
  children,
}) => {
  const layoutFromContext = React.useContext(FormFieldLayoutContext);
  const ink = React.useContext(FormSectionInkContext);
  const layout = layoutProp ?? layoutFromContext;
  const isSide = layout === 'side';
  const isInvalid = Boolean(invalid ?? error);
  const showErrorBelow = showError && feedbackPlacement === 'below' && Boolean(error);
  const trimmedHint = hint?.trim() ?? '';
  const showHintSlot = reserveHintSlot || Boolean(trimmedHint);
  const control = applyFormFieldProps(children, { isInvalid, error, showError, feedbackPlacement });
  const resolvedLabelClass = cn(
    isSide
      ? 'min-w-0 flex-1 ps-[4px] text-[11px] font-normal leading-snug'
      : 'text-xs font-normal uppercase tracking-wider ps-[4px]',
    ink ? FORM_THEME_INK_LABEL_CLASS[ink] : 'text-slate-600',
    labelClassName,
  );

  const labelNode = (
    <>
      <label className={resolvedLabelClass}>
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      {showHintSlot ? (
        <span
          className={FORM_FIELD_HINT_SLOT_CLASS}
          aria-hidden={trimmedHint ? undefined : true}
        >
          {trimmedHint ? <FieldHintTooltip hint={trimmedHint} label={label} ink={ink} /> : null}
        </span>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        isSide ? 'flex items-center gap-2' : 'flex flex-col gap-[2px]',
        className,
      )}
      {...(trimmedHint
        ? pageGuideProps({ title: label, hint: trimmedHint, priority: 50, surface: true })
        : {})}
    >
      {isSide ? (
        <div className={FORM_FIELD_SIDE_LABEL_COLUMN_CLASS}>
          {labelNode}
          {labelExtra ? (
            <FormAccessorySlot className="inline-flex shrink-0 items-center">{labelExtra}</FormAccessorySlot>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-4 items-center gap-1">
          <div className="inline-flex min-h-4 min-w-0 items-center gap-0.5">
            {labelNode}
          </div>
          {labelExtra ? (
            <FormAccessorySlot as="div" className="flex h-4 items-center leading-none">
              {labelExtra}
            </FormAccessorySlot>
          ) : null}
        </div>
      )}
      {isSide ? (
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          {control}
          {showErrorBelow ? <p className={FORM_FIELD_ERROR_CLASS} role="alert">{error}</p> : null}
        </div>
      ) : (
        <>
          {control}
          {showErrorBelow ? <p className={FORM_FIELD_ERROR_CLASS} role="alert">{error}</p> : null}
        </>
      )}
    </div>
  );
};
