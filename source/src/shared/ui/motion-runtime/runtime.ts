import * as React from 'react';
import { CREATIVE_MOTION_CATALOG } from './catalog';
import { useCreativeMotionHost } from './provider';
import { resolveCreativeMotion } from './resolver';
import type {
  CreativeMotionConfig,
  CreativeMotionDecision,
  CreativeMotionEnvironment,
} from './types';
import { validateCreativeMotionConfig } from './validation';

type MotionStyle = CSSStyleDeclaration & {
  viewTransitionName?: string;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

function duration(config: CreativeMotionConfig, fallback = 500): number {
  return 'durationMs' in config && typeof config.durationMs === 'number'
    ? config.durationMs
    : fallback;
}

function animate(
  node: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): () => void {
  if (typeof node.animate !== 'function') return () => undefined;
  const animation = node.animate(keyframes, { fill: 'both', easing, ...options });
  return () => animation.cancel();
}

function revealFrames(config: CreativeMotionConfig): Keyframe[] {
  switch (config.id) {
    case 'reveal-slide': {
      const distance = (config.distancePx ?? 28) * (config.direction ?? 1);
      const transform = config.axis === 'x'
        ? `translate3d(${distance}px,0,0)`
        : `translate3d(0,${distance}px,0)`;
      return [{ opacity: 0, transform }, { opacity: 1, transform: 'translate3d(0,0,0)' }];
    }
    case 'reveal-scale':
      return [
        { opacity: 0, transform: `scale(${config.fromScale ?? 0.94})` },
        { opacity: 1, transform: 'scale(1)' },
      ];
    case 'reveal-mask': {
      const initial = {
        top: 'inset(100% 0 0 0)',
        right: 'inset(0 100% 0 0)',
        bottom: 'inset(0 0 100% 0)',
        left: 'inset(0 0 0 100%)',
      }[config.direction ?? 'bottom'];
      return [{ clipPath: initial }, { clipPath: 'inset(0 0 0 0)' }];
    }
    default:
      return [{ opacity: 0 }, { opacity: 1 }];
  }
}

function elementProgress(node: HTMLElement): number {
  const rect = node.getBoundingClientRect();
  const viewportHeight = Math.max(1, window.innerHeight);
  return Math.max(0, Math.min(1, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
}

function scrollDriver(
  node: HTMLElement,
  update: (progress: number) => void,
): () => void {
  let frame = 0;
  const onScroll = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => update(elementProgress(node)));
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}

function applyFallback(node: HTMLElement, config: CreativeMotionConfig): void {
  node.style.removeProperty('opacity');
  node.style.removeProperty('transform');
  node.style.removeProperty('clip-path');
  node.style.removeProperty('position');
  node.style.removeProperty('top');
  node.style.setProperty('--creative-motion-progress', config.id === 'scroll-progress' ? '1' : '0');
  if (config.id === 'metric-count-up') node.textContent = config.to.toFixed(config.decimals ?? 0);
  if (config.id === 'hover-lift') node.dataset.motionDepthCue = 'true';
  if (config.id === 'scene-object-focus') {
    node.style.setProperty('--creative-motion-state', String(config.initialState ?? 0));
  }
}

function runBehavior(node: HTMLElement, config: CreativeMotionConfig): () => void {
  switch (config.id) {
    case 'reveal-fade':
    case 'reveal-slide':
    case 'reveal-scale':
    case 'reveal-mask':
      return animate(node, revealFrames(config), {
        duration: duration(config),
        delay: config.delayMs ?? 0,
      });
    case 'reveal-stagger': {
      const cleanups = Array.from(node.children)
        .slice(0, config.itemCount)
        .map((child, index) =>
          animate(child, [{ opacity: 0 }, { opacity: 1 }], {
            duration: duration(config),
            delay: (config.delayMs ?? 0) + index * (config.staggerMs ?? 70),
          }));
      return () => cleanups.forEach((cleanup) => cleanup());
    }
    case 'metric-count-up': {
      const started = performance.now();
      const from = config.from ?? 0;
      let frame = 0;
      const tick = (now: number) => {
        const progress = Math.min(1, (now - started) / duration(config, 900));
        const eased = 1 - (1 - progress) ** 3;
        node.textContent = (from + (config.to - from) * eased).toFixed(config.decimals ?? 0);
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      node.setAttribute('aria-label', config.to.toFixed(config.decimals ?? 0));
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }
    case 'hover-lift': {
      let cleanup = () => undefined;
      const lift = () => {
        cleanup();
        cleanup = animate(
          node,
          [{ transform: 'translateY(0)' }, { transform: `translateY(-${config.distancePx ?? 6}px)` }],
          { duration: duration(config, 180) },
        );
      };
      const reset = () => {
        cleanup();
        cleanup = animate(
          node,
          [{ transform: `translateY(-${config.distancePx ?? 6}px)` }, { transform: 'translateY(0)' }],
          { duration: duration(config, 180) },
        );
      };
      node.addEventListener('pointerenter', lift);
      node.addEventListener('pointerleave', reset);
      node.addEventListener('focusin', lift);
      node.addEventListener('focusout', reset);
      return () => {
        cleanup();
        node.removeEventListener('pointerenter', lift);
        node.removeEventListener('pointerleave', reset);
        node.removeEventListener('focusin', lift);
        node.removeEventListener('focusout', reset);
      };
    }
    case 'pointer-tilt':
    case 'pointer-attract': {
      let frame = 0;
      const move = (event: PointerEvent) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const rect = node.getBoundingClientRect();
          const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1));
          const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height) * 2 - 1));
          if (config.id === 'pointer-tilt') {
            const degrees = config.maxDegrees ?? 8;
            node.style.transform = `perspective(${config.perspectivePx ?? 800}px) rotateX(${-y * degrees}deg) rotateY(${x * degrees}deg)`;
          } else {
            const distance = config.maxDistancePx ?? 12;
            node.style.transform = `translate3d(${x * distance}px,${y * distance}px,0)`;
          }
        });
      };
      const reset = () => { node.style.transform = ''; };
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerleave', reset);
      node.addEventListener('blur', reset, true);
      return () => {
        cancelAnimationFrame(frame);
        reset();
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerleave', reset);
        node.removeEventListener('blur', reset, true);
      };
    }
    case 'track-marquee':
      return animate(
        node,
        [
          { transform: 'translate3d(0,0,0)' },
          { transform: `translate3d(${(config.direction ?? -1) * 50}%,0,0)` },
        ],
        { duration: duration(config, 16_000), iterations: Infinity, easing: 'linear' },
      );
    case 'scroll-progress':
      return scrollDriver(node, (progress) => {
        node.style.setProperty('--creative-motion-progress', String(progress));
        node.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
      });
    case 'scroll-parallax-layers':
      return scrollDriver(node, (progress) => {
        node.style.setProperty('--creative-motion-progress', String(progress));
        node.style.setProperty('--creative-motion-depth', `${(progress - 0.5) * (config.depthPx ?? 48)}px`);
      });
    case 'sticky-chapter':
      node.style.position = 'sticky';
      node.style.top = `${config.topPx ?? 0}px`;
      return () => {
        node.style.removeProperty('position');
        node.style.removeProperty('top');
      };
    case 'scene-scrub':
    case 'scene-camera-path':
      if (config.id === 'scene-camera-path' && config.mode === 'time') {
        return animate(node, [{ '--creative-motion-progress': 0 }, { '--creative-motion-progress': 1 }], {
          duration: duration(config, 12_000), iterations: Infinity, easing: 'linear',
        });
      }
      return scrollDriver(node, (progress) => {
        const start = config.id === 'scene-scrub' ? config.start ?? 0 : 0;
        const end = config.id === 'scene-scrub' ? config.end ?? 1 : 1;
        const projected = Math.max(0, Math.min(1, (progress - start) / (end - start)));
        node.style.setProperty('--creative-motion-progress', String(projected));
      });
    case 'scene-orbit':
      return animate(node, [{ '--creative-motion-progress': 0 }, { '--creative-motion-progress': 1 }], {
        duration: duration(config, 14_000), iterations: Infinity, easing: 'linear',
      });
    case 'scene-object-focus': {
      let state = config.initialState ?? 0;
      const update = () => {
        node.style.setProperty('--creative-motion-state', String(state));
        node.dataset.motionState = String(state);
      };
      const advance = () => {
        state = (state + 1) % config.stateCount;
        update();
      };
      update();
      node.addEventListener('click', advance);
      node.addEventListener('focusin', update);
      return () => {
        node.removeEventListener('click', advance);
        node.removeEventListener('focusin', update);
      };
    }
    case 'route-crossfade':
      return () => undefined;
  }
}

