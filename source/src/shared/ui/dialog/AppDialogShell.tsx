import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../lib/utils';
import { useViewportTier } from '../../lib/useViewportTier';
import { isCompactChromeTier } from '../../lib/viewportTokens';
import { OrbitBorderFrame } from '../OrbitBorderFrame';
import { SurfaceChromeProvider } from '../SurfaceChromeContext';
import { DialogHostProvider } from './DialogHostContext';
import { INLINE_TRANSLATION_SCAN_ROOT_ATTR } from '../shell/inlineTranslationScanRoot';
import {
  DIALOG_SHELL_CHROME_BORDER_CLASS,
  resolveSurfaceChrome,
  type SurfaceChromeColorSource,
} from '../surfaceChromeClasses';
import {
  overlayMotionPanelProps,
} from '../overlay-motion/overlayMotion';
import {
  CONTAINED_DESIGNER_BACKDROP_CLASS,
  CREATE_EDIT_MODAL_PHONE_BACKDROP_CLASS,
  CREATE_EDIT_MODAL_PHONE_SHELL_CLASS,
  CREATE_EDIT_MODAL_SHELL_CLASS,
  CREATE_EDIT_MODAL_SIZE_CLASS,
  DIALOG_BACKDROP_DESIGNER_CLASS,
  resolveDialogAdminBackdropClass,
  resolveDialogAdminBackdropTone,
  resolveDialogBackdropLayoutClass,
  resolveDialogBackdropScrimClass,
  toContainedOverlayClass,
  type AppSurfaceBoxTone,
  type CreateEditModalSize,
  type DialogAdminBackdropProfile,
  type DialogBackdropBlur,
  type DialogBackdropTint,
  type DialogBackdropTransparency,
} from '../surfaceClasses';

export type DialogBackdropProfile = DialogAdminBackdropProfile | 'designer';

export type AppDialogShellProps = {
  children: React.ReactNode;
  /** When false, nothing is rendered. Default true. */
  open?: boolean;
  backdrop?: DialogBackdropProfile;
  size?: CreateEditModalSize;
  onClose?: () => void;
  onBackdropClick?: () => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  backdropClassName?: string;
  shellClassName?: string;
  /** Overrides inherited document direction for English-only or fixed-layout dialogs. */
  shellDirection?: 'ltr' | 'rtl';
  /** Designer profile only — width/layout override on the inner surface. */
  designerSurfaceClassName?: string;
  /** Accessible label for designer native dialog. */
  ariaLabel?: string;
  /** ARIA role for the dialog surface. Default `dialog`; confirms use `alertdialog`. */
  role?: 'dialog' | 'alertdialog';
  /** Comet traveling the shell perimeter (Base Components orbit-border). */
  shellOrbitBorder?: boolean;
  /** Accent theme, preset tone, or custom hex — tints border + header only. Default `accent`. */
  colorSource?: SurfaceChromeColorSource;
  /** Preset tone when `colorSource` is `tone`. Default `slate`. */
  tone?: AppSurfaceBoxTone;
  /** Custom hex when `colorSource` is `custom`. */
  customColorHex?: string;
  /**
   * Render inside a relative ancestor (no `document.body` portal).
   * Catalog previews use this so the dialog stays centered in the preview pane.
   */
  contained?: boolean;
  /** Scrim darkness. When set, composes instead of the named backdrop profile. */
  backdropTint?: DialogBackdropTint;
  /** Backdrop blur. When set, composes instead of the named backdrop profile. */
  backdropBlur?: DialogBackdropBlur;
  /** Extra see-through on the scrim only. When set, composes instead of the named profile. */
  backdropTransparency?: DialogBackdropTransparency;
};

