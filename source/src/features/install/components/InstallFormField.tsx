import React from 'react';
import { cn } from '../../../lib/utils';
import {
  FORM_FIELD_ERROR_CLASS,
  FORM_FIELD_LABEL_CLASS,
  type FormFieldProps,
} from '../../../shared/ui/FormSection';
import { DEFAULT_FIELD_FEEDBACK_PLACEMENT } from '../../../shared/ui/fieldFeedback';

export const INSTALL_FORM_FIELD_LABEL_CLASS = cn(
  FORM_FIELD_LABEL_CLASS,
  'w-[8rem] shrink-0 normal-case tracking-normal leading-snug',
);

/** Vertical stack for aligned inline label + input rows. */
export const INSTALL_FORM_FIELD_STACK_CLASS = 'flex flex-col gap-3';

const applyFormFieldProps = (
  children: React.ReactNode,
  options: {
    isInvalid: boolean;
    error?: string | null;
    showError: boolean;
    feedbackPlacement: FormFieldProps['feedbackPlacement'];
  },
): React.ReactNode => {
  if (!React.isValidElement(children)) return children;

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

export type InstallFormFieldProps = FormFieldProps & {
  align?: 'center' | 'start';
  /** Optional width constraint on the control column (e.g. port fields). */
  controlClassName?: string;
  /** Override default install wizard label column width. */
  labelClassName?: string;
};

export const InstallFormField: React.FC<InstallFormFieldProps> = ({
  label,
  required,
  error,
  invalid,
  showError = true,
  feedbackPlacement = DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  className,
  labelExtra,
  align = 'center',
  controlClassName,
  labelClassName,
  children,
}) => {
  const isInvalid = Boolean(invalid ?? error);
  const showErrorBelow = showError && feedbackPlacement === 'below' && Boolean(error);

  return (
    <div className={cn('flex gap-3', align === 'start' ? 'items-start' : 'items-center', className)}>
      <div className={cn(INSTALL_FORM_FIELD_LABEL_CLASS, labelClassName, labelExtra && 'space-y-0.5')}>
        <label className="block">
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </label>
        {labelExtra ? <div className="text-xs font-normal text-slate-500 leading-snug">{labelExtra}</div> : null}
      </div>
      <div className={cn('min-w-0 flex-1 flex flex-col gap-[2px]', controlClassName)}>
        {applyFormFieldProps(children, { isInvalid, error, showError, feedbackPlacement })}
        {showErrorBelow ? <p className={FORM_FIELD_ERROR_CLASS} role="alert">{error}</p> : null}
      </div>
    </div>
  );
};
