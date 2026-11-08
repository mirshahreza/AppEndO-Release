import { describe, expect, it } from 'vitest';
import {
  applyFormFieldsBooleanOption,
  type FormFieldsBaseComponentsConfig,
} from '../form-fields/FormFieldsBaseComponentsWorkspace';
import {
  resolveRelationsConfigForKind,
  type RelationsBaseComponentsConfig,
} from '../relations/RelationsBaseComponentsWorkspace';
import { markdownToolbarProps } from '../markdown-editor/MarkdownEditorBaseComponentsWorkspace';
import { htmlToolbarProps } from '../html-editor/HtmlEditorBaseComponentsWorkspace';
import {
  dateTimeConstraints,
  dateTimeSelectionForPattern,
} from '../date-time/DateTimeBaseComponentsWorkspace';
import { normalizeFileMediaSelection } from '../../../shared/ui/file-media-input/FileMediaInput';
import { exportAvatarBaseComponentsConfig } from '../avatar/AvatarBaseComponentsWorkspace';
import { exportChipBaseComponentsConfig } from '../chip/ChipBaseComponentsWorkspace';
import { exportLoadingErrorEmptyConfig } from '../loading-error-empty/LoadingErrorEmptyBaseComponentsWorkspace';
import { exportOrbitBorderBaseComponentsConfig } from '../orbit-border/OrbitBorderBaseComponentsWorkspace';
import { exportOrbitBgBaseComponentsConfig } from '../orbit-bg/OrbitBgBaseComponentsWorkspace';
import { exportProgressBaseComponentsConfig } from '../progress/ProgressBaseComponentsWorkspace';
import { exportSkeletonBaseComponentsConfig } from '../skeleton/SkeletonBaseComponentsWorkspace';
import { resolveToastPreviewTitle } from '../toast/ToastBaseComponentsWorkspace';
import { resolveIconSetsPreviewState } from '../icon-sets/IconSetsBaseComponentsWorkspace';
import {
  DEFAULT_SHELL_EFFECTS_GALLERY_CONFIG,
  buildShellEffectGalleryLayers,
} from '../shell-effects/ShellEffectsBaseComponentsWorkspace';
import { getShellFoundationGalleryOptions } from '../shell-foundation/ShellFoundationBaseComponentsWorkspace';
import {
  getShellNavigationGalleryOptions,
  resolveShellNavigationCurrentPath,
  type ShellNavigationGalleryConfig,
} from '../shell-navigation/ShellNavigationBaseComponentsWorkspace';