export const AppDialogShell: React.FC<AppDialogShellProps> = ({
  children,
  open = true,
  backdrop = 'admin',
  size = 'auto',
  onClose,
  onBackdropClick,
  closeOnEscape = true,
  closeOnBackdrop = true,
  backdropClassName,
  shellClassName,
  shellDirection,
  designerSurfaceClassName,
  ariaLabel = 'Dialog',
  role = 'dialog',
  shellOrbitBorder = false,
  colorSource = 'accent',
  tone = 'slate',
  customColorHex,
  contained = false,
  backdropTint,
  backdropBlur,
  backdropTransparency,
}) => {
  const viewportTier = useViewportTier();
  const chrome = useMemo(
    () => resolveSurfaceChrome({ colorSource, tone, customColorHex }),
    [colorSource, customColorHex, tone],
  );
  const useCompactFullscreen = !contained && isCompactChromeTier(viewportTier) && size !== 'full';
  const isEdgeToEdge = size === 'full' || useCompactFullscreen;
  const isContainedMaximized = contained && (size === 'maximized' || size === 'full');
  const sizeClassName = useCompactFullscreen
    ? CREATE_EDIT_MODAL_PHONE_SHELL_CLASS
    : isContainedMaximized
      ? (size === 'full' ? CREATE_EDIT_MODAL_SIZE_CLASS.full : 'h-full w-full max-h-full min-h-0')
      : CREATE_EDIT_MODAL_SIZE_CLASS[size];
  const containedSizeClassName = contained && !isContainedMaximized
    ? 'max-h-full'
    : undefined;
  const dialogMotion = overlayMotionPanelProps({
    kind: 'dialog',
    origin: useCompactFullscreen ? 'bottom' : 'center',
  });
  const shellPanelClassName = cn(
    dialogMotion.className,
    CREATE_EDIT_MODAL_SHELL_CLASS,
    !shellOrbitBorder && sizeClassName,
    containedSizeClassName,
    shellOrbitBorder && 'relative z-[1] h-full w-full !border-0',
    !shellOrbitBorder && DIALOG_SHELL_CHROME_BORDER_CLASS,
    !shellOrbitBorder && chrome.shell,
    shellClassName,
  );
  const shellPanelStyle = shellOrbitBorder ? undefined : chrome.shellStyle;

  const isAdminBackdrop = backdrop !== 'designer';

  React.useEffect(() => {
    if (!open || !isAdminBackdrop || !closeOnEscape || !onClose) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, isAdminBackdrop, closeOnEscape, onClose]);

  if (!open) {
    return null;
  }

  if (backdrop === 'designer' && !contained) {
    return (
      <DesignerNativeDialogShell
        ariaLabel={ariaLabel}
        closeOnBackdrop={closeOnBackdrop}
        closeOnEscape={closeOnEscape}
        colorSource={colorSource}
        tone={tone}
        customColorHex={customColorHex}
        designerSurfaceClassName={designerSurfaceClassName}
        onBackdropClick={onBackdropClick}
        onClose={onClose}
        shellClassName={shellPanelClassName}
        shellDirection={shellDirection}
        shellOrbitBorder={shellOrbitBorder}
        shellPanelStyle={shellPanelStyle}
        sizeClassName={sizeClassName}
      >
        {children}
      </DesignerNativeDialogShell>
    );
  }

  const profileTone = backdrop === 'designer'
    ? { tint: 'faint' as const, blur: 'default' as const }
    : resolveDialogAdminBackdropTone(backdrop);
  const useComposedBackdrop = !useCompactFullscreen
    && (backdropTint != null || backdropBlur != null || backdropTransparency != null);
  const composedLayoutClass = useComposedBackdrop
    ? resolveDialogBackdropLayoutClass(isEdgeToEdge)
    : null;
  const composedScrimClass = useComposedBackdrop
    ? resolveDialogBackdropScrimClass({
        tint: backdropTint ?? profileTone.tint,
        blur: backdropBlur ?? profileTone.blur,
        transparency: backdropTransparency ?? 'opaque',
      })
    : null;

  const adminBackdropClass = useCompactFullscreen
    ? CREATE_EDIT_MODAL_PHONE_BACKDROP_CLASS
    : (composedLayoutClass ?? resolveDialogAdminBackdropClass(
        backdrop === 'designer' ? 'admin' : backdrop,
        isEdgeToEdge,
      ));

  const shellPanel = (
    <SurfaceChromeProvider colorSource={colorSource} tone={tone} customColorHex={customColorHex}>
      <DialogHostProvider>
        <div
          role={role}
          aria-modal={contained ? undefined : true}
          aria-label={ariaLabel}
          dir={shellDirection}
          {...{ [INLINE_TRANSLATION_SCAN_ROOT_ATTR]: true }}
          data-overlay-kind={dialogMotion['data-overlay-kind']}
          data-overlay-origin={dialogMotion['data-overlay-origin']}
          className={shellPanelClassName}
          style={shellPanelStyle}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </DialogHostProvider>
    </SurfaceChromeProvider>
  );

  const shellContent = shellOrbitBorder ? (
    <OrbitBorderFrame className={cn(sizeClassName, containedSizeClassName)} hostBackground="transparent">
      {shellPanel}
    </OrbitBorderFrame>
  ) : (
    shellPanel
  );

  const backdropClass = contained
    ? (backdrop === 'designer' && composedLayoutClass == null
        ? CONTAINED_DESIGNER_BACKDROP_CLASS
        : toContainedOverlayClass(adminBackdropClass))
    : adminBackdropClass;

  const overlay = (
    <div
      className={cn(backdropClass, backdropClassName)}
      onClick={onBackdropClick}
    >
      {composedScrimClass ? (
        <div className={composedScrimClass} aria-hidden data-dialog-scrim="" />
      ) : null}
      {composedScrimClass ? (
        <div className="relative z-[1]">{shellContent}</div>
      ) : shellContent}
    </div>
  );

  if (contained) {
    return overlay;
  }

  return createPortal(overlay, document.body);
};

