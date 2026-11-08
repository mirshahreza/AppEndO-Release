import React from 'react';
import { AppSurfaceBox, FeatureToggleField, FieldHintTooltip, UiCheckbox, UiCheckboxChoice } from '../../../../shared/ui';
import type { AppSurfaceBoxTone } from '../../../../shared/ui/surfaceClasses';
import {
  APP_TABLE_GRID_CARD_CLASS,
} from '../../../../shared/ui/surfaceClasses';
import { cn } from '../../../../lib/utils';
import { pageGuideProps } from '../../../../shared/ui/shell/pageGuide/pageGuide.attrs';
import {
  getSettingsTypography,
  type SettingsTypographyTokens,
} from '../../settingsSectionTypography';
import type { SectionId } from '../../types';
import { SettingsNavScopeHint } from '../SettingsNavScopeHint';

const SettingsFormSectionContext = React.createContext<{
  sectionId: SectionId;
  typography: SettingsTypographyTokens;
} | null>(null);

export const useSettingsFormSection = () => React.useContext(SettingsFormSectionContext);

const SETTINGS_LABEL_INFO_GAP_CLASS = 'gap-0.5';

export type SettingsLabelInfoRowProps = {
  label: React.ReactNode;
  labelInfo?: string;
  /** Accessible name for the info button — defaults to string `label`. */
  infoLabel?: string;
  labelClassName?: string;
  htmlFor?: string;
  /** Keeps a fixed icon slot for grid alignment when some labels omit labelInfo. Default true. */
  reserveInfoSlot?: boolean;
};

const SETTINGS_LABEL_INFO_SLOT_CLASS = 'inline-flex h-4 w-4 shrink-0 items-center justify-center';

/** Label text with optional info tooltip icon immediately after the label. */
export const SettingsLabelInfoRow: React.FC<SettingsLabelInfoRowProps> = ({
  label,
  labelInfo,
  infoLabel,
  labelClassName,
  htmlFor,
  reserveInfoSlot = true,
}) => {
  const LabelTag = htmlFor ? 'label' : 'span';
  const hintLabel = infoLabel ?? (typeof label === 'string' ? label : 'Field');

  return (
    <div className={cn('inline-flex min-h-4 max-w-full items-center ps-[4px]', SETTINGS_LABEL_INFO_GAP_CLASS)}>
      <LabelTag htmlFor={htmlFor} className={cn(labelClassName, 'min-w-0 ps-0 leading-tight')}>
        {label}
      </LabelTag>
      {reserveInfoSlot || labelInfo ? (
        <span className={SETTINGS_LABEL_INFO_SLOT_CLASS} aria-hidden={labelInfo ? undefined : true}>
          {labelInfo ? <SettingsNavScopeHint hint={labelInfo} label={hintLabel} /> : null}
        </span>
      ) : null}
    </div>
  );
};

export const SETTINGS_FIELD_LABEL_BAND_CLASS = 'min-h-8 flex items-end';

/** Vertical stack between fields inside one settings group/section. */
export const SETTINGS_FORM_GROUP_BODY_STACK_CLASS = 'space-y-5';

/** White card chrome — Logs / Record Events is the living sample. */
const SETTINGS_SURFACE_CARD_CLASS =
  'rounded-xl border border-slate-200 bg-white shadow-sm';
const SETTINGS_SURFACE_CARD_BODY_CLASS = 'p-6';
const SETTINGS_SURFACE_CARD_TITLE_CLASS =
  'text-base font-semibold capitalize text-slate-800';
export const SETTINGS_SURFACE_STACK_CLASS = 'flex flex-col gap-8';
export const SETTINGS_CONTROL_CLASS =
  'w-full rounded-lg text-slate-900 focus-within:ring-2 focus-within:ring-indigo-100';

/** Gap between columns in settings multi-column grids. */
export const SETTINGS_FORM_GRID_GAP_CLASS = 'gap-2';

/** Horizontal padding shared by form shells, card grids, and section footers. */
export const SETTINGS_PANEL_PADDING_X_CLASS = 'px-5';

/** Scrollable form shell padding — aligns content edges with toolbars and card grids. */
const SETTINGS_FORM_SHELL_PADDING_CLASS = cn(SETTINGS_PANEL_PADDING_X_CLASS, 'py-6');

/** Two equal columns — matches OTP Expiry / Max Attempts and similar field pairs. */
const SETTINGS_FORM_TWO_COL_GRID_CLASS = 'grid grid-cols-1 items-start sm:grid-cols-2';

/** Two-column grid + standard gap — prefer this over ad-hoc `cn(...)` at call sites. */
export const SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS = cn(
  SETTINGS_FORM_TWO_COL_GRID_CLASS,
  'gap-x-8 gap-y-5',
);

/** Three equal columns — triple field rows (install prompt labels, etc.). */
const SETTINGS_FORM_THREE_COL_GRID_CLASS =
  'grid grid-cols-1 items-start sm:grid-cols-2 lg:grid-cols-3';

