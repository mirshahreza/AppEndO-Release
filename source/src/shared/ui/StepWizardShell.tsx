import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useViewportTier } from '../lib/useViewportTier';
import { isCompactChromeTier } from '../lib/viewportTokens';
import { OrbitBorderFrame, type OrbitBorderPreset } from './OrbitBorderFrame';
import { overlayMotionPanelProps } from './overlay-motion/overlayMotion';
import { AppButton } from './AppButton';
import type { ButtonIntent } from './buttonSemantics';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';
import { DialogHostProvider } from './dialog/DialogHostContext';
import { SurfaceChromeProvider } from './SurfaceChromeContext';
import { INLINE_TRANSLATION_SCAN_ROOT_ATTR } from './shell/inlineTranslationScanRoot';
import { WindowChromeStudioToolsMenu } from './shell/registeredStudioToolsMenu';
import {
  resolveSurfaceChrome,
} from './surfaceChromeClasses';
import type { SurfaceChromeProps } from './SurfaceChromeContext';
import {
  resolveStepWizardTabAppearance,
  resolveStepWizardTabColorMode,
  type StepWizardTabColor,
} from './stepWizardTabColor';
import {
  APP_SURFACE_BOX_TONE_CLASS,
  resolveAppSurfaceBoxTone,
  CREATE_EDIT_MODAL_PHONE_BACKDROP_CLASS,
  CREATE_EDIT_MODAL_PHONE_SHELL_CLASS,
  CREATE_EDIT_MODAL_SHELL_CLASS,
  CREATE_EDIT_MODAL_SIZE_CLASS,
  DIALOG_PRIMARY_HEADER_ACTIONS_CLASS,
  DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS,
  STEP_WIZARD_BACKDROP_CLASS,
  resolveDialogBackdropLayoutClass,
  resolveDialogBackdropScrimClass,
  toContainedOverlayClass,
  STEP_WIZARD_BODY_CLASS,
  STEP_WIZARD_DESCRIPTION_LAYOUT_CLASS,
  STEP_WIZARD_DESCRIPTION_SURFACE_CLASS,
  STEP_WIZARD_FOOTER_LAYOUT_CLASS,
  STEP_WIZARD_HEADER_TITLE_ROW_CLASS,
  STEP_WIZARD_HEADER_TITLE_TEXT_CLASS,
  STEP_WIZARD_SHELL_HEIGHT_CLASS,
  STEP_WIZARD_STEP_INNER_CLASS,
  STEP_WIZARD_STEP_CELL_CLASS,
  STEP_WIZARD_CONTEXT_HEADER_LAYOUT_CLASS,
  STEP_WIZARD_STEPS_HEADER_LAYOUT_CLASS,
  STEP_WIZARD_TITLE_HEADER_LAYOUT_CLASS,
  type AppSurfaceBoxTone,
  type CreateEditModalSize,
  type DialogBackdropBlur,
  type DialogBackdropTint,
  type DialogBackdropTransparency,
} from './surfaceClasses';

export type StepWizardStepDef = {
  title: string;
  icon?: LucideIcon;
  description?: string;
  /** Semantic hue for the step indicator and description band when active. */
  tone?: AppSurfaceBoxTone;
  /** When true, the step is shown but cannot be activated or navigated to. */
  disabled?: boolean;
};

export type StepWizardStepInput = string | StepWizardStepDef;

export type StepWizardFinalAction = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
};

