import { describe, expect, it } from 'vitest';
import { SHELL_EFFECT_CATALOG, resolveShellEffectFallback, validateShellEffectStack } from '../../../shared/ui';
import {
  resolveToastPreviewModel,
  type ToastBaseComponentsConfig,
} from '../toast/ToastBaseComponentsWorkspace';
import {
  resolveSkeletonPreviewModel,
  type SkeletonBaseComponentsConfig,
} from '../skeleton/SkeletonBaseComponentsWorkspace';
import {
  resolveProgressPreviewModel,
  type ProgressBaseComponentsConfig,
} from '../progress/ProgressBaseComponentsWorkspace';
import {
  resolveLoadingErrorEmptyOptionKeys,
  resolveLoadingErrorEmptyPreviewModel,
  type LoadingErrorEmptyBaseComponentsConfig,
} from '../loading-error-empty/LoadingErrorEmptyBaseComponentsWorkspace';
import {
  resolveAvatarPreviewModel,
  type AvatarBaseComponentsConfig,
} from '../avatar/AvatarBaseComponentsWorkspace';
import {
  resolveChipPreviewModel,
  type ChipBaseComponentsConfig,
} from '../chip/ChipBaseComponentsWorkspace';
import {
  resolvePhoneNumberPreviewModel,
  type PhoneNumberBaseComponentsConfig,
} from '../phone-number/PhoneNumberBaseComponentsWorkspace';
import {
  resolveOrbitBorderControlVisibility,
  resolveOrbitBorderFrameProps,
  type OrbitBorderBaseComponentsConfig,
} from '../orbit-border/OrbitBorderBaseComponentsWorkspace';
import {
  resolveOrbitBgControlVisibility,
  resolveOrbitBgFrameProps,
  type OrbitBgBaseComponentsConfig,
} from '../orbit-bg/OrbitBgBaseComponentsWorkspace';
import {
  exportAppendooCompanionConfig,
  resolveAppendooCompanionPreviewModel,
  type AppendooCompanionBaseComponentsConfig,
} from '../appendoo-companion/AppendooCompanionBaseComponentsWorkspace';
import { applyAppendooEmotionRim } from '../../../shared/ui/shell/appendooCompanion/appendooEmotionRim';
import { sampleAppendooTravel } from '../../../shared/ui/shell/appendooCompanion/appendooTravel';
import { APPENDOO_DEFAULT_MORPH } from '../../../shared/ui/shell/appendooCompanion/appendooMorph';
import { APPENDOO_DEFAULT_LOOK } from '../../../shared/ui/shell/appendooCompanion/appendooLook';
import { APPENDOO_DEFAULT_FACE_PARTS } from '../../../shared/ui/shell/appendooCompanion/appendooFaceParts';
import {
  resolveIconSetsPreviewState,
  resolveIconSetsRenderModel,
  type IconSetsBaseComponentsConfig,
} from '../icon-sets/IconSetsBaseComponentsWorkspace';
import {
  exportColorPickerBaseComponentsConfig,
  resolveColorPickerPreviewModel,
  type ColorPickerBaseComponentsConfig,
} from '../color-picker/ColorPickerBaseComponentsWorkspace';
import {
  exportGradientPickerBaseComponentsConfig,
  resolveGradientPickerPreviewModel,
  type GradientPickerBaseComponentsConfig,
} from '../gradient-picker/GradientPickerBaseComponentsWorkspace';
import {
  exportVariableColorPickerBaseComponentsConfig,
  resolveVariableColorPickerPreviewModel,
  type VariableColorPickerBaseComponentsConfig,
} from '../variable-color-picker/VariableColorPickerBaseComponentsWorkspace';
import {
  exportBorderShadowPickerBaseComponentsConfig,
  resolveBorderShadowPickerPreviewModel,
  type BorderShadowPickerBaseComponentsConfig,
} from '../border-shadow-picker/BorderShadowPickerBaseComponentsWorkspace';
import {
  SHELL_FOUNDATION_COMPONENT_IDS,
  exportShellFoundationGalleryConfig,
  getShellFoundationGalleryOptions,
  type ShellFoundationGalleryConfig,
} from '../shell-foundation/ShellFoundationBaseComponentsWorkspace';
import {
  SHELL_NAVIGATION_COMPONENT_IDS,
  exportShellNavigationGalleryConfig,
  getShellNavigationGalleryOptions,
  resolveShellNavigationCurrentPath,
  type ShellNavigationGalleryConfig,
} from '../shell-navigation/ShellNavigationBaseComponentsWorkspace';
import {
  buildShellEffectGalleryLayers,
  exportShellEffectsGalleryConfig,
  type ShellEffectsGalleryConfig,
} from '../shell-effects/ShellEffectsBaseComponentsWorkspace';

const toast = (overrides: Partial<ToastBaseComponentsConfig> = {}): ToastBaseComponentsConfig => ({
  type: 'success',
  title: 'Published',
  message: 'Changes saved.',
  duration: 5000,
  dismissible: true,
  action: true,
  lifecycle: 'static',
  position: 'top-end',
  stack: 1,
  state: 'visible',
  ...overrides,
});

const skeleton = (overrides: Partial<SkeletonBaseComponentsConfig> = {}): SkeletonBaseComponentsConfig => ({
  preset: 'text',
  animationType: 'shimmer',
  density: 'default',
  rows: 3,
  reducedMotion: false,
  ...overrides,
});

