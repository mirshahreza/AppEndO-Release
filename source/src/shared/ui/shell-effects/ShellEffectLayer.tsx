import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { DEFAULT_SHELL_EFFECT_PALETTE } from './catalog';
import { SHELL_EFFECT_RENDERERS } from './renderers';
import './shellEffects.css';
import type {
  ShellColorRef,
  ShellEffectFallback,
  ShellEffectLayerProps,
  ShellSemanticPalette,
} from './types';
import { resolveShellEffectFallback, validateShellEffectLayer } from './validation';

const OPACITY = { faint: 0.1, subtle: 0.18, visible: 0.32, strong: 0.5 } as const;
const BLEND = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  'soft-light': 'soft-light',
  overlay: 'overlay',
} as const;
const SAFE_HEX = /^#[0-9a-f]{6}$/i;

function customColor(color: Extract<ShellColorRef, { source: 'custom' }>): string {
  const { hex, alpha } = color.value;
  if (alpha === 1) return hex;
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function resolveShellEffectColors(
  refs: readonly ShellColorRef[],
  overrides: Partial<ShellSemanticPalette> = {},
): readonly string[] {
  return refs.map((ref) => {
    if (ref.source === 'custom') return customColor(ref);
    const override = overrides[ref.token];
    return override && SAFE_HEX.test(override)
      ? override
      : DEFAULT_SHELL_EFFECT_PALETTE[ref.token];
  });
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

function useEffectActivity(
  interaction: 'none' | 'scroll' | 'pointer',
  externallyPaused: boolean,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(
    typeof document !== 'undefined' ? document.hidden : false,
  );
  const [progress, setProgress] = useState(0.5);
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { rootMargin: '80px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const update = () => setDocumentHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const paused = externallyPaused || offscreen || documentHidden;

  useEffect(() => {
    if (paused || interaction === 'none' || typeof window === 'undefined') return;
    let frame = 0;
    if (interaction === 'pointer') {
      const update = (event: PointerEvent) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() =>
          setPointer({
            x: Math.max(0, Math.min(1, event.clientX / Math.max(1, window.innerWidth))),
            y: Math.max(0, Math.min(1, event.clientY / Math.max(1, window.innerHeight))),
          }),
        );
      };
      window.addEventListener('pointermove', update, { passive: true });
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('pointermove', update);
      };
    }
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        setProgress(Math.max(0, Math.min(1, window.scrollY / max)));
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
    };
  }, [interaction, paused]);

  return { ref, paused, progress, pointer };
}

export function ShellEffectLayer({
  layer,
  viewport = 'desktop',
  fallback = 'runtime',
  reducedMotionFallback,
  paused = false,
  semanticPalette,
  className,
  style,
}: ShellEffectLayerProps) {
  const validation = useMemo(() => validateShellEffectLayer(layer), [layer]);
  const reducedMotion = useReducedMotion();
  const effectiveFallback: ShellEffectFallback = validation.valid
    ? reducedMotion && fallback === 'runtime' && reducedMotionFallback
      ? reducedMotionFallback
      : resolveShellEffectFallback(layer, viewport, fallback, { reducedMotion })
    : 'hidden';
  const activity = useEffectActivity(
    effectiveFallback === 'runtime' ? layer.interaction : 'none',
    paused || effectiveFallback !== 'runtime',
  );
  const palette = useMemo(
    () => resolveShellEffectColors(layer.palette, semanticPalette),
    [layer.palette, semanticPalette],
  );

  if (effectiveFallback === 'hidden') return null;
  const Renderer = SHELL_EFFECT_RENDERERS[layer.effectId];
  const layerStyle = {
    '--shell-effect-opacity': OPACITY[layer.opacity],
    '--shell-effect-blend': BLEND[layer.blend],
    ...style,
  } as CSSProperties;

  return (
    <div
      ref={activity.ref}
      className={['shell-effect-layer', className].filter(Boolean).join(' ')}
      data-shell-effect-id={layer.effectId}
      data-layer-id={layer.id}
      data-target={layer.target}
      data-plane={layer.plane}
      data-paused={activity.paused || undefined}
      aria-hidden="true"
      style={layerStyle}
    >
      <Renderer
        layer={layer}
        runtime={{
          fallback: effectiveFallback,
          paused: activity.paused,
          palette,
          progress: activity.progress,
          pointer: activity.pointer,
        }}
      />
    </div>
  );
}