describe('Base Components option liveness', () => {
  it('normalizes required-only form validation state', () => {
    const config: FormFieldsBaseComponentsConfig = {
      group: 'text',
      controlSize: 'sm',
      invalid: false,
      requiredInvalidOnMount: true,
      disabled: false,
      required: true,
      feedbackPlacement: 'overlay',
      autoDir: true,
      showHint: false,
      readOnly: false,
      prefix: '$',
      suffix: 'USD',
      optionCardFixture: 'policy',
      optionCardColumns: 2,
      optionCardDensity: 'default',
      optionCardShowIcon: true,
      optionCardShowMeta: true,
    };

    expect(applyFormFieldsBooleanOption(config, 'required', false)).toMatchObject({
      required: false,
      requiredInvalidOnMount: false,
    });
  });

  it('selects a real compatible relation widget when kind changes', () => {
    const config: RelationsBaseComponentsConfig = {
      controlSize: 'sm',
      disabled: false,
      kind: 'belongsTo',
      widget: 'lookup',
      cardinality: 'single',
      limits: 'none',
      presentation: 'widget-default',
      inlineMutation: [],
      state: 'default',
    };

    expect(resolveRelationsConfigForKind(config, 'hasMany')).toMatchObject({
      kind: 'hasMany',
      widget: 'relatedGrid',
    });
    expect(resolveRelationsConfigForKind(config, 'belongsTo')).toMatchObject({
      widget: 'lookup',
    });
  });

  it('maps editor toolbar choices to production toolbar props', () => {
    expect(markdownToolbarProps('minimal')).toMatchObject({
      showToolbar: false,
      enableImage: false,
      enableTable: false,
      enableTextDirection: false,
    });
    expect(markdownToolbarProps('standard')).toMatchObject({
      showToolbar: true,
      enableTextDirection: true,
      enableImage: false,
    });
    expect(markdownToolbarProps('full')).toMatchObject({
      showToolbar: true,
      enableImage: true,
      enableTable: true,
      enableTextDirection: true,
    });
    expect(htmlToolbarProps('minimal')).toMatchObject({
      showToolbar: false,
      enableImage: false,
      enableTextDirection: false,
    });
    expect(htmlToolbarProps('standard')).toMatchObject({
      showToolbar: true,
      enableTextDirection: true,
      enableImage: false,
    });
    expect(htmlToolbarProps('full')).toMatchObject({
      showToolbar: true,
      enableImage: true,
      enableTable: true,
      enableTextDirection: true,
    });
  });

  it('derives date selection and calendar-specific constraints', () => {
    expect(dateTimeSelectionForPattern('date-range')).toBe('range');
    expect(dateTimeSelectionForPattern('date-time')).toBe('single');
    expect(dateTimeConstraints('persian', 'release-window')).toEqual({
      minValue: '1405-05-10',
      maxValue: '1405-06-09',
    });
  });

  it('enforces file type, size, count, and single-file limits', () => {
    const image = { name: 'avatar.png', type: 'image/png', size: 1024 } as File;
    const document = { name: 'notes.pdf', type: 'application/pdf', size: 1024 } as File;
    const oversized = { name: 'large.png', type: 'image/png', size: 3 * 1024 * 1024 } as File;

    expect(normalizeFileMediaSelection([image, document, oversized], {
      multiple: true,
      accept: 'image/*',
      maxCount: 5,
      maxSizeMb: 2,
    })).toEqual({ files: [image], rejected: true });

    expect(normalizeFileMediaSelection([image, document], {
      multiple: false,
      accept: '*/*',
      maxCount: 5,
      maxSizeMb: 2,
    })).toEqual({ files: [image], rejected: true });
  });
});

