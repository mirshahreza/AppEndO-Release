import React from 'react';
import { cn } from '@/lib/utils';
import { UiCheckboxChoice } from '@/shared/ui';

export type UserFormSectionTone = 'indigo' | 'sky' | 'violet' | 'emerald';

const SECTION_TONE_CLASS: Record<UserFormSectionTone, { bar: string; title: string }> = {
  indigo: { bar: 'bg-indigo-400', title: 'text-indigo-700' },
  sky: { bar: 'bg-sky-500', title: 'text-sky-700' },
  violet: { bar: 'bg-violet-400', title: 'text-violet-700' },
  emerald: { bar: 'bg-emerald-400', title: 'text-emerald-700' },
};

export const USER_FORM_FIELD_LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-wider text-slate-600 ps-[4px]';

export const USER_FORM_FIELD_ERROR_CLASS =
  'text-[11px] font-medium text-rose-600 ps-[4px]';

export const USER_FORM_SECTION_DESC_CLASS =
  'text-xs font-medium leading-relaxed text-slate-500 ps-[4px]';

type UserFormSectionProps = {
  title: string;
  tone?: UserFormSectionTone;
  description?: string;
  /** When true, adds top spacing before this section (after the first group). */
  divided?: boolean;
  className?: string;
  children: React.ReactNode;
};

export const UserFormSection: React.FC<UserFormSectionProps> = ({
  title,
  tone = 'indigo',
  description,
  divided = false,
  className,
  children,
}) => {
  const accent = SECTION_TONE_CLASS[tone];

  return (
    <section
      className={cn(
        'space-y-3',
        divided && 'pt-5 mt-1',
        className,
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2 ps-[4px]">
          <span className={cn('h-3.5 w-0.5 shrink-0 rounded-full', accent.bar)} aria-hidden />
          <h3 className={cn('text-[11px] font-bold uppercase tracking-wider', accent.title)}>
            {title}
          </h3>
        </div>
        {description ? (
          <p className={USER_FORM_SECTION_DESC_CLASS}>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
};

type UserFormFieldProps = {
  label: string;
  required?: boolean;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
};

export const UserFormField: React.FC<UserFormFieldProps> = ({
  label,
  required,
  error,
  className,
  children,
}) => (
  <div className={cn('flex flex-col gap-[2px]', className)}>
    <label className={USER_FORM_FIELD_LABEL_CLASS}>
      {label}
      {required ? <span className="text-rose-500"> *</span> : null}
    </label>
    {children}
    {error ? <p className={USER_FORM_FIELD_ERROR_CLASS}>{error}</p> : null}
  </div>
);

export const UserFormRoleOption: React.FC<{
  id: string;
  role: string;
  checked: boolean;
  onToggle: () => void;
}> = ({ id, role, checked, onToggle }) => (
  <UiCheckboxChoice
    id={id}
    checked={checked}
    onChange={() => onToggle()}
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