export type StepWizardShellProps = SurfaceChromeProps & {
  title: string;
  /** Optional icon tile shown to the left of the wizard title. */
  titleIcon?: LucideIcon;
  /** Optional brand mark (e.g. package logo) — takes precedence over `titleIcon`. */
  titleLeading?: React.ReactNode;
  /** Optional override for the title band (logo row) below the shell top edge. */
  titleHeaderClassName?: string;
  titleHeaderStyle?: React.CSSProperties;
  /** Fixed band under the title row and above step tabs (e.g. record context). Not scrolled with step body. */
  contextHeader?: React.ReactNode;
  subtitle?: string;
  /** Shown in the description band; defaults to the active step description. */
  stepDescription?: string;
  /** Optional control(s) aligned to the end of the description band. */
  stepDescriptionExtra?: React.ReactNode;
  steps: readonly StepWizardStepInput[];
  step: number;
  onStepChange: (next: number) => void;
  onClose: () => void;
  /** When false, hides the header close control so the operator must finish or cancel in the footer. Default true. */
  showCloseButton?: boolean;
  /** When false, omits the title/subtitle band (e.g. page chrome already shows branding). Default true. */
  showTitleHeader?: boolean;
  /** Icon-only controls rendered before close; use AppButton size="icon-sm" only. */
  headerExtra?: React.ReactNode;
  /** When true (default), shows Studio tools in the title header when registered. */
  showStudioToolsMenu?: boolean;
  children: React.ReactNode;
  footerExtra?: React.ReactNode;
  /** On the last step, replaces the Next control with a primary submit action on the right. */
  finalStepAction?: StepWizardFinalAction;
  /** Preset width; default `5xl` for wizard dialogs. */
  size?: CreateEditModalSize;
  canMoveNext?: boolean;
  canMovePrev?: boolean;
  /** When provided, step indicators become clickable for indices that return true. */
  canActivateStep?: (stepIndex: number) => boolean;
  onNext?: () => boolean | void | Promise<boolean | void>;
  bodyClassName?: string;
  bodyInnerClassName?: string;
  stepIndicatorsClassName?: string;
  /** Step indicator layout. Horizontal is the default dialog pattern. */
  orientation?: 'horizontal' | 'vertical';
  /** Indicator marker style. Number replaces any configured step icon. */
  marker?: 'icon' | 'number';
  /** When false, tabs show only the marker (typical on phone — one compact row of step numbers). Default true. */
  showStepLabels?: boolean;
  /** When false, hides the description band under the step tabs. Default true. */
  showStepDescriptionBand?: boolean;
  /**
   * Step-tab tint. Default `theme` follows the active accent.
   * `gray` keeps the slate/nav look. Pass `{ selected, unselected }` hexes for a custom pair.
   */
  stepTabColor?: StepWizardTabColor;
  /** Optional override for the in-step description band (icon + hint below step tabs). */
  stepDescriptionClassName?: string;
  stepDescriptionAlign?: 'start' | 'center';
  /** When false, hides the icon tile in the description band. Default true. */
  stepDescriptionShowIcon?: boolean;
  shellClassName?: string;
  onBackdropClick?: () => void;
  /** When true, omits the fixed modal backdrop — for full-page wizards on a light page shell. */
  embedded?: boolean;
  /** When true with `embedded`, shell stretches to fill a flex parent (`h-full min-h-0`). */
  embeddedFillViewport?: boolean;
  /** Footer navigation copy (defaults English for studio dialogs). */
  cancelLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  stepCounterLabel?: (currentStep: number, totalSteps: number) => string;
  /** When false, hides the center “step X of Y” label in the footer. Default true. */
  showFooterStepCounter?: boolean;
  /** Footer Next / final submit intent (default `primary`). */
  footerAdvanceIntent?: ButtonIntent;
  footerClassName?: string;
  /** Render inside a relative ancestor — Base Components catalog preview. */
  contained?: boolean;
  backdropTint?: DialogBackdropTint;
  backdropBlur?: DialogBackdropBlur;
  backdropTransparency?: DialogBackdropTransparency;
  /** Comet traveling the shell perimeter (Base Components orbit-border). */
  shellOrbitBorder?: boolean;
  /** How many comets share the perimeter when `shellOrbitBorder` is on. */
  shellOrbitCometCount?: number;
  /** Comet tail as a percentage of the perimeter when `shellOrbitBorder` is on. */
  shellOrbitTailLength?: number;
  /** Comet stroke thickness in px when `shellOrbitBorder` is on. */
  shellOrbitBorderWidth?: number;
  /** Glow halo blur in px when `shellOrbitBorder` is on. */
  shellOrbitGlowBlur?: number;
  shellOrbitPreset?: OrbitBorderPreset;
  shellOrbitDurationSeconds?: number;
  shellOrbitGlowOpacity?: number;
  /** Soft comet orbit around the footer Next / final submit button only. */
  footerAdvanceOrbitBorder?: boolean;
  footerAdvanceOrbitPreset?: OrbitBorderPreset;
  footerAdvanceOrbitTailLength?: number;
  footerAdvanceOrbitBorderWidth?: number;
  footerAdvanceOrbitGlowBlur?: number;
  footerAdvanceOrbitGlowOpacity?: number;
  footerAdvanceOrbitDurationSeconds?: number;
  footerAdvanceOrbitReverseColors?: boolean;
  footerAdvanceOrbitColorSteps?: number;
};