describe('Base Components option liveness', () => {
  it('removes inactive async-state branches from export', () => {
    const exported = exportLoadingErrorEmptyConfig({
      kind: 'empty',
      loading: 'skeleton',
      error: 'panel',
      empty: 'filtered',
      retry: true,
      details: true,
      primaryAction: false,
      state: 'offline',
    });
    expect(exported.composition).toEqual({ emptyPreset: 'filtered', primaryAction: false });
    expect(exported.demo).toEqual({ kind: 'empty' });
  });

  it('normalizes dependent primitive options in export', () => {
    expect(exportSkeletonBaseComponentsConfig({
      preset: 'avatar',
      animationType: 'shimmer',
      density: 'default',
      rows: 6,
      reducedMotion: true,
    })).toEqual({
      preset: 'avatar',
      animationType: 'none',
      density: 'default',
      reducedMotion: true,
    });

    expect(exportProgressBaseComponentsConfig({
      preset: 'spinner',
      value: 90,
      color: 'danger',
      size: 'md',
      isIndeterminate: false,
      showOutput: true,
      status: 'error',
      presentation: 'block',
      showLabel: false,
    })).toEqual({ preset: 'spinner', presentation: 'block', showLabel: false });

    expect(exportAvatarBaseComponentsConfig({
      source: 'icon',
      size: 'md',
      color: 'accent',
      initials: 'ZZ',
      group: 'single',
      presence: 'none',
      shape: 'circle',
      bordered: false,
      state: 'image-error',
      maxVisible: 6,
    })).toEqual({
      source: 'icon',
      size: 'md',
      color: 'accent',
      group: 'single',
      shape: 'circle',
      bordered: false,
      presence: 'none',
    });
  });

  it('exports only live chip and orbit controls', () => {
    expect(exportChipBaseComponentsConfig({
      preset: 'choice',
      color: 'danger',
      size: 'lg',
      variant: 'primary',
      label: 'Active',
      content: 'icon-label',
      removable: true,
      selectable: true,
      selected: true,
      state: 'default',
      collection: 'single',
    })).not.toHaveProperty('color');

    expect(exportOrbitBorderBaseComponentsConfig({
      enabled: false,
      intensity: 'expressive',
      preset: 'sunset',
      borderWidth: 8,
      borderRadius: '9999px',
      hostBackground: 'transparent',
      showGlow: true,
      glowBlur: 20,
      glowOpacity: 1,
      speed: 10,
      direction: 'reverse',
      motionPreference: 'reduced',
      tailLength: 26,
      cometCount: 2,
      showTrack: true,
      colorSteps: 10,
      reverseColors: true,
    })).toEqual({ enabled: false });

    expect(exportOrbitBgBaseComponentsConfig({
      enabled: false,
      intensity: 'expressive',
      preset: 'sunset',
      effect: 'aurora',
      motion: 'drift',
      shape: 'scribble',
      borderRadius: '9999px',
      hostBackground: 'transparent',
      showGlow: true,
      glowBlur: 40,
      glowOpacity: 1,
      speed: 10,
      direction: 'reverse',
      motionPreference: 'reduced',
      coverage: 82,
      size: 70,
      blobCount: 5,
      showWash: true,
      colorSteps: 10,
      reverseColors: true,
    })).toEqual({ enabled: false });
  });

  it('maps toast lifecycle and icon state to observable preview output', () => {
    expect(resolveToastPreviewTitle({
      type: 'success',
      title: 'Published',
      message: 'Done',
      duration: 5000,
      dismissible: true,
      action: false,
      lifecycle: 'promise',
      position: 'top-end',
      stack: 1,
      state: 'updated',
    })).toBe('Published · updated');
    expect(resolveIconSetsPreviewState('selected')).toEqual({
      disabled: false,
      selectedLabel: 'Selected',
    });
    expect(resolveIconSetsPreviewState('disabled').disabled).toBe(true);
  });

  it('limits shell controls to states their production export renders', () => {
    expect(getShellFoundationGalleryOptions('ShellHeader').states).toEqual(['default', 'sticky', 'shrunk']);
    expect(getShellFoundationGalleryOptions('ShellBackToTop').states).toEqual(['default']);
    expect(getShellFoundationGalleryOptions('ShellContentHost').surfaces).not.toContain('glass');

    expect(getShellNavigationGalleryOptions('ShellNavIcon', 'deep').usesManifest).toBe(false);
    expect(getShellNavigationGalleryOptions('ShellMobileDrawerNavigation', 'deep').states).toContain('open');
  });

  it('gives every requested shell-effect layer the selected live target', () => {
    const layers = buildShellEffectGalleryLayers({
      ...DEFAULT_SHELL_EFFECTS_GALLERY_CONFIG,
      layerCount: 4,
      target: 'hero',
    });
    expect(layers).toHaveLength(4);
    expect(layers.every((layer) => layer.target === 'hero')).toBe(true);
  });

  it('resolves distinct navigation active-path scenarios', () => {
    const base: ShellNavigationGalleryConfig = {
      component: 'ShellSidebarNavigation',
      manifest: 'deep',
      activePath: 'fixture-default',
      state: 'default',
      viewport: 'desktop',
      direction: 'ltr',
      keyboardTrace: true,
      itemContent: ['icon', 'label'],
    };
    expect(resolveShellNavigationCurrentPath(base)).toBe('/studio/deployments');
    expect(resolveShellNavigationCurrentPath({ ...base, activePath: 'first' })).toBe('/studio/overview');
    expect(resolveShellNavigationCurrentPath({ ...base, activePath: 'nested' })).toBe('/studio/components/shell');
  });
});