const progress = (overrides: Partial<ProgressBaseComponentsConfig> = {}): ProgressBaseComponentsConfig => ({
  preset: 'bar',
  value: 60,
  color: 'accent',
  size: 'md',
  isIndeterminate: false,
  showOutput: true,
  status: 'active',
  presentation: 'block',
  showLabel: true,
  ...overrides,
});

const asyncState = (
  overrides: Partial<LoadingErrorEmptyBaseComponentsConfig> = {},
): LoadingErrorEmptyBaseComponentsConfig => ({
  kind: 'loading',
  loading: 'skeleton',
  error: 'panel',
  empty: 'first-use',
  retry: true,
  details: false,
  primaryAction: true,
  state: 'default',
  ...overrides,
});

const avatar = (overrides: Partial<AvatarBaseComponentsConfig> = {}): AvatarBaseComponentsConfig => ({
  source: 'initials',
  size: 'md',
  color: 'accent',
  initials: 'AM',
  group: 'single',
  presence: 'online',
  shape: 'circle',
  bordered: false,
  state: 'default',
  maxVisible: 4,
  ...overrides,
});

const chip = (overrides: Partial<ChipBaseComponentsConfig> = {}): ChipBaseComponentsConfig => ({
  preset: 'status',
  color: 'accent',
  size: 'md',
  variant: 'soft',
  label: 'Active',
  content: 'label',
  removable: false,
  selectable: false,
  selected: false,
  state: 'default',
  collection: 'single',
  ...overrides,
});

const orbit = (overrides: Partial<OrbitBorderBaseComponentsConfig> = {}): OrbitBorderBaseComponentsConfig => ({
  enabled: true,
  intensity: 'standard',
  preset: 'rainbow',
  borderWidth: 1.5,
  borderRadius: 'var(--app-radius-xl)',
  hostBackground: 'white',
  showGlow: true,
  glowBlur: 8,
  glowOpacity: 0.5,
  speed: 5,
  direction: 'forward',
  motionPreference: 'normal',
  tailLength: 5,
  cometCount: 1,
  showTrack: true,
  colorSteps: 6,
  reverseColors: true,
  ...overrides,
});

const orbitBg = (overrides: Partial<OrbitBgBaseComponentsConfig> = {}): OrbitBgBaseComponentsConfig => ({
  enabled: true,
  intensity: 'standard',
  preset: 'rainbow',
  effect: 'orbs',
  motion: 'orbit',
  shape: 'circle',
  borderRadius: 'var(--app-radius-xl)',
  hostBackground: 'white',
  showGlow: true,
  glowBlur: 16,
  glowOpacity: 0.7,
  speed: 5,
  direction: 'forward',
  motionPreference: 'normal',
  coverage: 58,
  size: 40,
  blobCount: 3,
  showWash: true,
  colorSteps: 6,
  reverseColors: true,
  ...overrides,
});

const appendooCompanion = (
  overrides: Partial<AppendooCompanionBaseComponentsConfig> = {},
): AppendooCompanionBaseComponentsConfig => ({
  emotion: 'neutral',
  blinking: false,
  override: {},
  body: {
    shape: 'peach',
    size: 5,
    wonk: 1,
    wonkScatter: false,
    wonkSeed: 1,
    lean: 'none',
    bodyAsym: 0.28,
    rimAsym: 0.42,
    rimWeight: 1.35,
    rimScale: 1.04,
    rimShiftX: 0.22,
    rimShiftY: -0.12,
    trimMotion: 0.7,
  },
  travel: {
    fromX: 50,
    fromY: 50,
    toX: 84,
    toY: 18,
    durationMs: 900,
    easing: 'ease-out-cubic',
    bezierX1: 0.33,
    bezierY1: 1,
    bezierX2: 0.68,
    bezierY2: 1,
    loop: false,
  },
  colorMode: 'character',
  paletteSwatchId: 'teal-core',
  accessories: {
    hat: false,
    glasses: false,
    headphones: false,
  },
  accessoryPaintId: 'cherry',
  parts: APPENDOO_DEFAULT_FACE_PARTS,
  followPointer: false,
  draggable: false,
  morph: APPENDOO_DEFAULT_MORPH,
  look: APPENDOO_DEFAULT_LOOK,
  ...overrides,
});

const colorPicker = (
  overrides: Partial<ColorPickerBaseComponentsConfig> = {},
): ColorPickerBaseComponentsConfig => ({
  variant: 'field',
  format: 'hex',
  size: 'md',
  showAlpha: false,
  showPresets: true,
  showEyeDropper: true,
  showInput: true,
  clearable: false,
  disabled: false,
  ...overrides,
});

const variableColorPicker = (
  overrides: Partial<VariableColorPickerBaseComponentsConfig> = {},
): VariableColorPickerBaseComponentsConfig => ({
  variant: 'inline',
  size: 'md',
  showCssOutput: true,
  showSourceSelector: true,
  showPresets: true,
  compact: true,
  disabled: false,
  ...overrides,
});

const gradientPicker = (
  overrides: Partial<GradientPickerBaseComponentsConfig> = {},
): GradientPickerBaseComponentsConfig => ({
  variant: 'inline',
  size: 'md',
  showCssOutput: false,
  showTypeSelector: true,
  showReverse: true,
  showPresets: true,
  compact: true,
  disabled: false,
  ...overrides,
});