function useOffscreen(node: HTMLElement | null): boolean {
  const [offscreen, setOffscreen] = React.useState(false);
  React.useEffect(() => {
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { rootMargin: '100px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return offscreen;
}

export function useCreativeMotion(
  config: CreativeMotionConfig,
  onDecision?: (decision: CreativeMotionDecision) => void,
) {
  const [node, ref] = React.useState<HTMLElement | null>(null);
  const offscreen = useOffscreen(node);
  const host = useCreativeMotionHost();
  const decision = React.useMemo(
    () => resolveCreativeMotion(config.id, { ...host.environment, offscreen }),
    [config.id, host.environment, offscreen],
  );

  React.useEffect(() => onDecision?.(decision), [decision, onDecision]);
  React.useEffect(() => {
    if (!node) return;
    const validation = validateCreativeMotionConfig(config);
    node.dataset.creativeMotionId = config.id;
    node.dataset.creativeMotionMode = validation.valid ? decision.mode : 'fallback';
    node.dataset.creativeMotionReason = validation.valid ? decision.reason : 'invalid-config';
    node.dataset.creativeMotionPaused = decision.paused ? 'true' : 'false';
    const style = node.style as MotionStyle;
    style.viewTransitionName = config.id === 'route-crossfade' ? 'creative-route' : undefined;

    if (!validation.valid || decision.mode === 'fallback' || decision.paused) {
      applyFallback(node, config);
      return;
    }
    const cleanup = runBehavior(node, validation.config);
    const finishForFocus = () => {
      if (config.id.startsWith('reveal-')) node.getAnimations().forEach((item) => item.finish());
    };
    node.addEventListener('focusin', finishForFocus);
    return () => {
      cleanup();
      node.removeEventListener('focusin', finishForFocus);
      delete node.dataset.creativeMotionId;
      delete node.dataset.creativeMotionMode;
      delete node.dataset.creativeMotionReason;
      delete node.dataset.creativeMotionPaused;
    };
  }, [config, decision, node]);

  return { ref, decision, metadata: CREATIVE_MOTION_CATALOG[config.id] };
}

export function useRouteCrossfade(config: Extract<CreativeMotionConfig, { id: 'route-crossfade' }>) {
  const host = useCreativeMotionHost();
  const decision = resolveCreativeMotion(config.id, { ...host.environment, offscreen: false });
  return React.useCallback(
    (commitRoute: () => void) => {
      commitRoute();
      if (decision.mode === 'fallback' || decision.paused || typeof document === 'undefined') return;
      const viewDocument = document as ViewTransitionDocument;
      if (viewDocument.startViewTransition) {
        viewDocument.startViewTransition(() => undefined);
        return;
      }
      animate(document.documentElement, [{ opacity: 0.72 }, { opacity: 1 }], {
        duration: duration(config, 220),
      });
    },
    [config, decision.mode, decision.paused],
  );
}

export function resolveMotionEnvironment(
  environment: CreativeMotionEnvironment,
): CreativeMotionEnvironment {
  return Object.freeze({ ...environment });
}
