import React from 'react';
import { cn } from '../../lib/utils';
import {
  AppDialogShell,
  DialogBand,
  DialogBody,
  DialogFooter,
  DialogPrimaryHeader,
} from './dialog';
import type { CreateEditModalSize, DialogBandTone, DialogBackdropBlur, DialogBackdropTint, DialogBackdropTransparency } from './surfaceClasses';
import type { DialogBackdropProfile } from './dialog';
import type { SurfaceChromeProps } from './SurfaceChromeContext';

export type { CreateEditModalSize };

export type CreateEditModalShellProps = SurfaceChromeProps & {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Optional band between body and action footer (e.g. override policy). */
  auxiliaryFooter?: React.ReactNode;
  /** Optional band between auxiliary footer and action footer (e.g. repack summary note). */
  intermediateFooter?: React.ReactNode;
  /** Optional second header row (metadata); renders as a muted DialogBand below the primary header. */
  subtitle?: React.ReactNode;
  /** Secondary header band tone; defaults to `elevated` for contrast with the primary header. */
  subtitleTone?: DialogBandTone;
  /** Optional third header row below subtitle (e.g. primary form fields). */
  metaBand?: React.ReactNode;
  /** Third header band tone; defaults to `elevated`. */
  metaBandTone?: DialogBandTone;
  /** Optional fourth header row below metaBand (e.g. entity tabs / policy strip). */
  secondaryMetaBand?: React.ReactNode;
  /** Fourth header band tone; defaults to `elevated`. */
  secondaryMetaBandTone?: DialogBandTone;
  /** When false, omits the standard primary header. Default true. */
  showHeader?: boolean;
  /** Renders before the header close control (e.g. refresh + separator). */
  headerExtra?: React.ReactNode;
  /** When true (default), shows Studio tools in the dialog header when registered. */
  showStudioToolsMenu?: boolean;
  /** When true (default), shows feedback in the dialog header when registered. */
  showFeedbackButton?: boolean;
  /** Preset width/height; `auto` sizes to content, `maximized` fills viewport with inset, `full` is edge-to-edge. */
  size?: CreateEditModalSize;
  /** Backdrop tint/blur profile; defaults to `admin`. */
  backdrop?: DialogBackdropProfile;
  /** When false, body outer slot stays plain white (better for full-height split panes). */
  gradient?: boolean;
  backdropClassName?: string;
  shellClassName?: string;
  /** Force LTR/RTL on the dialog panel (e.g. English developer tools on RTL mounts). */
  shellDirection?: 'ltr' | 'rtl';
  headerClassName?: string;
  headerDirection?: 'ltr' | 'rtl';
  subtitleClassName?: string;
  metaBandClassName?: string;
  secondaryMetaBandClassName?: string;
  bodyOuterClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  auxiliaryFooterClassName?: string;
  intermediateFooterClassName?: string;
  onBackdropClick?: () => void;
  /** When false, Escape does not dismiss the dialog. Default true. */
  closeOnEscape?: boolean;
  /** When false, hides the header close control. Default true. */
  showCloseButton?: boolean;
  /** Accessible name when `title` is not a string. */
  ariaLabel?: string;
  /** Render inside a relative ancestor — Base Components catalog preview. */
  contained?: boolean;
  backdropTint?: DialogBackdropTint;
  backdropBlur?: DialogBackdropBlur;
  backdropTransparency?: DialogBackdropTransparency;
};

export const CreateEditModalShell: React.FC<CreateEditModalShellProps> = ({
  title,
  onClose,
  children,
  footer,
  auxiliaryFooter,
  intermediateFooter,
  subtitle,
  subtitleTone = 'elevated',
  metaBand,
  metaBandTone = 'elevated',
  secondaryMetaBand,
  secondaryMetaBandTone = 'elevated',
  showHeader = true,
  headerExtra,
  showStudioToolsMenu = true,
  showFeedbackButton = true,
  size = 'auto',
  gradient = false,
  backdrop = 'admin',
  backdropClassName,
  shellClassName,
  shellDirection,
  headerClassName,
  headerDirection,
  subtitleClassName,
  metaBandClassName,
  secondaryMetaBandClassName,
  bodyOuterClassName,
  bodyClassName,
  footerClassName,
  auxiliaryFooterClassName,
  intermediateFooterClassName,
  onBackdropClick,
  closeOnEscape = true,
  showCloseButton = true,
  ariaLabel,
  colorSource = 'accent',
  tone = 'slate',
  customColorHex,
  contained = false,
  backdropTint,
  backdropBlur,
  backdropTransparency,
}) => (
  <AppDialogShell
    backdrop={backdrop}
    size={size}
    onClose={onClose}
    onBackdropClick={onBackdropClick}
    closeOnEscape={closeOnEscape}
    backdropClassName={backdropClassName}
    shellClassName={shellClassName}
    shellDirection={shellDirection}
    colorSource={colorSource}
    tone={tone}
    customColorHex={customColorHex}
    ariaLabel={ariaLabel ?? (typeof title === 'string' ? title : 'Dialog')}
    contained={contained}
    backdropTint={backdropTint}
    backdropBlur={backdropBlur}
    backdropTransparency={backdropTransparency}
  >
    {showHeader ? (
      <DialogPrimaryHeader
        title={title}
        onClose={onClose}
        showCloseButton={showCloseButton}
        headerExtra={headerExtra}
        showStudioToolsMenu={showStudioToolsMenu}
        showFeedbackButton={showFeedbackButton}
        className={headerClassName}
        dir={headerDirection}
      />
    ) : null}
    {subtitle != null ? (
      <DialogBand
        tone={subtitleTone}
        className={cn('min-w-0 overflow-hidden py-1.5 text-[11px] text-slate-600', subtitleClassName)}
      >
        {subtitle}
      </DialogBand>
    ) : null}
    {metaBand != null ? (
      <DialogBand
        tone={metaBandTone}
        className={cn('min-w-0 overflow-hidden py-1.5 text-[11px] text-slate-600', metaBandClassName)}
      >
        {metaBand}
      </DialogBand>
    ) : null}
    {secondaryMetaBand != null ? (
      <DialogBand
        tone={secondaryMetaBandTone}
        className={cn('min-w-0 overflow-hidden py-1.5 text-[11px] text-slate-600', secondaryMetaBandClassName)}
      >
        {secondaryMetaBand}
      </DialogBand>
    ) : null}
    <DialogBody
      gradient={gradient}
      // Plain (non-gradient) bodies still need flex-1 for tall max-h shells; ConfirmDialogShell
      // passes fill={false} so short confirms do not collapse.
      fill
      outerClassName={bodyOuterClassName}
      innerClassName={bodyClassName}
    >
      {children}
    </DialogBody>
    {auxiliaryFooter != null ? (
      <DialogFooter variant="auxiliary" className={auxiliaryFooterClassName}>
        {auxiliaryFooter}
      </DialogFooter>
    ) : null}
    {intermediateFooter != null ? (
      <DialogFooter
        variant="auxiliary"
        stacked={auxiliaryFooter != null}
        className={intermediateFooterClassName}
      >
        {intermediateFooter}
      </DialogFooter>
    ) : null}
    {footer != null ? (
      <DialogFooter
        variant="action"
        stacked={auxiliaryFooter != null || intermediateFooter != null}
        className={footerClassName}
      >
        {footer}
      </DialogFooter>
    ) : null}
  </AppDialogShell>
);
