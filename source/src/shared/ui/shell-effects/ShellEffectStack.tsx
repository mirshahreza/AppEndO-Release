import React, { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { ShellEffectLayer } from './ShellEffectLayer';
import type { ShellEffectFallback, ShellEffectStackProps } from './types';
import { getShellEffectMovingUnits } from './validation';

function budgetedFallbacks(
  layers: ShellEffectStackProps['layers'],
  viewport: NonNullable<ShellEffectStackProps['viewport']>,
  requested: ShellEffectFallback,
): ReadonlyMap<string, ShellEffectFallback> {
  const limit = viewport === 'desktop' ? 3 : viewport === 'tablet' ? 2 : 1;
  let used = 0;
  return new Map(
    layers.map((layer) => {
      const units = getShellEffectMovingUnits(layer, viewport, requested);
      if (used + units > limit) return [layer.id, 'static'] as const;
      used += units;
      return [layer.id, requested] as const;
    }),
  );
}

export function ShellEffectStack({
  layers,
  isolation = true,
  overflow = 'clip',
  reducedMotionFallback = 'static',
  target,
  viewport = 'desktop',
  fallback = 'runtime',
  paused = false,
  semanticPalette,
  className,
  style,
  children,
}: ShellEffectStackProps) {
  const acceptedLayers = layers.length <= 4 ? layers : [];
  const fallbackById = useMemo(
    () => budgetedFallbacks(acceptedLayers, viewport, fallback),
    [acceptedLayers, viewport, fallback],
  );
  const stackStyle = {
    isolation: isolation ? 'isolate' : undefined,
    overflow,
    ...style,
  } as CSSProperties;

  return (
    <div
      className={['shell-effect-stack', className].filter(Boolean).join(' ')}
      data-shell-effect-stack=""
      data-layer-count={acceptedLayers.length}
      data-invalid-layer-count={layers.length > 4 ? layers.length : undefined}
      style={stackStyle}
    >
      {acceptedLayers.map((layer) =>
        target && layer.target !== target ? null : (
          <ShellEffectLayer
            key={layer.id}
            layer={layer}
            viewport={viewport}
            fallback={fallbackById.get(layer.id) ?? fallback}
            reducedMotionFallback={reducedMotionFallback}
            paused={paused}
            semanticPalette={semanticPalette}
          />
        ),
      )}
      {children === undefined ? null : (
        <div className="shell-effect-stack__content">{children}</div>
      )}
    </div>
  );
}