/** Three-column grid + standard gap. */
export const SETTINGS_FORM_THREE_COL_GRID_GAP_CLASS = cn(
  SETTINGS_FORM_THREE_COL_GRID_CLASS,
  'gap-x-8 gap-y-5',
);

/** Four equal columns — icon slots and similar compact cells. */
const SETTINGS_FORM_FOUR_COL_GRID_CLASS =
  'grid grid-cols-1 items-start sm:grid-cols-2 lg:grid-cols-4';

/** Four-column grid + standard gap. */
export const SETTINGS_FORM_FOUR_COL_GRID_GAP_CLASS = cn(
  SETTINGS_FORM_FOUR_COL_GRID_CLASS,
  'gap-x-8 gap-y-5',
);

/** Card grid for settings list surfaces — two cards per row from `sm` upward. */
const SETTINGS_CARD_GRID_TWO_COL_CLASS =
  'grid grid-cols-1 items-start gap-2 sm:grid-cols-2';

/** Card grid for settings list surfaces — three cards per row on large viewports. */
const SETTINGS_CARD_GRID_CLASS =
  'grid grid-cols-1 items-start gap-2 sm:grid-cols-2 lg:grid-cols-3';

export const SettingsCardGrid: React.FC<{
  children: React.ReactNode;
  className?: string;
  /** Cards per row on `sm+` viewports. Default `3` (`2` on phone). */
  columns?: 2 | 3;
}> = ({ children, className, columns = 3 }) => (
  <div
    className={cn(
      columns === 2 ? SETTINGS_CARD_GRID_TWO_COL_CLASS : SETTINGS_CARD_GRID_CLASS,
      'px-5 py-4',
      className,
    )}
  >
    {children}
  </div>
);

export const SettingsCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <article className={cn(APP_TABLE_GRID_CARD_CLASS, 'flex h-full flex-col', className)}>
    {children}
  </article>
);

export const SettingsCardFieldRow: React.FC<{
  label: string;
  children: React.ReactNode;
  valueClassName?: string;
}> = ({ label, children, valueClassName }) => (
  <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-2">
    <span className="text-sm font-semibold text-slate-800">{label}</span>
    <div className={cn('flex min-w-0 items-center justify-end text-xs font-medium text-slate-500', valueClassName)}>
      {children}
    </div>
  </div>
);

/** In-group subsection label (no extra `divided` spacing). */
export const SETTINGS_SUBSECTION_LABEL_CLASS =
  'ps-[4px] text-sm font-medium normal-case tracking-normal text-slate-700';

const SETTINGS_DISABLED_FIELDSET_CLASS =
  'min-w-0 border-0 p-0 m-0 disabled:opacity-60';

/**
 * Disabled fieldset for settings feature toggles.
 * Never put space-y/gap stack utilities on `<fieldset>` — wrap children in an inner div instead.
 */
export const SettingsDisabledFieldset: React.FC<{
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ disabled, className, children }) => (
  <fieldset disabled={disabled} className={cn(SETTINGS_DISABLED_FIELDSET_CLASS, className)}>
    <div className={SETTINGS_FORM_GROUP_BODY_STACK_CLASS}>{children}</div>
  </fieldset>
);

const useSettingsTypography = () => {
  const section = useSettingsFormSection();
  return section?.typography ?? getSettingsTypography('cache');
};

type SettingsFormShellProps = {
  maxWidth?: '2xl' | '3xl' | '6xl';
  className?: string;
  children: React.ReactNode;
};

export const SettingsFormShell: React.FC<SettingsFormShellProps> = ({
  maxWidth = '6xl',
  className,
  children,
}) => (
  <div className={cn('flex-1 overflow-y-auto bg-slate-50', SETTINGS_FORM_SHELL_PADDING_CLASS, className)}>
    <div
      className={cn(
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        SETTINGS_SURFACE_STACK_CLASS,
        maxWidth === '6xl' ? 'max-w-6xl' : maxWidth === '3xl' ? 'max-w-3xl' : 'max-w-2xl',
      )}
    >
      {children}
    </div>
  </div>
);

type SettingsFormGroupProps = {
  title?: string;
  sectionId: SectionId;
  tone?: AppSurfaceBoxTone;
  description?: string;
  /** Shown in an info tooltip beside the group title. */
  titleInfo?: string;
  /** When true, adds top spacing before this section (use on all groups after the first). */
  divided?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
};

export const SettingsFormGroup: React.FC<SettingsFormGroupProps> = ({
  title,
  sectionId,
  tone = 'slate',
  description,
  titleInfo,
  className,
  bodyClassName,
  children,
}) => {
  const typography = getSettingsTypography(sectionId);
  const resolvedTitle = title?.trim() ?? '';

  return (
    <SettingsFormSectionContext.Provider value={{ sectionId, typography }}>
      <AppSurfaceBox
        tone={tone}
        className={cn(SETTINGS_SURFACE_CARD_CLASS, className)}
        bodyClassName={SETTINGS_SURFACE_CARD_BODY_CLASS}
      >
        {resolvedTitle ? (
          <div className="mb-4 flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <p className={SETTINGS_SURFACE_CARD_TITLE_CLASS}>{resolvedTitle}</p>
              {titleInfo?.trim() ? (
                <FieldHintTooltip
                  hint={titleInfo.trim()}
                  label={resolvedTitle}
                  className="text-slate-400"
                />
              ) : null}
            </div>
            {description ? <p className={typography.groupDesc}>{description}</p> : null}
          </div>
        ) : null}
        <div className={cn(SETTINGS_FORM_GROUP_BODY_STACK_CLASS, bodyClassName)}>
          {children}
        </div>
      </AppSurfaceBox>
    </SettingsFormSectionContext.Provider>
  );
};

type SettingsFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  /** Shown in an info tooltip beside the label. */
  labelInfo?: string;
  /** When false, omits the min-h-8 label band — use for full-width fields stacked below grids. Default true. */
  labelBand?: boolean;
  /** When false, omits the empty info-icon slot so the hint sits flush against the label. Default true. */
  reserveInfoSlot?: boolean;
  /** Overrides section field-label tokens (e.g. Title Case on a migrated Settings card). */
  labelClassName?: string;
  className?: string;
  children: React.ReactNode;
};

export const SettingsField: React.FC<SettingsFieldProps> = ({
  label,
  htmlFor,
  hint,
  labelInfo,
  labelBand = true,
  reserveInfoSlot = false,
  labelClassName,
  className,
  children,
}) => {
  const typography = useSettingsTypography();

  return (
    <div
      className={cn('flex flex-col gap-[2px]', className)}
      {...(labelInfo?.trim()
        ? pageGuideProps({
          title: label,
          hint: labelInfo.trim(),
          priority: 50,
          surface: true,
        })
        : {})}
    >
      <div className={labelBand ? SETTINGS_FIELD_LABEL_BAND_CLASS : undefined}>
        <SettingsLabelInfoRow
          label={label}
          htmlFor={htmlFor}
          labelInfo={labelInfo}
          reserveInfoSlot={reserveInfoSlot}
          labelClassName={labelClassName ?? typography.fieldLabel}
        />
      </div>
      {children}
      {hint ? <p className={typography.fieldHint}>{hint}</p> : null}
    </div>
  );
};

type SettingsToggleFieldProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  /** Shown in an info tooltip beside the toggle title. */
  titleInfo?: string;
  disabled?: boolean;
};

export const SettingsToggleField: React.FC<SettingsToggleFieldProps> = ({
  id,
  checked,
  onChange,
  title,
  description,
  titleInfo,
  disabled,
}) => {
  const typography = useSettingsTypography();

  return (
    <div
      className="min-w-0"
      {...(titleInfo?.trim()
        ? pageGuideProps({
          title,
          hint: titleInfo.trim(),
          priority: 50,
          surface: true,
        })
        : {})}
    >
    <FeatureToggleField
      id={id}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      description={description && !titleInfo ? description : undefined}
      descriptionClassName={typography.toggleDesc}
      title={(
        <SettingsLabelInfoRow
          label={title}
          labelInfo={titleInfo}
          labelClassName={checked ? typography.toggleTitleActive : typography.toggleTitle}
        />
      )}
    />
    </div>
  );
};

/** Shared two-column grid for toggle + trailing checkbox rows (aligns with field-pair grids). */
const SETTINGS_TOGGLE_TRAILING_ROW_GRID_CLASS = cn(
  SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS,
  'items-center',
);

export const SettingsToggleTrailingRow: React.FC<{
  children: React.ReactNode;
  trailing: React.ReactNode;
}> = ({ children, trailing }) => (
  <div className={SETTINGS_TOGGLE_TRAILING_ROW_GRID_CLASS}>
    <div className="min-w-0">{children}</div>
    <div className="min-w-0 sm:flex sm:items-center">{trailing}</div>
  </div>
);

type SettingsInlineCheckboxProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
};

/** Plain checkbox + label (no bordered card). */
export const SettingsInlineCheckbox: React.FC<SettingsInlineCheckboxProps> = ({
  id,
  checked,
  onChange,
  label,
  disabled,
  className,
}) => {
  const typography = useSettingsTypography();

  return (
    <UiCheckboxChoice
      id={id}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className={cn('shrink-0', className)}
    >
      <span className={checked ? typography.checkboxLabelChecked : typography.checkboxLabel}>
        {label}
      </span>
    </UiCheckboxChoice>
  );
};

type SettingsCheckboxCardProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
  disabled?: boolean;
};

export const SettingsCheckboxCard: React.FC<SettingsCheckboxCardProps> = ({
  id,
  checked,
  onChange,
  label,
  className,
  disabled,
}) => {
  const typography = useSettingsTypography();

  return (
    <UiCheckboxChoice
      id={id}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className={cn(
        typography.checkboxCard,
        checked && typography.checkboxCardChecked,
        className,
      )}
    >
      <span className={checked ? typography.checkboxLabelChecked : typography.checkboxLabel}>
        {label}
      </span>
    </UiCheckboxChoice>
  );
};