const normalizeStep = (step: StepWizardStepInput): StepWizardStepDef => (
  typeof step === 'string' ? { title: step } : step
);

export const StepWizardShell: React.FC<StepWizardShellProps> = ({
  title,
  titleIcon: TitleIcon,
  titleLeading,
  titleHeaderClassName,
  titleHeaderStyle,
  contextHeader,
  subtitle,
  stepDescription,
  stepDescriptionExtra,
  steps,
  step,
  onStepChange,
  onClose,
  showCloseButton = true,
  showTitleHeader = true,
  headerExtra,
  showStudioToolsMenu = true,
  children,
  footerExtra,
  finalStepAction,
  size = '5xl',
  canMoveNext: canMoveNextOverride,
  canMovePrev: canMovePrevOverride,
  canActivateStep,
  onNext,
  bodyClassName,
  bodyInnerClassName,
  stepIndicatorsClassName,
  orientation = 'horizontal',
  marker = 'icon',
  showStepLabels = true,
  showStepDescriptionBand = true,
  stepTabColor = 'theme',
  stepDescriptionClassName,
  stepDescriptionAlign = 'start',
  stepDescriptionShowIcon = true,
  shellClassName,
  onBackdropClick,
  shellOrbitBorder = false,
  shellOrbitCometCount,
  shellOrbitTailLength,
  shellOrbitBorderWidth,
  shellOrbitGlowBlur,
  shellOrbitPreset,
  shellOrbitDurationSeconds,
  shellOrbitGlowOpacity,
  footerAdvanceOrbitBorder = false,
  footerAdvanceOrbitPreset = 'fire',
  footerAdvanceOrbitTailLength = 34,
  footerAdvanceOrbitBorderWidth = 1.25,
  footerAdvanceOrbitGlowBlur = 7,
  footerAdvanceOrbitGlowOpacity = 0.78,
  footerAdvanceOrbitDurationSeconds = 20,
  footerAdvanceOrbitReverseColors = false,
  footerAdvanceOrbitColorSteps = 8,
  embedded = false,
  embeddedFillViewport = false,
  cancelLabel = 'Cancel',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  stepCounterLabel = (currentStep, totalSteps) => `Step ${currentStep} / ${totalSteps}`,
  showFooterStepCounter = true,
  footerAdvanceIntent = 'primary',
  footerClassName,
  contained = false,
  backdropTint,
  backdropBlur,
  backdropTransparency,
  colorSource = 'accent',
  tone = 'slate',
  customColorHex,
}) => {
  const viewportTier = useViewportTier();
  const chrome = useMemo(
    () => resolveSurfaceChrome({ colorSource, tone, customColorHex }),
    [colorSource, customColorHex, tone],
  );
  const useCompactFullscreen = !contained && !embedded && isCompactChromeTier(viewportTier) && size !== 'full';
  const embeddedCompactFill =
    embedded && embeddedFillViewport && isCompactChromeTier(viewportTier);
  const dialogMotion = overlayMotionPanelProps({
    kind: 'dialog',
    origin: useCompactFullscreen ? 'bottom' : 'center',
  });
  const canMovePrev = canMovePrevOverride ?? step > 0;
  const canMoveNext = canMoveNextOverride ?? step < steps.length - 1;
  const isFirstStep = step <= 0;
  const isLastStep = step >= steps.length - 1;
  const showFinalStepAction = isLastStep && finalStepAction;

  const normalizedSteps = useMemo(
    () => steps.map(normalizeStep),
    [steps],
  );

  const activeStep = normalizedSteps[step];
  const resolvedDescription = showStepDescriptionBand
    ? (stepDescription ?? activeStep?.description ?? '')
    : '';
  const ActiveStepIcon = activeStep?.icon;
  const sizeClassName = cn(
    useCompactFullscreen
      ? CREATE_EDIT_MODAL_PHONE_SHELL_CLASS
      : CREATE_EDIT_MODAL_SIZE_CLASS[size],
    embeddedCompactFill && 'max-h-none w-full',
  );
  const heightClassName = useCompactFullscreen
    ? undefined
    : contained
      ? 'h-full max-h-full'
      : embeddedCompactFill
        ? cn(
          'flex min-h-0 flex-1 flex-col',
          'max-h-[calc(100dvh-3.75rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]',
        )
        : embedded && embeddedFillViewport
          ? 'h-full min-h-0 max-h-none flex-1'
          : embedded
            ? undefined
            : size === 'maximized' || size === 'full'
              ? undefined
              : STEP_WIZARD_SHELL_HEIGHT_CLASS;
  useEffect(() => {
    if (embedded) {
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
  }, [embedded, onClose]);

  // Phase 14: single outer border from CREATE_EDIT_MODAL_SHELL_CLASS only —
  // do not also apply DIALOG_SHELL_CHROME_BORDER_CLASS (was dual border width).
  const shellPanelClassName = cn(
    dialogMotion.className,
    CREATE_EDIT_MODAL_SHELL_CLASS,
    sizeClassName,
    heightClassName,
    !shellOrbitBorder && chrome.shell,
    shellClassName,
    shellOrbitBorder && 'relative z-[1] h-full w-full !border-0',
  );
  const shellPanelStyle = shellOrbitBorder ? undefined : chrome.shellStyle;
  const shellPanel = (
    <div
      role="dialog"
      aria-modal={embedded || contained ? undefined : true}
      aria-label={title}
      {...{ [INLINE_TRANSLATION_SCAN_ROOT_ATTR]: true }}
      data-overlay-kind={dialogMotion['data-overlay-kind']}
      data-overlay-origin={dialogMotion['data-overlay-origin']}
      className={shellPanelClassName}
      style={shellPanelStyle}
      onClick={(event) => event.stopPropagation()}
    >
      <DialogHostProvider>
        {showTitleHeader ? (
          <div
            className={cn(
              STEP_WIZARD_TITLE_HEADER_LAYOUT_CLASS,
              chrome.header,
              titleHeaderClassName,
            )}
            style={{ ...chrome.headerStyle, ...titleHeaderStyle }}
          >
            <div className={STEP_WIZARD_HEADER_TITLE_ROW_CLASS}>
              <div
                className="flex min-w-0 items-center gap-2.5"
                {...pageGuideLocalProps(
                  title,
                  subtitle?.trim() || PAGE_GUIDE_EN['pageGuide.page.dialog.hint'],
                  12,
                )}
              >
                {titleLeading ? (
                  <div className="shrink-0">{titleLeading}</div>
                ) : TitleIcon ? (
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    <TitleIcon className="h-4 w-4" aria-hidden />
                  </span>
                ) : null}
                <div className="min-w-0">
                  {titleLeading ? (
                    <span className="sr-only">{title}</span>
                  ) : (
                    <div className={STEP_WIZARD_HEADER_TITLE_TEXT_CLASS}>{title}</div>
                  )}
                  {subtitle ? (
                    <div className="text-[11px] text-slate-500 mt-0.5">{subtitle}</div>
                  ) : null}
                </div>
              </div>
              {showStudioToolsMenu || headerExtra || showCloseButton ? (
                <div className={DIALOG_PRIMARY_HEADER_ACTIONS_CLASS}>
                  {showStudioToolsMenu ? <WindowChromeStudioToolsMenu /> : null}
                  {showStudioToolsMenu && (headerExtra || showCloseButton) ? (
                    <span className={DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS} aria-hidden="true" />
                  ) : null}
                  {headerExtra}
                  {headerExtra && showCloseButton ? (
                    <span className={DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS} aria-hidden="true" />
                  ) : null}
                  {showCloseButton ? (
                    <AppButton closeIcon onClick={onClose} title="Close" size="icon-sm">
                      <X className="w-4 h-4" />
                    </AppButton>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {contextHeader ? (
          <div
            className={cn(STEP_WIZARD_CONTEXT_HEADER_LAYOUT_CLASS, 'border-b border-slate-200/90')}
            data-step-wizard-context-header=""
          >
            {contextHeader}
          </div>
        ) : null}

        <div
          className={cn(
            STEP_WIZARD_STEPS_HEADER_LAYOUT_CLASS,
            !showTitleHeader && !contextHeader && '-mt-[15px] max-[399px]:mt-0',
            !showTitleHeader && contextHeader && '-mt-px max-[399px]:mt-0',
            chrome.headerBand,
          )}
          style={chrome.headerBandStyle}
          data-step-tab-color={resolveStepWizardTabColorMode(stepTabColor)}
        >
          <div
            className={cn(
              'grid w-full',
              orientation === 'vertical' && 'gap-1',
              stepIndicatorsClassName,
            )}
            style={{
              gridTemplateColumns: orientation === 'vertical'
                ? 'minmax(0, 1fr)'
                : `repeat(${normalizedSteps.length}, minmax(0, 1fr))`,
            }}
          >
            {normalizedSteps.map((stepDef, index) => {
              const isDisabled = stepDef.disabled === true;
              const isActive = !isDisabled && index === step;
              const isClickable = !isDisabled && (canActivateStep?.(index) ?? true);
              const StepIcon = stepDef.icon;
              const tabState = isDisabled ? 'disabled' : isActive ? 'selected' : 'unselected';
              const tabLook = resolveStepWizardTabAppearance(stepTabColor, tabState, isClickable);
              const stepClassName = cn(
                STEP_WIZARD_STEP_CELL_CLASS,
                !showStepLabels && 'flex-row gap-0 px-1 py-2 max-[399px]:py-1.5',
                tabLook.className,
              );

              const stepContent = (
                <>
                  {marker === 'number' ? (
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center justify-center rounded-full border border-current font-bold',
                        showStepLabels
                          ? 'size-4 text-[9px]'
                          : 'size-8 text-xs max-[399px]:size-7',
                      )}
                    >
                      {index + 1}
                    </span>
                  ) : StepIcon ? (
                    <StepIcon
                      className={cn('size-4 shrink-0', tabLook.iconClassName)}
                      aria-hidden
                    />
                  ) : null}
                  {showStepLabels ? (
                    <span className="w-full truncate text-[11px] font-semibold leading-tight">
                      {stepDef.title}
                    </span>
                  ) : null}
                </>
              );

              if (isClickable) {
                const stepHint = stepDef.description?.trim()
                  || `Step ${index + 1} of this wizard.`;
                return (
                  <button
                    key={`${stepDef.title}-${index}`}
                    type="button"
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`Go to step ${index + 1}: ${stepDef.title}`}
                    className={stepClassName}
                    style={tabLook.style}
                    {...pageGuideLocalProps(stepDef.title, stepHint, 18 + index)}
                    onClick={() => {
                      if (index !== step) {
                        onStepChange(index);
                      }
                    }}
                  >
                    {stepContent}
                  </button>
                );
              }

              return (
                <div
                  key={`${stepDef.title}-${index}`}
                  aria-disabled={isDisabled || undefined}
                  aria-current={isActive ? 'step' : undefined}
                  className={stepClassName}
                  style={tabLook.style}
                >
                  {stepContent}
                </div>
              );
            })}
          </div>
        </div>

        {resolvedDescription || stepDescriptionExtra ? (
          <div
            className={cn(
              STEP_WIZARD_DESCRIPTION_LAYOUT_CLASS,
              STEP_WIZARD_DESCRIPTION_SURFACE_CLASS,
              'flex items-center gap-3',
              stepDescriptionAlign === 'center' ? 'justify-center' : 'justify-between',
              stepDescriptionClassName,
            )}
            data-step-wizard-description=""
          >
            <div
              className={cn(
                'flex min-w-0 items-center gap-3',
                stepDescriptionAlign === 'center' && 'w-full justify-center',
              )}
            >
              {stepDescriptionShowIcon && ActiveStepIcon ? (
                <div
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-lg',
                    activeStep?.tone
                      ? APP_SURFACE_BOX_TONE_CLASS[resolveAppSurfaceBoxTone(activeStep.tone)].strip
                      : 'bg-primary-subtle',
                  )}
                >
                  <ActiveStepIcon
                    className={cn(
                      'size-6',
                      activeStep?.tone
                        ? APP_SURFACE_BOX_TONE_CLASS[resolveAppSurfaceBoxTone(activeStep.tone)].title
                        : 'text-primary-600',
                    )}
                    aria-hidden
                  />
                </div>
              ) : null}
              {resolvedDescription ? (
                <p className="min-w-0 text-sm leading-snug text-slate-500">{resolvedDescription}</p>
              ) : null}
            </div>
            {stepDescriptionExtra ? (
              <div className="shrink-0">{stepDescriptionExtra}</div>
            ) : null}
          </div>
        ) : null}

        <div className={cn(STEP_WIZARD_BODY_CLASS, bodyClassName)}>
          <div className={cn(STEP_WIZARD_STEP_INNER_CLASS, bodyInnerClassName)}>
            {children}
          </div>
        </div>

        <div
          className={cn(
            STEP_WIZARD_FOOTER_LAYOUT_CLASS,
            chrome.footer,
            embeddedCompactFill && 'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
            footerClassName,
          )}
          style={chrome.footerStyle}
        >
          <AppButton
            intent="cancel"
            data-step-wizard-nav="prev"
            onClick={() => {
              if (isFirstStep) {
                onClose();
                return;
              }
              if (canMovePrev) {
                onStepChange(Math.max(0, step - 1));
              }
            }}
            disabled={!isFirstStep && !canMovePrev}
          >
            <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
            {isFirstStep ? cancelLabel : previousLabel}
          </AppButton>

          {showFooterStepCounter || footerExtra ? (
            <div className="flex items-center justify-center gap-3">
              {footerExtra}
              {showFooterStepCounter ? (
                <div className="text-xs text-slate-500">
                  {stepCounterLabel(step + 1, steps.length)}
                </div>
              ) : null}
            </div>
          ) : null}

          {(() => {
            const advanceButton = (
              <AppButton
                // Phase 15: Next and final submit share primary weight — no mid-flow intent flip.
                intent={footerAdvanceIntent}
                data-step-wizard-nav="advance"
                onClick={() => {
                  if (showFinalStepAction) {
                    void finalStepAction.onClick();
                    return;
                  }
                  if (!canMoveNext) return;
                  void (async () => {
                    const nextResult = await onNext?.();
                    if (nextResult === false) return;
                    onStepChange(Math.min(steps.length - 1, step + 1));
                  })();
                }}
                disabled={showFinalStepAction ? finalStepAction.disabled : !canMoveNext}
              >
                {showFinalStepAction ? (
                  <>
                    {finalStepAction.icon}
                    {finalStepAction.label}
                  </>
                ) : (
                  <>
                    {nextLabel}
                    <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                  </>
                )}
              </AppButton>
            );

            if (!footerAdvanceOrbitBorder) {
              return advanceButton;
            }

            return (
              <OrbitBorderFrame
                className="step-wizard-advance-orbit inline-flex shrink-0"
                innerClassName="inline-flex overflow-visible"
                borderRadius="0.375rem"
                preset={footerAdvanceOrbitPreset}
                cometCount={1}
                tailLength={footerAdvanceOrbitTailLength}
                borderWidth={footerAdvanceOrbitBorderWidth}
                glowBlur={footerAdvanceOrbitGlowBlur}
                glowOpacity={footerAdvanceOrbitGlowOpacity}
                durationSeconds={footerAdvanceOrbitDurationSeconds}
                reverseColors={footerAdvanceOrbitReverseColors}
                colorSteps={footerAdvanceOrbitColorSteps}
              >
                {advanceButton}
              </OrbitBorderFrame>
            );
          })()}
        </div>
      </DialogHostProvider>
      </div>
  );

  const shellContent = shellOrbitBorder ? (
    <OrbitBorderFrame
      className={cn(sizeClassName, heightClassName, shellClassName)}
      cometCount={shellOrbitCometCount}
      tailLength={shellOrbitTailLength}
      borderWidth={shellOrbitBorderWidth}
      glowBlur={shellOrbitGlowBlur}
      preset={shellOrbitPreset}
      durationSeconds={shellOrbitDurationSeconds}
      glowOpacity={shellOrbitGlowOpacity}
    >
      <SurfaceChromeProvider colorSource={colorSource} tone={tone} customColorHex={customColorHex}>
        {shellPanel}
      </SurfaceChromeProvider>
    </OrbitBorderFrame>
  ) : (
    <SurfaceChromeProvider colorSource={colorSource} tone={tone} customColorHex={customColorHex}>
      {shellPanel}
    </SurfaceChromeProvider>
  );

  if (embedded) {
    return shellContent;
  }

  const useComposedBackdrop = !useCompactFullscreen
    && (backdropTint != null || backdropBlur != null || backdropTransparency != null);
  const resolvedBackdropClass = useCompactFullscreen
    ? CREATE_EDIT_MODAL_PHONE_BACKDROP_CLASS
    : useComposedBackdrop
      ? resolveDialogBackdropLayoutClass()
      : STEP_WIZARD_BACKDROP_CLASS;
  const composedScrimClass = useComposedBackdrop
    ? resolveDialogBackdropScrimClass({
        tint: backdropTint ?? 'faint',
        blur: backdropBlur ?? 'default',
        transparency: backdropTransparency ?? 'opaque',
      })
    : null;

  const backdrop = (
    <div
      className={contained ? toContainedOverlayClass(resolvedBackdropClass) : resolvedBackdropClass}
      data-step-wizard-backdrop=""
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
    return backdrop;
  }

  return createPortal(backdrop, document.body);
};