type DesignerNativeDialogShellProps = {
  children: React.ReactNode;
  ariaLabel: string;
  shellClassName: string;
  shellDirection?: 'ltr' | 'rtl';
  shellPanelStyle?: React.CSSProperties;
  sizeClassName: string;
  shellOrbitBorder?: boolean;
  designerSurfaceClassName?: string;
  colorSource: SurfaceChromeColorSource;
  tone: AppSurfaceBoxTone;
  customColorHex?: string;
  onClose?: () => void;
  onBackdropClick?: () => void;
  closeOnEscape: boolean;
  closeOnBackdrop: boolean;
};

const DesignerNativeDialogShell: React.FC<DesignerNativeDialogShellProps> = ({
  children,
  ariaLabel,
  shellClassName,
  shellDirection,
  shellPanelStyle,
  sizeClassName,
  shellOrbitBorder = false,
  designerSurfaceClassName,
  colorSource,
  tone,
  customColorHex,
  onClose,
  onBackdropClick,
  closeOnEscape,
  closeOnBackdrop,
}) => {
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    return () => {
      if (dialog.open) {
        if (typeof dialog.close === 'function') {
          dialog.close();
        } else {
          dialog.removeAttribute('open');
        }
      }
    };
  }, []);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !onClose) {
      return;
    }

    const handleDialogClose = () => {
      onClose();
    };

    dialog.addEventListener('close', handleDialogClose);
    return () => {
      dialog.removeEventListener('close', handleDialogClose);
    };
  }, [onClose]);

  const handleClose = () => {
    onClose?.();
    onBackdropClick?.();
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className={DIALOG_BACKDROP_DESIGNER_CLASS}
      data-designer-dialog-backdrop=""
      aria-label={ariaLabel}
      onCancel={(event) => {
        event.preventDefault();
        if (closeOnEscape) {
          handleClose();
        }
      }}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      {shellOrbitBorder ? (
        <OrbitBorderFrame className={sizeClassName} hostBackground="transparent">
          <SurfaceChromeProvider colorSource={colorSource} tone={tone} customColorHex={customColorHex}>
            <DialogHostProvider>
              <div
                dir={shellDirection}
                className={cn(
                  'flex w-full flex-col overflow-hidden font-sans',
                  shellClassName,
                  designerSurfaceClassName,
                )}
                style={shellPanelStyle}
                onClick={(event) => event.stopPropagation()}
              >
                {children}
              </div>
            </DialogHostProvider>
          </SurfaceChromeProvider>
        </OrbitBorderFrame>
      ) : (
        <SurfaceChromeProvider colorSource={colorSource} tone={tone} customColorHex={customColorHex}>
          <DialogHostProvider>
            <div
              dir={shellDirection}
              className={cn(
                'flex w-full flex-col overflow-hidden font-sans',
                shellClassName,
                designerSurfaceClassName,
              )}
              style={shellPanelStyle}
              onClick={(event) => event.stopPropagation()}
            >
              {children}
            </div>
          </DialogHostProvider>
        </SurfaceChromeProvider>
      )}
    </dialog>,
    document.body,
  );
};
