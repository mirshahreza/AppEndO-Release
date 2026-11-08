import React from 'react';
import { cn } from '../../../lib/utils';
import { FormField, FormSection, UiCheckboxChoice, type FormThemeInk } from '../../../shared/ui';

export type UserFormSectionTone = 'indigo' | 'sky' | 'violet' | 'emerald';

const TONE_TO_INK: Record<UserFormSectionTone, FormThemeInk> = {
  indigo: 'accent',
  sky: 'complement',
  violet: 'contrast',
  emerald: 'accent',
};

export const USER_FORM_FIELD_LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-wider text-slate-600 ps-[4px]';

export const USER_FORM_SECTION_DESC_CLASS =
  'text-xs font-medium leading-relaxed text-slate-500 ps-[4px]';

type UserFormSectionProps = {
  title: string;
  tone?: UserFormSectionTone;
  description?: string;
  /** When true, adds top spacing before this section (after the first group). */
  divided?: boolean;
  titleExtra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export const UserFormSection: React.FC<UserFormSectionProps> = ({
  title,
  tone = 'indigo',
  description,
  divided = false,
  titleExtra,
  className,
  children,
}) => (
  <FormSection
    title={title}
    ink={TONE_TO_INK[tone]}
    hint={description}
    divided={divided}
    titleExtra={titleExtra}
    className={className}
  >
    {children}
  </FormSection>
);

type UserFormFieldProps = {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  className?: string;
  labelExtra?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export const UserFormField: React.FC<UserFormFieldProps> = ({
  label,
  required,
  error,
  hint,
  className,
  labelExtra,
  footer,
  children,
}) => (
  <FormField
    label={label}
    required={required}
    error={error}
    invalid={Boolean(error)}
    hint={hint}
    className={className}
    labelExtra={labelExtra}
  >
    {children}
    {footer}
  </FormField>
);

export const UserFormRoleOption: React.FC<{
  id: string;
  role: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}> = ({ id, role, checked, onCheckedChange }) => (
  <UiCheckboxChoice
    id={id}
    checked={checked}
    onChange={(nextChecked) => onCheckedChange(nextChecked)}
    className={cn(
      'rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
      checked
        ? 'text-violet-800 bg-violet-50/80'
        : 'text-slate-700 hover:bg-slate-50',
    )}
  >
    {role}
  </UiCheckboxChoice>
);
