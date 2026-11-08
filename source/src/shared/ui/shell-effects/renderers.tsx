import React from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { createSeededPoints, seededPolygon } from './seeded';
import type {
  ShellEffectLayerConfig,
  ShellEffectRendererProps,
  ShellEffectRuntimeContext,
} from './types';

type LayerOf<Id extends ShellEffectLayerConfig['effectId']> = Extract<
  ShellEffectLayerConfig,
  { effectId: Id }
>;

function color(runtime: ShellEffectRuntimeContext, index: number): string {
  return runtime.palette[index % runtime.palette.length] ?? '#0d9488';
}

function variables(
  layer: ShellEffectLayerConfig,
  runtime: ShellEffectRuntimeContext,
  extra: CSSProperties = {},
): CSSProperties {
  return {
    '--se-color-a': color(runtime, 0),
    '--se-color-b': color(runtime, 1),
    '--se-color-c': color(runtime, 2),
    '--se-progress': runtime.progress,
    '--se-pointer-x': runtime.pointer.x,
    '--se-pointer-y': runtime.pointer.y,
    ...extra,
  } as CSSProperties;
}

function shell(
  effectId: ShellEffectLayerConfig['effectId'],
  runtime: ShellEffectRuntimeContext,
  content: React.ReactNode,
  style?: CSSProperties,
): ReactElement {
  return (
    <div
      className="shell-effect-renderer"
      data-effect-renderer={effectId}
      data-effect-fallback={runtime.fallback}
      data-effect-paused={runtime.paused || undefined}
      style={style}
    >
      {content}
    </div>
  );
}

export function AnimatedGradientEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'animated-gradient') return null;
  const current = layer as LayerOf<'animated-gradient'>;
  const stops = Array.from(
    { length: current.config.stops },
    (_, index) =>
      `${color(runtime, index)} ${Math.round((index / (current.config.stops - 1)) * 100)}%`,
  ).join(',');
  return shell(
    current.effectId,
    runtime,
    null,
    variables(current, runtime, {
      backgroundImage: `linear-gradient(${current.config.angle}deg,${stops})`,
      backgroundSize: '220% 220%',
      animationDuration: `${current.config.duration}s`,
    }),
  );
}

export function MeshGradientEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'mesh-gradient') return null;
  const current = layer as LayerOf<'mesh-gradient'>;
  const points = createSeededPoints(current.seed, current.config.points);
  const backgrounds = points
    .map(
      (point, index) =>
        `radial-gradient(circle at ${point.x}% ${point.y}%, ${color(runtime, index)} 0, transparent ${25 + point.size * 10}%)`,
    )
    .join(',');
  return shell(
    current.effectId,
    runtime,
    null,
    variables(current, runtime, {
      backgroundImage: backgrounds,
      filter: `blur(${current.config.blur}px)`,
      animationDuration: `${24 - current.config.morph / 8}s`,
      transform: 'scale(1.12)',
    }),
  );
}

export function AuroraEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'aurora') return null;
  const current = layer as LayerOf<'aurora'>;
  return shell(
    current.effectId,
    runtime,
    Array.from({ length: current.config.bands }, (_, index) => (
      <span
        key={index}
        className="shell-effect-aurora-band"
        style={
          {
            '--se-index': index,
            '--se-band-color': color(runtime, index),
            width: `${current.config.spread}%`,
            animationDuration: `${16 - current.config.wave / 10}s`,
          } as CSSProperties
        }
      />
    )),
    variables(current, runtime),
  );
}

export function GradientOrbsEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'gradient-orbs') return null;
  const current = layer as LayerOf<'gradient-orbs'>;
  const points = createSeededPoints(current.seed, current.config.orbs);
  return shell(
    current.effectId,
    runtime,
    points.map((point, index) => (
      <span
        key={index}
        className="shell-effect-orb"
        style={{
          left: `${point.x}%`,
          top: `${point.y}%`,
          width: `${12 + point.size * 10}%`,
          aspectRatio: '1',
          background: color(runtime, index),
          filter: `blur(${current.config.blur}px)`,
          animationDelay: `${point.phase}s`,
          animationDuration: `${20 - current.config.drift / 8}s`,
        }}
      />
    )),
    variables(current, runtime),
  );
}

