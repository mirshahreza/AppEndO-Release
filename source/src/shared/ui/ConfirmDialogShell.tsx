import React from 'react';
import { AlertTriangle, Check, Loader2, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';
import type { ButtonIntent } from './buttonSemantics';
import {
  AppDialogShell,
  DialogBand,
  DialogBody,
  DialogFooter,
  DialogPrimaryHeader,
} from './dialog';
import type {
  CreateEditModalSize,
  DialogBandTone,
  DialogPrimaryHeaderTone,
  AppSurfaceBoxTone,
  DialogBackdropBlur,
  DialogBackdropTint,
  DialogBackdropTransparency,
} from './surfaceClasses';
import type { SurfaceChromeColorSource } from './surfaceChromeClasses';

export type ConfirmDialogShellProps = {
  open?: boolean;
  title: React.ReactNode;
  icon?: React.ReactNode;
  /** Optional second header row below the primary title (e.g. entity name). */
  subtitle?: React.ReactNode;
  subtitleTone?: DialogBandTone;
  subtitleClassName?: string;
  /** Header band tone; defaults to `danger` when `confirmIntent` is `destructive`. */
  tone?: DialogPrimaryHeaderTone;
  /** Preset surface chrome tone when `colorSource` is `tone`. */
  chromeTone?: AppSurfaceBoxTone;
  colorSource?: SurfaceChromeColorSource;
  customColorHex?: string;
  /** Tone class on the icon+title row, e.g. text-rose-600 */
  iconToneClassName?: string;
  size?: CreateEditModalSize;
  onClose: () => void;
  onBackdropClick?: () => void;
  closeOnEscape?: boolean;
  backdropClassName?: string;
  children?: React.ReactNode;
  error?: React.ReactNode;
  /** Replaces the default cancel/confirm footer */
  footer?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  /** Leading icon for cancel; defaults to `X`. */
  cancelIcon?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  /** Leading icon for confirm; defaults by `confirmIntent` when omitted. */
  confirmIcon?: React.ReactNode;
  onConfirm?: () => void;
  confirmIntent?: ButtonIntent;
  cancelDisabled?: boolean;
  confirmDisabled?: boolean;
  isConfirming?: boolean;
  confirmingLabel?: React.ReactNode;
  hideCancel?: boolean;
  hideConfirm?: boolean;
  /** Initial focus target for the default footer. Defaults to the safer cancel action. */
  initialFocus?: 'cancel' | 'confirm';
  bodyClassName?: string;
  /** DialogBody outer slot (e.g. docked side-panel flex column). */
  bodyOuterClassName?: string;
  /** AppDialogShell surface class (e.g. min-height for docked rail). */
  shellClassName?: string;
  /** When true, body outer grows in tall/maximized shells (see DialogBody `fill`). */
  bodyFill?: boolean;
  /** Optional band between body and action footer (e.g. validation status). */
  auxiliaryFooter?: React.ReactNode;
  auxiliaryFooterClassName?: string;
  /** Action footer class (e.g. `!mt-0` when a side rail meets the footer). */
  footerClassName?: string;
  /** Render inside a relative ancestor — Base Components catalog preview. */
  contained?: boolean;
  backdropTint?: DialogBackdropTint;
  backdropBlur?: DialogBackdropBlur;
  backdropTransparency?: DialogBackdropTransparency;
  /** When false, hides the header close control so the operator must use footer actions. Default true. */
  showCloseButton?: boolean;
  /** Icon-only controls rendered before close; use AppButton size="icon-sm" only. */
  headerExtra?: React.ReactNode;
};

const CONFIRM_DIALOG_BUTTON_ICON_CLASS = 'h-3.5 w-3.5';

const resolveConfirmDialogConfirmIcon = (
  confirmIntent: ButtonIntent,
  confirmIcon?: React.ReactNode,
): React.ReactNode => {
  if (confirmIcon != null) {
    return confirmIcon;
  }

  switch (confirmIntent) {
    case 'destructive':
    case 'destructive-soft':
      return <Trash2 className={CONFIRM_DIALOG_BUTTON_ICON_CLASS} />;
    case 'warning':
      return <AlertTriangle className={CONFIRM_DIALOG_BUTTON_ICON_CLASS} />;
    default:
      return <Check className={CONFIRM_DIALOG_BUTTON_ICON_CLASS} />;
  }
};

export const ConfirmDialogShell: React.FC<ConfirmDialogShellProps> = ({
  open = true,
  title,
  icon,
  subtitle,
  subtitleTone = 'elevated',
  subtitleClassName,
  tone,
  iconToneClassName = 'text-rose-600',
  size = 'sm',
  onClose,
  onBackdropClick = onClose,
  closeOnEscape = true,
  backdropClassName,
  children,
  error,
  footer,
  cancelLabel = 'Cancel',
  cancelIcon,
  confirmLabel = 'Confirm',
  confirmIcon,
  onConfirm,
  confirmIntent = 'destructive',
  cancelDisabled = false,
  confirmDisabled = false,
  isConfirming = false,
  confirmingLabel = 'Processing…',
  hideCancel = false,
  hideConfirm = false,
  initialFocus = 'cancel',
  bodyClassName,
  bodyOuterClassName,
  shellClassName,
  bodyFill = false,
  auxiliaryFooter,
  auxiliaryFooterClassName,
  footerClassName,
  colorSource = 'accent',
  chromeTone = 'slate',
  customColorHex,
  contained = false,
  backdropTint,
  backdropBlur,
  backdropTransparency,
  showCloseButton = true,
  headerExtra,
}) => {
  if (!open) {
    return null;
  }

  const resolvedTone: DialogPrimaryHeaderTone = tone ?? (confirmIntent === 'destructive' ? 'danger' : 'default');
  const isDangerHeader = resolvedTone === 'danger';

  const headerTitle = icon ? (
    <span
      className={cn(
        'inline-flex items-center gap-2',
        isDangerHeader ? 'text-rose-800' : iconToneClassName,
      )}
    >
      <span className="inline-flex shrink-0 items-center overflow-hidden [&_svg]:shrink-0" aria-hidden>
        {icon}
      </span>
      {!isDangerHeader ? <span className="text-slate-800">{title}</span> : title}
    </span>
  ) : title;

  const resolvedCancelIcon = cancelIcon ?? <X className={CONFIRM_DIALOG_BUTTON_ICON_CLASS} />;
  const resolvedConfirmIcon = resolveConfirmDialogConfirmIcon(confirmIntent, confirmIcon);

  const defaultFooter = (
    <>
      {!hideCancel ? (
        <AppButton
          intent="cancel"
          size="sm"
          onClick={onClose}
          autoFocus={initialFocus === 'cancel'}
          disabled={cancelDisabled || isConfirming}
        >
          {resolvedCancelIcon}
          {cancelLabel}
        </AppButton>
      ) : null}
      {!hideConfirm && onConfirm ? (
        <AppButton
          intent={confirmIntent}
          size="sm"
          onClick={() => void onConfirm()}
          autoFocus={initialFocus === 'confirm'}
          disabled={confirmDisabled || isConfirming}
        >
          {isConfirming ? (
            <>
              <Loader2 className={`${CONFIRM_DIALOG_BUTTON_ICON_CLASS} animate-spin`} />
              {confirmingLabel}
            </>
          ) : (
            <>
              {resolvedConfirmIcon}
              {confirmLabel}
            </>
          )}
        </AppButton>
      ) : null}
    </>
  );

  const showFooter = footer != null || !hideCancel || (!hideConfirm && onConfirm != null);

  return (
    <AppDialogShell
      backdrop="admin"
      size={size}
      onClose={onClose}
      onBackdropClick={onBackdropClick}
      closeOnEscape={closeOnEscape}
      backdropClassName={backdropClassName}
      colorSource={colorSource}
      tone={chromeTone}
      customColorHex={customColorHex}
      ariaLabel={typeof title === 'string' ? title : 'Confirm'}
      role="alertdialog"
      contained={contained}
      backdropTint={backdropTint}
      backdropBlur={backdropBlur}
      backdropTransparency={backdropTransparency}
      shellClassName={shellClassName}
    >
      <DialogPrimaryHeader
        title={headerTitle}
        onClose={onClose}
        tone={resolvedTone}
        showCloseButton={showCloseButton}
        headerExtra={headerExtra}
      />
      {subtitle != null ? (
        <DialogBand
          tone={subtitleTone}
          className={cn('min-w-0 overflow-hidden py-2 text-[11px] text-slate-600', subtitleClassName)}
        >
          {subtitle}
        </DialogBand>
      ) : null}
      <DialogBody
        gradient={false}
        fill={bodyFill}
        outerClassName={bodyOuterClassName}
        innerClassName={cn('flex flex-col gap-3', bodyClassName)}
      >
        {children != null ? (
          typeof children === 'string' || typeof children === 'number' ? (
            <p className="text-xs text-slate-600">{children}</p>
          ) : (
            children
          )
        ) : null}
        {error != null ? (
          <p className="text-xs font-semibold text-rose-600">{error}</p>
        ) : null}
      </DialogBody>
      {auxiliaryFooter != null ? (
        <DialogFooter variant="auxiliary" className={auxiliaryFooterClassName}>
          {auxiliaryFooter}
        </DialogFooter>
      ) : null}
      {showFooter ? (
        <DialogFooter variant="action" stacked={auxiliaryFooter != null} className={footerClassName}>
          {footer ?? defaultFooter}
        </DialogFooter>
      ) : null}
    </AppDialogShell>
  );
};