const borderShadowPicker = (
  overrides: Partial<BorderShadowPickerBaseComponentsConfig> = {},
): BorderShadowPickerBaseComponentsConfig => ({
  variant: 'inline',
  size: 'md',
  showCssOutput: false,
  showReverse: true,
  showPresets: true,
  compact: true,
  disabled: false,
  ...overrides,
});

describe('feedback and shell Base Components option liveness', () => {
  it('toast: resolves production AppToast props, lifecycle, placement, stack, actions, and duration', () => {
    const model = resolveToastPreviewModel(toast({
      type: 'warning',
      lifecycle: 'promise',
      state: 'updated',
      position: 'bottom-center',
      stack: 4,
      dismissible: false,
      action: false,
      duration: 'persistent',
    }));
    expect(model.appToastProps).toEqual({ type: 'warning', text: 'Changes saved.' });
    expect(model).toMatchObject({
      title: 'Published · updated',
      alignment: 'center',
      edge: 'bottom',
      stackCount: 4,
      dismissible: false,
      actionVisible: false,
      autoDismissMs: null,
    });
  });

  it('skeleton: resolves UiSkeleton animation/density/rows and hides overridden dependencies', () => {
    expect(resolveSkeletonPreviewModel(skeleton({ preset: 'table', density: 'compact', rows: 6 }))).toMatchObject({
      animationType: 'shimmer',
      gapClass: 'gap-1.5',
      rowCount: 6,
      showRowsControl: true,
      showAnimationControl: true,
    });
    expect(resolveSkeletonPreviewModel(skeleton({ preset: 'avatar', reducedMotion: true }))).toMatchObject({
      animationType: 'none',
      rowCount: null,
      showRowsControl: false,
      showAnimationControl: false,
    });
  });

  it('progress: selects production renderers and normalizes status, output, and preset controls', () => {
    expect(resolveProgressPreviewModel(progress({ status: 'error', showLabel: false }))).toMatchObject({
      renderer: 'UiProgress',
      progressProps: { color: 'danger', showOutput: false, label: undefined },
      controls: { color: false, status: true, output: false },
    });
    expect(resolveProgressPreviewModel(progress({ preset: 'inline-operation', isIndeterminate: false }))).toMatchObject({
      renderer: 'UiProgress',
      progressProps: { isIndeterminate: true },
      controls: { value: false, indeterminate: false },
    });
    expect(resolveProgressPreviewModel(progress({ preset: 'spinner' }))).toMatchObject({
      renderer: 'LoadingSpinner',
      progressProps: null,
      controls: { status: false, size: false },
    });
    expect(resolveProgressPreviewModel(progress({ preset: 'steps', value: 90 }))).toMatchObject({
      renderer: 'steps',
      controls: { value: true, label: false },
    });
  });

  it('loading-error-empty: selects production async primitives and exposes only kind-relevant controls', () => {
    expect(resolveLoadingErrorEmptyPreviewModel(asyncState({ loading: 'inline-progress' })).renderer).toBe('UiProgress');
    expect(resolveLoadingErrorEmptyPreviewModel(asyncState({ loading: 'delayed-spinner' })).renderer).toBe('LoadingSpinner');
    expect(resolveLoadingErrorEmptyPreviewModel(asyncState({ kind: 'error', retry: true, details: true, state: 'offline' }))).toEqual({
      renderer: 'QueryErrorPanel',
      retryEnabled: true,
      detailsVisible: true,
      primaryActionVisible: false,
      state: 'offline',
    });
    expect(resolveLoadingErrorEmptyOptionKeys(asyncState({ kind: 'empty' }))).toEqual([
      'kind', 'empty', 'primaryAction',
    ]);
  });

  it('avatar: resolves UiAvatar props for source/state/group and dependent control visibility', () => {
    const imageError = resolveAvatarPreviewModel(avatar({
      source: 'image',
      state: 'image-error',
      group: 'stack',
      maxVisible: 3,
      size: 'lg',
      color: 'danger',
    }));
    expect(imageError.controls).toEqual({ initials: false, imageState: true, maxVisible: true });
    expect(imageError.members).toHaveLength(3);
    expect(imageError.avatarProps[0]).toMatchObject({
      size: 'lg',
      color: 'danger',
      src: '/missing-avatar.png',
      alt: 'Team member 1',
      disabled: false,
    });
    expect(resolveAvatarPreviewModel(avatar({ source: 'icon' })).avatarProps[0].fallback).toBe('●');
    expect(resolveAvatarPreviewModel(avatar({ source: 'image', state: 'image-loading' })).avatarProps[0]).toMatchObject({
      src: undefined,
      className: 'animate-pulse',
    });
  });

  it('phone-number: maps sample, text size, and copy affordance for PhoneNumberDisplay', () => {
    const iraq: PhoneNumberBaseComponentsConfig = {
      sample: 'iraq-mobile',
      textSize: 'sm',
      showCopy: true,
    };
    expect(resolvePhoneNumberPreviewModel(iraq)).toMatchObject({
      phone: '07701234567',
      copyAriaLabel: 'Copy phone number',
      hasLinks: true,
    });
    expect(resolvePhoneNumberPreviewModel({
      sample: 'invalid',
      textSize: 'md',
      showCopy: false,
    })).toMatchObject({
      hasLinks: false,
      copyAriaLabel: undefined,
    });
  });

  it('chip: selects UiChip/AppButton compositions and normalizes appearance, selection, removal, and collection', () => {
    expect(resolveChipPreviewModel(chip({ preset: 'input', removable: true, content: 'avatar-label' }))).toMatchObject({
      renderer: 'UiChip',
      removable: true,
      controls: { appearance: true, content: true, selectedState: false },
    });
    expect(resolveChipPreviewModel(chip({ preset: 'filter', selected: true, collection: 'overflow-summary' }))).toMatchObject({
      renderer: 'AppSelectionToggle',
      selected: true,
      controls: { appearance: false, selectedState: true },
      collectionCount: 3,
      overflowSummary: 1,
    });
    expect(resolveChipPreviewModel(chip({ preset: 'count', label: '' }))).toMatchObject({
      displayedLabel: '0',
      controls: { content: false },
    });
  });

  it('orbit-border: resolves production OrbitBorderFrame props and hides disabled glow/speed dependencies', () => {
    expect(resolveOrbitBorderFrameProps(orbit({
      preset: 'ocean',
      speed: 10,
      direction: 'reverse',
      motionPreference: 'reduced',
      cometCount: 2,
      tailLength: 100,
      reverseColors: false,
    }))).toMatchObject({
      preset: 'ocean',
      durationSeconds: 1,
      direction: 'reverse',
      reducedMotion: true,
      cometCount: 2,
      tailLength: 100,
      reverseColors: false,
    });
    expect(resolveOrbitBorderFrameProps(orbit({ speed: 1 })).durationSeconds).toBe(180);
    expect(resolveOrbitBorderFrameProps(orbit({ speed: 4 })).durationSeconds).toBe(24);
    expect(resolveOrbitBorderFrameProps(orbit({ speed: 8 })).durationSeconds).toBe(3.5);
    expect(resolveOrbitBorderFrameProps(orbit({ cometCount: 10 })).cometCount).toBe(10);
    expect(resolveOrbitBorderFrameProps(orbit({ cometCount: 0 })).cometCount).toBe(1);
    expect(resolveOrbitBorderFrameProps(orbit({ cometCount: 16 })).cometCount).toBe(10);
    expect(resolveOrbitBorderFrameProps(orbit({ tailLength: 140 })).tailLength).toBe(100);
    expect(resolveOrbitBorderFrameProps(orbit({ colorSteps: 10 })).colorSteps).toBe(10);
    expect(resolveOrbitBorderFrameProps(orbit({ colorSteps: 4 })).colorSteps).toBe(4);
    expect(resolveOrbitBorderFrameProps(orbit({ colorSteps: 2 })).colorSteps).toBe(4);
    expect(resolveOrbitBorderFrameProps(orbit({ colorSteps: 16 })).colorSteps).toBe(10);
    expect(resolveOrbitBorderFrameProps(orbit()).reverseColors).toBe(true);
    expect(resolveOrbitBorderFrameProps(orbit({ reverseColors: false })).reverseColors).toBe(false);
    expect(resolveOrbitBorderFrameProps(orbit({ motionPreference: 'reduced' })).reducedMotion).toBe(true);
    expect(resolveOrbitBorderControlVisibility(orbit({ enabled: false, showGlow: true }))).toEqual({
      frame: false,
      glowDetails: false,
      speed: false,
      tailDetails: false,
      cometCount: false,
      track: false,
      colorSteps: false,
      reverseColors: false,
    });
    expect(resolveOrbitBorderControlVisibility(orbit({ showGlow: false, speed: 8 }))).toEqual({
      frame: true,
      glowDetails: false,
      speed: true,
      tailDetails: true,
      cometCount: true,
      track: true,
      colorSteps: true,
      reverseColors: true,
    });
  });

  it('orbit-bg: resolves production OrbitBgFrame props and hides disabled glow/speed dependencies', () => {
    expect(resolveOrbitBgFrameProps(orbitBg({
      preset: 'ocean',
      effect: 'aurora',
      motion: 'edges',
      shape: 'line',
      speed: 10,
      direction: 'reverse',
      motionPreference: 'reduced',
      blobCount: 2,
      coverage: 100,
      size: 80,
      reverseColors: false,
    }))).toMatchObject({
      preset: 'ocean',
      effect: 'aurora',
      motion: 'edges',
      shape: 'line',
      durationSeconds: 1,
      direction: 'reverse',
      reducedMotion: true,
      blobCount: 2,
      coverage: 100,
      size: 80,
      reverseColors: false,
    });
    expect(resolveOrbitBgFrameProps(orbitBg({ speed: 1 })).durationSeconds).toBe(180);
    expect(resolveOrbitBgFrameProps(orbitBg({ speed: 4 })).durationSeconds).toBe(24);
    expect(resolveOrbitBgFrameProps(orbitBg({ speed: 8 })).durationSeconds).toBe(3.5);
    expect(resolveOrbitBgFrameProps(orbitBg({ blobCount: 10 })).blobCount).toBe(10);
    expect(resolveOrbitBgFrameProps(orbitBg({ blobCount: 0 })).blobCount).toBe(1);
    expect(resolveOrbitBgFrameProps(orbitBg({ blobCount: 16 })).blobCount).toBe(10);
    expect(resolveOrbitBgFrameProps(orbitBg({ coverage: 140 })).coverage).toBe(100);
    expect(resolveOrbitBgFrameProps(orbitBg({ coverage: 5 })).coverage).toBe(20);
    expect(resolveOrbitBgFrameProps(orbitBg({ size: 8 })).size).toBe(8);
    expect(resolveOrbitBgFrameProps(orbitBg({ size: 140 })).size).toBe(100);
    expect(resolveOrbitBgFrameProps(orbitBg({ size: 3 })).size).toBe(8);
    expect(resolveOrbitBgFrameProps(orbitBg({ colorSteps: 10 })).colorSteps).toBe(10);
    expect(resolveOrbitBgFrameProps(orbitBg({ colorSteps: 4 })).colorSteps).toBe(4);
    expect(resolveOrbitBgFrameProps(orbitBg({ colorSteps: 2 })).colorSteps).toBe(4);
    expect(resolveOrbitBgFrameProps(orbitBg({ colorSteps: 16 })).colorSteps).toBe(10);
    expect(resolveOrbitBgFrameProps(orbitBg({ motion: 'drift' })).motion).toBe('drift');
    expect(resolveOrbitBgFrameProps(orbitBg()).motion).toBe('orbit');
    expect(resolveOrbitBgFrameProps(orbitBg({ shape: 'scribble' })).shape).toBe('scribble');
    expect(resolveOrbitBgFrameProps(orbitBg()).shape).toBe('circle');
    expect(resolveOrbitBgFrameProps(orbitBg({ reverseColors: false })).reverseColors).toBe(false);
    expect(resolveOrbitBgFrameProps(orbitBg({ motionPreference: 'reduced' })).reducedMotion).toBe(true);
    expect(resolveOrbitBgControlVisibility(orbitBg({ enabled: false, showGlow: true }))).toEqual({
      frame: false,
      glowDetails: false,
      speed: false,
      coverage: false,
      size: false,
      blobCount: false,
      wash: false,
      colorSteps: false,
      reverseColors: false,
      effect: false,
      motion: false,
      shape: false,
    });
    expect(resolveOrbitBgControlVisibility(orbitBg({ showGlow: false, speed: 8 }))).toEqual({
      frame: true,
      glowDetails: false,
      speed: true,
      coverage: true,
      size: true,
      blobCount: true,
      wash: true,
      colorSteps: true,
      reverseColors: true,
      effect: true,
      motion: true,
      shape: true,
    });
  });

  it('appendoo-companion: resolves FACS presets, brows, and playground overrides', () => {
    const anger = resolveAppendooCompanionPreviewModel(appendooCompanion({ emotion: 'anger' }));
    const surprise = resolveAppendooCompanionPreviewModel(appendooCompanion({ emotion: 'surprise' }));
    const fear = resolveAppendooCompanionPreviewModel(appendooCompanion({ emotion: 'fear' }));
    const joy = resolveAppendooCompanionPreviewModel(appendooCompanion({ emotion: 'joy' }));
    const blushed = resolveAppendooCompanionPreviewModel(appendooCompanion({
      emotion: 'neutral',
      override: { blush: 0.9 },
    }));
    const blink = resolveAppendooCompanionPreviewModel(appendooCompanion({ blinking: true }));

    expect(anger.hasBrows).toBe(true);
    expect(resolveAppendooCompanionPreviewModel(appendooCompanion({
      parts: { ...APPENDOO_DEFAULT_FACE_PARTS, brows: false, blush: false },
    })).hasBrows).toBe(false);
    expect(exportAppendooCompanionConfig(appendooCompanion({
      parts: { ...APPENDOO_DEFAULT_FACE_PARTS, blush: false, mouth: false },
    }))).toMatchObject({
      showBlush: false,
      showMouth: false,
      showBrows: true,
    });
    expect(anger.rig.browInnerY).toBeLessThan(surprise.rig.browInnerY);
    expect(fear.rig.browKnit).toBeGreaterThan(0.5);
    expect(fear.rig.browInnerY).toBeGreaterThan(0.5);
    expect(joy.rig.mouthCurve).toBeGreaterThan(0.7);
    expect(joy.rig.cheekRaise).toBeGreaterThan(0.5);
    expect(joy.geometry.rimPath).not.toEqual(anger.geometry.rimPath);
    expect(joy.geometry.bodyPath).toEqual(anger.geometry.bodyPath);
    expect(applyAppendooEmotionRim(anger.body, 'surprise').size).toBeGreaterThan(
      applyAppendooEmotionRim(anger.body, 'neutral').size,
    );
    expect(blushed.rig.blush).toBe(0.9);
    expect(blushed.overrideCount).toBe(1);
    expect(blink.rig.eyeOpen).toBeLessThan(0.2);
    expect(exportAppendooCompanionConfig(appendooCompanion({ emotion: 'disgust' }))).toMatchObject({
      emotion: 'disgust',
      blinking: false,
      shape: 'peach',
      size: 5,
      wonk: 1,
      wonkScatter: false,
      wonkSeed: 1,
      lean: 'none',
      easing: 'ease-out-cubic',
      loop: false,
      colorMode: 'character',
      paletteSwatchId: 'teal-core',
      hat: false,
      glasses: false,
      accessoryPaint: 'cherry',
      followPointer: false,
      draggable: false,
      morphTarget: 'question',
      morphEasing: 'ease-in-out-cubic',
      look: 'candy',
      showBrows: true,
      showBlush: true,
    });
    const peach = resolveAppendooCompanionPreviewModel(appendooCompanion({ body: {
      shape: 'peach', size: 2, wonk: 1, wonkScatter: false, wonkSeed: 1, lean: 'none', bodyAsym: 0.2, rimAsym: 0.1, rimWeight: 1.2, rimScale: 1.02, rimShiftX: 0, rimShiftY: 0, trimMotion: 0,
    } }));
    const barbapapa = resolveAppendooCompanionPreviewModel(appendooCompanion({ body: {
      shape: 'barbapapa', size: 2, wonk: 1, wonkScatter: false, wonkSeed: 1, lean: 'none', bodyAsym: 0.2, rimAsym: 0.1, rimWeight: 1.2, rimScale: 1.02, rimShiftX: 0, rimShiftY: 0, trimMotion: 0,
    } }));
    const rimmed = resolveAppendooCompanionPreviewModel(appendooCompanion({ body: {
      shape: 'peach', size: 2, wonk: 1, wonkScatter: false, wonkSeed: 1, lean: 'none', bodyAsym: 0.2, rimAsym: 1, rimWeight: 1.2, rimScale: 1.1, rimShiftX: 0.8, rimShiftY: -0.4, trimMotion: 0,
    } }));
    const large = resolveAppendooCompanionPreviewModel(appendooCompanion({ body: {
      shape: 'peach', size: 10, wonk: 1, wonkScatter: false, wonkSeed: 1, lean: 'none', bodyAsym: 0.2, rimAsym: 0.1, rimWeight: 1.2, rimScale: 1.02, rimShiftX: 0, rimShiftY: 0, trimMotion: 0,
    } }));
    const wonky = resolveAppendooCompanionPreviewModel(appendooCompanion({ body: {
      shape: 'peach', size: 2, wonk: 10, wonkScatter: false, wonkSeed: 1, lean: 'none', bodyAsym: 0.2, rimAsym: 0.1, rimWeight: 1.2, rimScale: 1.02, rimShiftX: 0, rimShiftY: 0, trimMotion: 0,
    } }));
    const scattered = resolveAppendooCompanionPreviewModel(appendooCompanion({ body: {
      shape: 'peach', size: 2, wonk: 10, wonkScatter: true, wonkSeed: 1, lean: 'none', bodyAsym: 0.2, rimAsym: 0.1, rimWeight: 1.2, rimScale: 1.02, rimShiftX: 0, rimShiftY: 0, trimMotion: 0,
    } }));
    const reshuffled = resolveAppendooCompanionPreviewModel(appendooCompanion({ body: {
      shape: 'peach', size: 2, wonk: 10, wonkScatter: true, wonkSeed: 2, lean: 'none', bodyAsym: 0.2, rimAsym: 0.1, rimWeight: 1.2, rimScale: 1.02, rimShiftX: 0, rimShiftY: 0, trimMotion: 0,
    } }));
    const leaning = resolveAppendooCompanionPreviewModel(appendooCompanion({ body: {
      shape: 'peach', size: 2, wonk: 1, wonkScatter: false, wonkSeed: 1, lean: 'both', bodyAsym: 0.2, rimAsym: 0.1, rimWeight: 1.2, rimScale: 1.02, rimShiftX: 0, rimShiftY: 0, trimMotion: 0,
    } }));
    expect(peach.geometry.bodyPath).not.toEqual(barbapapa.geometry.bodyPath);
    expect(peach.geometry.rimPath).not.toEqual(rimmed.geometry.rimPath);
    expect(peach.body.shape).toBe('peach');
    expect(barbapapa.body.shape).toBe('barbapapa');
    expect(peach.restPoint).toMatchObject({ x: 50, y: 50 });
    expect(peach.box.width).toBe(72);
    expect(large.box.width).toBeGreaterThan(peach.box.width);
    expect(large.sizeStep).toBe(10);
    expect(peach.wonkStep).toBe(1);
    expect(wonky.wonkStep).toBe(10);
    expect(wonky.geometry.bodyPath).not.toEqual(peach.geometry.bodyPath);
    expect(scattered.geometry.bodyPath).not.toEqual(wonky.geometry.bodyPath);
    expect(reshuffled.geometry.bodyPath).not.toEqual(scattered.geometry.bodyPath);
    expect(scattered.body.wonkScatter).toBe(true);
    expect(leaning.body.lean).toBe('both');
    expect(leaning.geometry.bodyPath).not.toEqual(peach.geometry.bodyPath);
    expect(exportAppendooCompanionConfig(appendooCompanion()).lean).toBe('none');
    expect(peach.gel.lo).toBe('#f0b396');
    expect(barbapapa.gel.mid).toBe('#f3b0cf');
    const faceless = resolveAppendooCompanionPreviewModel(appendooCompanion({ body: {
      shape: 'none', size: 2, wonk: 1, wonkScatter: false, wonkSeed: 1, lean: 'none', bodyAsym: 0.2, rimAsym: 0.1, rimWeight: 1.2, rimScale: 1.02, rimShiftX: 0, rimShiftY: 0, trimMotion: 0,
    } }));
    expect(faceless.body.shape).toBe('none');
    expect(faceless.shape.label).toBe('None');
    expect(faceless.geometry.extras).toEqual([]);
    expect(resolveAppendooCompanionPreviewModel(appendooCompanion({
      colorMode: 'theme',
    }), '#0078D4').gel.lo).not.toBe('#f0b396');
    expect(resolveAppendooCompanionPreviewModel(appendooCompanion({
      colorMode: 'palette',
      paletteSwatchId: 'cranberry-core',
    })).gel.lo).not.toBe('#f0b396');
    const dressed = resolveAppendooCompanionPreviewModel(appendooCompanion({
      emotion: 'surprise',
      accessories: { hat: true, glasses: true, headphones: false },
      accessoryPaintId: 'cobalt',
    }));
    expect(dressed.accessories.hat).toBe(true);
    expect(dressed.accessories.glasses).toBe(true);
    expect(dressed.accessoryPaint.id).toBe('cobalt');
    expect(dressed.accessoryPaint.mid).not.toBe(peach.gel.mid);
    expect(dressed.accessoryMood.hat.lift).toBeGreaterThan(peach.accessoryMood.hat.lift);
    expect(dressed.accessoryMood.glasses.scale).toBeGreaterThan(peach.accessoryMood.glasses.scale);
    expect(resolveAppendooCompanionPreviewModel(appendooCompanion({
      followPointer: true,
    })).followPointer).toBe(true);
    expect(resolveAppendooCompanionPreviewModel(appendooCompanion({
      draggable: true,
    })).draggable).toBe(true);
    expect(resolveAppendooCompanionPreviewModel(appendooCompanion()).morph.target).toBe('question');
    expect(resolveAppendooCompanionPreviewModel(appendooCompanion({
      morph: { ...APPENDOO_DEFAULT_MORPH, target: 'lightning' },
    })).morphMeta.label).toBe('Lightning');
    expect(resolveAppendooCompanionPreviewModel(appendooCompanion({
      morph: { ...APPENDOO_DEFAULT_MORPH, target: 'barbapapa' },
    })).morphMeta.label).toBe('Barbapapa');
    expect(exportAppendooCompanionConfig(appendooCompanion({ look: 'contour' })).look).toBe('contour');
    expect(resolveAppendooCompanionPreviewModel(appendooCompanion({ look: 'wash' })).lookMeta.label).toBe('Watercolor');
    expect(resolveAppendooCompanionPreviewModel(appendooCompanion({ look: 'graphite' })).lookMeta.label).toBe('Graphite');
    expect(resolveAppendooCompanionPreviewModel(appendooCompanion({ look: 'realistic' })).lookMeta.label).toBe('Realistic');
    const hop = resolveAppendooCompanionPreviewModel(appendooCompanion({
      travel: {
        fromX: 0,
        fromY: 0,
        toX: 100,
        toY: 0,
        durationMs: 800,
        easing: 'linear',
        bezierX1: 0,
        bezierY1: 0,
        bezierX2: 1,
        bezierY2: 1,
        loop: true,
      },
    }));
    expect(hop.travel.loop).toBe(true);
    expect(hop.cssEasing).toBe('cubic-bezier(0, 0, 1, 1)');
    expect(hop.restPoint.x).toBe(0);
    expect(sampleAppendooTravel(hop.travel, 0.5).x).toBeCloseTo(50, 5);
  });

  it('color-picker: resolves picker export model and dependent controls', () => {
    const config = colorPicker({
      variant: 'popover',
      showAlpha: true,
      showPresets: false,
    });
    expect(resolveColorPickerPreviewModel(config)).toMatchObject({
      variant: 'popover',
      controls: { alpha: true, presets: false, eyeDropper: true },
    });
    expect(exportColorPickerBaseComponentsConfig(config)).toMatchObject({
      variant: 'popover',
      showAlpha: true,
      showPresets: false,
    });
  });

  it('variable-color-picker: resolves picker export model and dependent controls', () => {
    const config = variableColorPicker({
      variant: 'popover',
      size: 'lg',
      showCssOutput: false,
    });
    expect(resolveVariableColorPickerPreviewModel(config)).toMatchObject({
      variant: 'popover',
      size: 'lg',
      controls: {
        cssOutput: false,
        sourceSelector: true,
      },
    });
    expect(exportVariableColorPickerBaseComponentsConfig(config)).toMatchObject({
      variant: 'popover',
      size: 'lg',
      showCssOutput: false,
    });
  });

  it('gradient-picker: resolves picker export model and dependent controls', () => {
    const config = gradientPicker({
      variant: 'popover',
      size: 'lg',
      showCssOutput: false,
    });
    expect(resolveGradientPickerPreviewModel(config)).toMatchObject({
      variant: 'popover',
      size: 'lg',
      controls: {
        cssOutput: false,
        typeSelector: true,
      },
    });
    expect(exportGradientPickerBaseComponentsConfig(config)).toMatchObject({
      variant: 'popover',
      size: 'lg',
      showCssOutput: false,
    });
  });

  it('border-shadow-picker: resolves picker export model and dependent controls', () => {
    const config = borderShadowPicker({
      variant: 'popover',
      size: 'lg',
      showCssOutput: true,
    });
    expect(resolveBorderShadowPickerPreviewModel(config)).toMatchObject({
      variant: 'popover',
      size: 'lg',
      controls: {
        cssOutput: true,
        reverse: true,
      },
    });
    expect(exportBorderShadowPickerBaseComponentsConfig(config)).toMatchObject({
      variant: 'popover',
      size: 'lg',
      showCssOutput: true,
    });
  });

  it('icon-sets: resolves production NavigationIcon sizing/stroke/color, naming, direction, and state', () => {
    const config: IconSetsBaseComponentsConfig = {
      packId: 'lucide',
      search: 'arrow',
      selectedIconRef: 'lucide:ArrowRight',
      colorTone: 'rose',
      size: '3xl',
      stroke: 'bold',
      state: 'selected',
      direction: 'rtl',
      naming: 'named',
    };
    const model = resolveIconSetsRenderModel(config);
    expect(model).toMatchObject({ direction: 'rtl', selected: true, disabled: false });
    expect(model.iconClassName).toContain('h-10');
    expect(model.iconClassName).toContain('text-rose-600');
    expect(model.iconClassName).toContain('stroke-[2.5]');
    expect(model.ariaLabelFor('ArrowRight')).toBe('ArrowRight');
    expect(resolveIconSetsRenderModel({ ...config, naming: 'decorative' }).ariaLabelFor('ArrowRight')).toBeUndefined();
    expect(resolveIconSetsPreviewState('disabled')).toEqual({ disabled: true, selectedLabel: null });
  });

  it('shell-foundation: covers every production export with component-specific live presets/states/surfaces', () => {
    expect(new Set(SHELL_FOUNDATION_COMPONENT_IDS).size).toBe(SHELL_FOUNDATION_COMPONENT_IDS.length);
    for (const component of SHELL_FOUNDATION_COMPONENT_IDS) {
      const options = getShellFoundationGalleryOptions(component);
      expect(options.states).toContain('default');
      expect(options.presets).toContain('component-default');
    }
    expect(getShellFoundationGalleryOptions('ShellHeader').states).toEqual(['default', 'sticky', 'shrunk']);
    expect(getShellFoundationGalleryOptions('ShellContentHost').surfaces).toEqual(['neutral', 'raised', 'inset']);
    expect(getShellFoundationGalleryOptions('ShellSurface').surfaces).toContain('glass');
    const config: ShellFoundationGalleryConfig = {
      component: 'ShellHeader',
      preset: 'floating',
      surface: 'glass',
      state: 'shrunk',
      viewport: 'phone',
      direction: 'rtl',
      forcedColors: true,
      focusTrace: true,
    };
    expect(exportShellFoundationGalleryConfig(config)).toMatchObject({
      public: { direction: 'rtl', viewport: 'phone' },
      composition: { component: 'ShellHeader', preset: 'floating' },
      demo: { scenarios: { state: 'shrunk', forcedColors: true, focusTrace: true } },
    });
    expect(exportShellFoundationGalleryConfig(config).composition).not.toHaveProperty('surface');
  });

  it('shell-navigation: covers every production export and normalizes manifest/path/state visibility', () => {
    expect(new Set(SHELL_NAVIGATION_COMPONENT_IDS).size).toBe(SHELL_NAVIGATION_COMPONENT_IDS.length);
    expect(getShellNavigationGalleryOptions('ShellNavIcon', 'deep')).toEqual({
      usesManifest: false,
      activePaths: [],
      states: ['default'],
    });
    expect(getShellNavigationGalleryOptions('ShellMobileDrawerNavigation', 'deep')).toMatchObject({
      usesManifest: true,
      activePaths: ['fixture-default', 'first', 'nested', 'unavailable'],
      states: ['default', 'open', 'unavailable-route'],
    });
    const config: ShellNavigationGalleryConfig = {
      component: 'ShellSidebarNavigation',
      manifest: 'deep',
      activePath: 'nested',
      state: 'unavailable-route',
      viewport: 'phone',
      direction: 'rtl',
      keyboardTrace: false,
      itemContent: ['icon', 'label'],
    };
    expect(resolveShellNavigationCurrentPath(config)).toBe('/missing');
    expect(resolveShellNavigationCurrentPath({ ...config, state: 'default' })).toBe('/studio/components/shell');
    expect(exportShellNavigationGalleryConfig(config)).toMatchObject({
      public: { currentPath: '/missing', direction: 'rtl' },
      composition: { component: 'ShellSidebarNavigation', interaction: 'disclosure' },
      demo: { fixtures: { manifest: 'deep' }, scenarios: { viewport: 'phone', keyboardTrace: false } },
    });
  });

  it('shell-effects: builds target-compatible production layers and resolves presets, planes, preferences, budgets, and exports', () => {
    const config: ShellEffectsGalleryConfig = {
      effectId: 'aurora',
      preset: 'expressive',
      layerCount: 4,
      target: 'hero',
      plane: 'overlay',
      viewport: 'phone',
      fallback: 'runtime',
      reducedMotion: false,
      reducedTransparency: true,
      reducedData: true,
      paused: true,
      diagnostics: true,
      parameters: 'preset-default',
      interaction: 'none',
    };
    const layers = buildShellEffectGalleryLayers(config);
    expect(layers).toHaveLength(4);
    expect(layers[0].effectId).toBe('aurora');
    expect(layers.every((layer) => layer.target === 'hero' && layer.plane === 'overlay')).toBe(true);
    expect(layers.every((layer) => SHELL_EFFECT_CATALOG[layer.effectId].targets.includes('hero'))).toBe(true);
    const validation = validateShellEffectStack({ layers, reducedMotionFallback: 'static' }, 'phone');
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.code === 'stack.motion-budget-exceeded')).toBe(true);
    expect(resolveShellEffectFallback(layers[0], 'phone', 'runtime', {
      reducedTransparency: true,
    })).toBe('simplified');
    expect(exportShellEffectsGalleryConfig(config)).toMatchObject({
      public: { fallback: 'runtime', paused: true, viewport: 'phone' },
      composition: { effectId: 'aurora', presetId: 'expressive-aurora', target: 'hero', plane: 'overlay', layers },
      demo: {
        fixtures: { layerCount: 4 },
        scenarios: {
          preferences: { reducedMotion: false, reducedTransparency: true, reducedData: true },
          diagnostics: true,
        },
      },
    });
  });
});