export function FloatingBlobsEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'floating-blobs') return null;
  const current = layer as LayerOf<'floating-blobs'>;
  const points = createSeededPoints(current.seed, current.config.blobs);
  return shell(
    current.effectId,
    runtime,
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {points.map((point, index) => (
        <polygon
          key={index}
          className="shell-effect-blob"
          points={seededPolygon(current.seed + index * 97, current.config.complexity)}
          fill={color(runtime, index)}
          opacity={0.3 + point.depth * 0.35}
          style={{
            transformOrigin: `${point.x}% ${point.y}%`,
            animationDelay: `${point.phase}s`,
            animationDuration: `${18 - current.config.morph / 8}s`,
          }}
          transform={`translate(${point.x - 50} ${point.y - 50}) scale(${0.18 + point.size / 7})`}
        />
      ))}
    </svg>,
    variables(current, runtime),
  );
}

export function FlowingWavesEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'flowing-waves') return null;
  const current = layer as LayerOf<'flowing-waves'>;
  return shell(
    current.effectId,
    runtime,
    <svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: current.config.waves }, (_, index) => {
        const y = 40 + (index * 220) / Math.max(1, current.config.waves - 1);
        const amplitude = current.config.amplitude;
        const path = `M-100 ${y} Q150 ${y - amplitude} 400 ${y} T900 ${y} T1400 ${y}`;
        return (
          <path
            key={index}
            className="shell-effect-wave"
            d={path}
            fill="none"
            stroke={color(runtime, index)}
            strokeWidth={1 + current.config.frequency / 2}
            opacity={0.25 + index / (current.config.waves * 3)}
            style={{ animationDelay: `${index * -0.7}s` }}
          />
        );
      })}
    </svg>,
    variables(current, runtime),
  );
}

export function LightRaysEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'light-rays') return null;
  const current = layer as LayerOf<'light-rays'>;
  const transparent = 'transparent';
  const step = 360 / current.config.rays;
  const stops = Array.from(
    { length: current.config.rays },
    (_, index) =>
      `${transparent} ${index * step}deg,${color(runtime, index)} ${index * step + step / 5}deg,${transparent} ${index * step + step / 2}deg`,
  ).join(',');
  return shell(
    current.effectId,
    runtime,
    null,
    variables(current, runtime, {
      backgroundImage: `conic-gradient(from ${current.config.rotation}deg at 50% -10%,${stops})`,
      clipPath: `polygon(${50 - current.config.spread / 2}% 0,${50 + current.config.spread / 2}% 0,100% 100%,0 100%)`,
    }),
  );
}

export function ConicRaysEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'conic-rays') return null;
  const current = layer as LayerOf<'conic-rays'>;
  const segment = 360 / current.config.rays;
  const stops = Array.from(
    { length: current.config.rays },
    (_, index) =>
      `transparent ${index * segment}deg,${color(runtime, index)} ${index * segment + segment * 0.35}deg,transparent ${index * segment + segment * (0.45 + current.config.softness / 200)}deg`,
  ).join(',');
  return shell(
    current.effectId,
    runtime,
    null,
    variables(current, runtime, {
      backgroundImage: `conic-gradient(from ${current.config.rotation}deg,${stops})`,
    }),
  );
}

export function ShimmerBandsEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'shimmer-bands') return null;
  const current = layer as LayerOf<'shimmer-bands'>;
  return shell(
    current.effectId,
    runtime,
    Array.from({ length: current.config.bands }, (_, index) => (
      <span
        key={index}
        className="shell-effect-shimmer-band"
        style={{
          width: `${current.config.width}%`,
          left: `${(index * 100) / current.config.bands}%`,
          background: `linear-gradient(${current.config.angle}deg,transparent,${color(runtime, index)},transparent)`,
          animationDelay: `${index * -1.4}s`,
        }}
      />
    )),
    variables(current, runtime),
  );
}

export function FilmGrainEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'film-grain') return null;
  const current = layer as LayerOf<'film-grain'>;
  const points = createSeededPoints(current.seed, Math.max(10, Math.round(current.config.grain / 2)));
  const dots = points
    .map(
      (point, index) =>
        `radial-gradient(circle at ${point.x}% ${point.y}%, ${current.config.monochrome ? color(runtime, 1) : color(runtime, index)} 0 ${point.size / 3}px, transparent ${point.size}px)`,
    )
    .join(',');
  return shell(
    current.effectId,
    runtime,
    null,
    variables(current, runtime, {
      backgroundImage: dots,
      animationDuration: `${1 / current.config.frameRate}s`,
    }),
  );
}

