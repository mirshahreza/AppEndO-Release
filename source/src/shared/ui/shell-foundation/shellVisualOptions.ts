import type * as React from 'react';
import type {
  ShellBackdropTreatment,
  ShellColorRef,
  ShellDesignTokens,
  ShellRegionShapeDepth,
  ShellShapeDepth,
  ShellTypographyProfile,
} from '../../api/contracts/shell-designer';
import { cn } from '../../../lib/utils';

type ResolvedShapeDepth = ShellShapeDepth | ShellRegionShapeDepth;

const semanticColor = (token: string): string => {
  const values: Record<string, string> = {
    surface: 'hsl(var(--heroui-background))',
    'surface-elevated': 'hsl(var(--heroui-content1))',
    'inverse-surface': 'hsl(var(--heroui-foreground))',
    'surface-foreground': 'hsl(var(--heroui-foreground))',
    'surface-muted': 'hsl(var(--heroui-content2))',
    neutral: 'hsl(var(--heroui-default-500))',
    accent: 'hsl(var(--heroui-primary-500))',
    success: 'hsl(var(--heroui-success-500))',
    warning: 'hsl(var(--heroui-warning-500))',
    danger: 'hsl(var(--heroui-danger-500))',
    info: 'hsl(var(--heroui-secondary-500))',
  };
  return values[token] ?? 'hsl(var(--heroui-background))';
};

export const shellColorValue = (color?: ShellColorRef): string | undefined => {
  if (!color) return undefined;
  return color.source === 'custom' ? color.value.hex : semanticColor(color.token);
};

const gradientDirection: Record<string, string> = {
  top: 'to top',
  'top-end': 'to top right',
  end: 'to right',
  'bottom-end': 'to bottom right',
  bottom: 'to bottom',
  'bottom-start': 'to bottom left',
  start: 'to left',
  'top-start': 'to top left',
};

const patternSize: Record<string, string> = { xs: '8px', sm: '12px', md: '20px', lg: '32px', xl: '48px' };
const patternOpacity: Record<string, number> = { faint: 0.05, subtle: 0.09, visible: 0.16, strong: 0.25 };

export function shellBackdropStyle(backdrop?: ShellBackdropTreatment): React.CSSProperties {
  if (!backdrop) return {};
  const base = shellColorValue(backdrop.baseColor);
  if (backdrop.mode === 'solid') return { backgroundColor: base };
  const layers: string[] = [];
  if (backdrop.mode === 'gradient' || backdrop.mode === 'gradient-pattern') {
    const stops = backdrop.gradient.stops
      .map((stop) => `${shellColorValue(stop.color)} ${stop.position}%`)
      .join(', ');
    const type = backdrop.gradient.type;
    const lead = type === 'linear'
      ? `${gradientDirection[backdrop.gradient.direction] ?? 'to bottom'}, `
      : type === 'radial' ? 'circle, ' : 'from 0deg, ';
    layers.push(`${type}-gradient(${lead}${stops})`);
  }
  if (backdrop.mode === 'pattern' || backdrop.mode === 'gradient-pattern') {
    const pattern = backdrop.pattern;
    const color = shellColorValue(pattern.color);
    const opacity = patternOpacity[pattern.opacity];
    const mark = `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)`;
    layers.push(pattern.kind === 'grid'
      ? `linear-gradient(${mark} 1px, transparent 1px), linear-gradient(90deg, ${mark} 1px, transparent 1px)`
      : pattern.kind === 'lines'
        ? `linear-gradient(${mark} 1px, transparent 1px)`
        : `radial-gradient(circle, ${mark} 1px, transparent 1.5px)`);
  }
  return {
    backgroundColor: base,
    backgroundImage: layers.join(', '),
    backgroundSize: patternSize[
      (backdrop.mode === 'pattern' || backdrop.mode === 'gradient-pattern')
        ? backdrop.pattern.scale
        : 'md'
    ],
  };
}

const radiusClass: Record<string, string> = {
  none: 'rounded-none', xs: 'rounded-sm', sm: 'rounded', md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl',
};
const shadowClass: Record<string, string> = {
  none: '', xs: 'shadow-sm', sm: 'shadow', md: 'shadow-md', lg: 'shadow-lg', xl: 'shadow-xl',
};
const blurClass: Record<string, string> = {
  none: '', sm: 'backdrop-blur-sm', md: 'backdrop-blur-md', lg: 'backdrop-blur-lg',
};

export function shellShapeDepthClass(shape?: ResolvedShapeDepth): string {
  if (!shape) return '';
  const radius = 'radius' in shape && typeof shape.radius === 'object'
    ? shape.radius.global
    : shape.radius;
  const shadow = shape.shadow && shape.shadow !== 'inherit' ? shape.shadow : undefined;
  const border = shape.border && shape.border !== 'inherit' ? shape.border : undefined;
  const backdrop = shape.backdrop && shape.backdrop !== 'inherit' ? shape.backdrop : undefined;
  return cn(
    radius && radiusClass[radius],
    shadow && shadowClass[shadow.level],
    border?.strength === 'hairline' && 'border border-divider/60',
    border?.strength === 'soft' && 'border border-divider',
    border?.strength === 'defined' && 'border-2 border-divider',
    backdrop?.style === 'translucent' && 'bg-background/85',
    backdrop?.style === 'glass' && 'bg-background/70 motion-reduce:backdrop-blur-none',
    backdrop && blurClass[backdrop.blur],
  );
}

export function shellDesignTokenStyle(tokens?: ShellDesignTokens): React.CSSProperties {
  if (!tokens) return {};
  const accent = tokens.accent.source === 'runtime-accent' ? undefined : shellColorValue(tokens.accent);
  const neutralHue = tokens.neutralFamily === 'slate' ? '215' : tokens.neutralFamily === 'zinc' ? '240' : '220';
  const bias = tokens.surfaceBias === 'warm' ? '38' : tokens.surfaceBias === 'cool' ? '215' : neutralHue;
  return {
    ...(accent ? { '--shell-accent': accent, '--color-primary-500': accent } : {}),
    '--shell-neutral-hue': neutralHue,
    '--shell-surface-hue': bias,
  } as React.CSSProperties;
}

const fontFallback: Record<string, string> = {
  inter: '"Inter", sans-serif',
  system: 'ui-sans-serif, system-ui, sans-serif',
  editorial: 'Georgia, serif',
  mono: 'ui-monospace, monospace',
};

export function shellTypographyStyle(typography?: ShellTypographyProfile): React.CSSProperties {
  if (!typography) return {};
  const body = typography.roles.body;
  const navigation = typography.roles.navigation;
  return {
    fontFamily: fontFallback[body.fontProfileId] ?? `"${body.fontProfileId}", ui-sans-serif, system-ui, sans-serif`,
    color: shellColorValue(body.color),
    '--shell-font-navigation': fontFallback[navigation.fontProfileId] ?? `"${navigation.fontProfileId}", sans-serif`,
    '--shell-navigation-color': shellColorValue(navigation.color),
  } as React.CSSProperties;
}