export function ParticleFieldEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'particle-field') return null;
  const current = layer as LayerOf<'particle-field'>;
  const points = createSeededPoints(current.seed, current.config.count);
  return shell(
    current.effectId,
    runtime,
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {current.config.connections &&
        points.slice(1).map((point, index) => {
          const previous = points[index];
          return (
            <line
              key={`line-${index}`}
              x1={previous.x}
              y1={previous.y}
              x2={point.x}
              y2={point.y}
              stroke={color(runtime, index)}
              strokeWidth="0.08"
              opacity="0.18"
            />
          );
        })}
      {points.map((point, index) => (
        <circle
          key={index}
          className="shell-effect-particle"
          cx={point.x}
          cy={point.y}
          r={(current.config.size * point.size) / 20}
          fill={color(runtime, index)}
          style={{
            animationDelay: `${point.phase}s`,
            animationDuration: `${18 - current.config.drift / 8}s`,
          }}
        />
      ))}
    </svg>,
    variables(current, runtime),
  );
}

export function StarfieldEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'starfield') return null;
  const current = layer as LayerOf<'starfield'>;
  const points = createSeededPoints(current.seed, current.config.count);
  return shell(
    current.effectId,
    runtime,
    points.map((point, index) => (
      <span
        key={index}
        className="shell-effect-star"
        style={{
          left: `${point.x}%`,
          top: `${point.y}%`,
          width: `${Math.max(1, point.depth * current.config.depth)}px`,
          height: `${Math.max(1, point.depth * current.config.depth)}px`,
          background: color(runtime, index),
          animationDelay: `${point.phase}s`,
          animationDuration: `${Math.max(1.5, 8 - current.config.twinkle / 14)}s`,
        }}
      />
    )),
    variables(current, runtime),
  );
}

export function AnimatedDotFieldEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'animated-dot-field') return null;
  const current = layer as LayerOf<'animated-dot-field'>;
  const points = createSeededPoints(current.seed, current.config.count);
  return shell(
    current.effectId,
    runtime,
    points.map((point, index) => (
      <span
        key={index}
        className="shell-effect-dot"
        style={{
          left: `${point.x}%`,
          top: `${point.y}%`,
          width: `${current.config.size}px`,
          height: `${current.config.size}px`,
          background: color(runtime, index),
          animationDelay: `${point.phase}s`,
          animationDuration: `${Math.max(2, 12 - current.config.pulse / 10)}s`,
        }}
      />
    )),
    variables(current, runtime),
  );
}

export function PerspectiveGridEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'perspective-grid') return null;
  const current = layer as LayerOf<'perspective-grid'>;
  return shell(
    current.effectId,
    runtime,
    <span
      className="shell-effect-perspective-grid"
      style={{
        backgroundImage: `linear-gradient(${color(runtime, 0)} 1px,transparent 1px),linear-gradient(90deg,${color(runtime, 1)} 1px,transparent 1px)`,
        backgroundSize: `${current.config.spacing}px ${current.config.spacing}px`,
        perspective: `${current.config.perspective}px`,
        transformOrigin: `50% ${current.config.horizon}%`,
      }}
    />,
    variables(current, runtime),
  );
}

export function FloatingGeometryEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'floating-geometry') return null;
  const current = layer as LayerOf<'floating-geometry'>;
  const points = createSeededPoints(current.seed, current.config.shapes);
  return shell(
    current.effectId,
    runtime,
    points.map((point, index) => (
      <span
        key={index}
        className={`shell-effect-geometry shell-effect-geometry--${index % 3}`}
        style={{
          left: `${point.x}%`,
          top: `${point.y}%`,
          width: `${8 + point.size * 12}px`,
          height: `${8 + point.size * 12}px`,
          borderColor: color(runtime, index),
          transform: `rotate(${point.rotation}deg)`,
          animationDelay: `${point.phase}s`,
          animationDuration: `${20 - current.config.drift / 8}s`,
        }}
      />
    )),
    variables(current, runtime, {
      animationDuration: `${20 - current.config.rotation / 8}s`,
    }),
  );
}

export function ImageDepthPanEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'image-depth-pan') return null;
  const current = layer as LayerOf<'image-depth-pan'>;
  const progress = runtime.fallback === 'runtime' ? runtime.progress : 0.5;
  const offset = (progress - 0.5) * current.config.pan;
  return shell(
    current.effectId,
    runtime,
    null,
    variables(current, runtime, {
      backgroundImage: `url("${current.config.assetRef}")`,
      backgroundPosition: `${current.config.focalX + offset / 10}% ${current.config.focalY + offset / 10}%`,
      backgroundSize: `${current.config.zoom}%`,
    }),
  );
}

function ParallaxLayers({
  count,
  depth,
  range,
  axis,
  layer,
  runtime,
}: {
  count: number;
  depth: number;
  range: number;
  axis: 'x' | 'y' | 'both';
  layer: ShellEffectLayerConfig;
  runtime: ShellEffectRuntimeContext;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const factor = ((index + 1) / count) * depth;
        const sourceX =
          layer.effectId === 'pointer-parallax' ? runtime.pointer.x - 0.5 : runtime.progress - 0.5;
        const sourceY =
          layer.effectId === 'pointer-parallax' ? runtime.pointer.y - 0.5 : runtime.progress - 0.5;
        const x = axis === 'y' ? 0 : sourceX * range * factor;
        const y = axis === 'x' ? 0 : sourceY * range * factor;
        return (
          <span
            key={index}
            className="shell-effect-parallax-layer"
            style={{
              inset: `${8 + index * 5}%`,
              borderColor: color(runtime, index),
              transform: `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${index * 12}deg)`,
            }}
          />
        );
      })}
    </>
  );
}

export function ScrollParallaxEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'scroll-parallax') return null;
  const current = layer as LayerOf<'scroll-parallax'>;
  return shell(
    current.effectId,
    runtime,
    <ParallaxLayers
      count={current.config.layers}
      depth={current.config.depth}
      range={current.config.range}
      axis={current.config.axis}
      layer={current}
      runtime={runtime}
    />,
    variables(current, runtime),
  );
}

export function PointerParallaxEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'pointer-parallax') return null;
  const current = layer as LayerOf<'pointer-parallax'>;
  return shell(
    current.effectId,
    runtime,
    <ParallaxLayers
      count={current.config.layers}
      depth={current.config.depth}
      range={current.config.range}
      axis="both"
      layer={current}
      runtime={runtime}
    />,
    variables(current, runtime, { transitionDuration: `${current.config.lag * 5}ms` }),
  );
}

export function CursorSpotlightEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'cursor-spotlight') return null;
  const current = layer as LayerOf<'cursor-spotlight'>;
  const x = runtime.fallback === 'runtime' ? runtime.pointer.x * 100 : 50;
  const y = runtime.fallback === 'runtime' ? runtime.pointer.y * 100 : 50;
  return shell(
    current.effectId,
    runtime,
    null,
    variables(current, runtime, {
      backgroundImage: `radial-gradient(circle ${current.config.radius}px at ${x}% ${y}%,${color(runtime, 0)},transparent ${Math.max(10, 100 - current.config.softness)}%)`,
      transitionDuration: `${current.config.lag * 5}ms`,
    }),
  );
}

export function SectionRevealEffect({ layer, runtime }: ShellEffectRendererProps) {
  if (layer.effectId !== 'section-reveal') return null;
  const current = layer as LayerOf<'section-reveal'>;
  const immediate = runtime.fallback !== 'runtime';
  return shell(
    current.effectId,
    runtime,
    <span
      className={`shell-effect-reveal shell-effect-reveal--${current.config.style}`}
      style={
        {
          '--se-reveal-distance': `${immediate ? 0 : current.config.distance}px`,
          '--se-reveal-stagger': `${immediate ? 0 : current.config.stagger}ms`,
          opacity: immediate ? 0 : undefined,
          background: color(runtime, 0),
        } as CSSProperties
      }
    />,
    variables(current, runtime),
  );
}

export const SHELL_EFFECT_RENDERERS: Readonly<
  Record<ShellEffectLayerConfig['effectId'], React.ComponentType<ShellEffectRendererProps>>
> = {
  'animated-gradient': AnimatedGradientEffect,
  'mesh-gradient': MeshGradientEffect,
  aurora: AuroraEffect,
  'gradient-orbs': GradientOrbsEffect,
  'floating-blobs': FloatingBlobsEffect,
  'flowing-waves': FlowingWavesEffect,
  'light-rays': LightRaysEffect,
  'conic-rays': ConicRaysEffect,
  'shimmer-bands': ShimmerBandsEffect,
  'film-grain': FilmGrainEffect,
  'particle-field': ParticleFieldEffect,
  starfield: StarfieldEffect,
  'animated-dot-field': AnimatedDotFieldEffect,
  'perspective-grid': PerspectiveGridEffect,
  'floating-geometry': FloatingGeometryEffect,
  'image-depth-pan': ImageDepthPanEffect,
  'scroll-parallax': ScrollParallaxEffect,
  'pointer-parallax': PointerParallaxEffect,
  'cursor-spotlight': CursorSpotlightEffect,
  'section-reveal': SectionRevealEffect,
};

