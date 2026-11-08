import React, { useEffect, useMemo, useRef, useState } from 'react';
import { VISUAL_ENGINE_CATALOG } from './catalog';
import { VisualEngineFallback } from './fallbacks';
import { loadVisualEngineRuntime } from './lazyRegistry';
import type {
  CanvasParticleSystemConfig,
  CanvasVectorFieldConfig,
  CreativeCapabilityInput,
  CreativeFallbackReason,
  CreativeSceneHostProps,
  EngineMount,
  ShaderAmbientFieldConfig,
  ShaderImageRevealConfig,
  ThreeDataConstellationConfig,
  ThreeModelOrbitConfig,
  ThreeProductStageConfig,
  ThreeSpatialGalleryConfig,
  VisualEngineComponentProps,
  VisualEngineConfig,
} from './types';
import { resolveCreativeSceneCapability, validateVisualEngineConfig } from './validation';

const contextLosses = new Map<string, number>();
export const SHELL_RUNTIME_TELEMETRY_EVENT = 'shell-runtime:telemetry';

type NavigatorCapabilities = Navigator & {
  connection?: { saveData?: boolean; effectiveType?: string };
  deviceMemory?: number;
};

function media(query: string): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches);
}

function emitRuntimeTelemetry(
  kind: 'engine-selection' | 'engine-admission' | 'engine-rejection' | 'engine-fallback'
    | 'webgl-context-failure' | 'webgl-context-loss' | 'webgl-context-restored',
  config: VisualEngineConfig,
  reason?: CreativeFallbackReason,
): void {
  if (typeof window === 'undefined') return;
  const metadata = VISUAL_ENGINE_CATALOG[config.engineId];
  window.dispatchEvent(new CustomEvent(SHELL_RUNTIME_TELEMETRY_EVENT, {
    detail: {
      kind,
      runtimeEngine: metadata.runtimeEngine,
      authoringTier: metadata.authoringTier,
      costTier: metadata.costTier,
      ...(reason ? { reason } : {}),
    },
  }));
}

function runtimeInput(
  config: VisualEngineConfig,
  viewport: NonNullable<CreativeSceneHostProps['viewport']>,
  visible: boolean,
  override: CreativeSceneHostProps['capabilityOverride'],
): CreativeCapabilityInput {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as NavigatorCapabilities);
  const meta = VISUAL_ENGINE_CATALOG[config.engineId];
  return {
    runtimeEngine: meta.runtimeEngine,
    costTier: meta.costTier,
    viewport,
    visible,
    documentHidden: typeof document !== 'undefined' && document.hidden,
    reducedMotion: media('(prefers-reduced-motion: reduce)'),
    forcedColors: media('(forced-colors: active)'),
    printing: media('print'),
    saveData: nav?.connection?.saveData,
    effectiveType: nav?.connection?.effectiveType,
    deviceMemory: nav?.deviceMemory,
    snapshot: typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent),
    dpr: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
    ...override,
  };
}

function SemanticOverlay({ config }: { config: VisualEngineConfig }) {
  if (config.engineId === 'three-product-stage' || config.engineId === 'three-model-orbit') {
    const entries = config.engineId === 'three-product-stage' ? config.callouts : config.annotations;
    return (
      <ul data-creative-semantic-overlay="">
        {entries.map((entry) => (
          <li key={entry.id} style={{ position: 'absolute', left: `${entry.x}%`, top: `${entry.y}%` }}>
            <strong>{entry.label}</strong>{entry.body && <span>{entry.body}</span>}
          </li>
        ))}
      </ul>
    );
  }
  if (config.engineId === 'three-spatial-gallery') {
    return <ol data-creative-semantic-overlay="">{config.images.map((image) => <li key={image.id}>{image.alt}</li>)}</ol>;
  }
  if (config.engineId === 'three-data-constellation') {
    return <ul data-creative-semantic-overlay="">{config.nodes.map((node) => <li key={node.id}>{node.label}: {node.value}</li>)}</ul>;
  }
  return null;
}

export function CreativeSceneHost({
  scenes,
  viewport = 'desktop',
  enabled = true,
  paused = false,
  className,
  style,
  semanticOverlay,
  capabilityOverride,
}: CreativeSceneHostProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountRef = useRef<EngineMount | null>(null);
  const [visible, setVisible] = useState(
    typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined',
  );
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [runtimeFailure, setRuntimeFailure] = useState<CreativeFallbackReason>();
  const validated = useMemo(
    () => scenes.map((config) => ({ config, result: validateVisualEngineConfig(config) })),
    [scenes],
  );
  const active = validated.find((entry) => entry.result.valid)?.config;
  const capability = useMemo(
    () =>
      active
        ? resolveCreativeSceneCapability(runtimeInput(active, viewport, visible, capabilityOverride))
        : { eligible: false, reason: 'invalid' as const, dpr: 1, maxBackingPixels: 0, maxTextureBytes: 0 },
    [active, viewport, visible, capabilityOverride, retry],
  );
  const lastDecisionTelemetry = useRef('');

  useEffect(() => {
    if (!active) return;
    const key = `${active.engineId}:${capability.eligible}:${capability.reason ?? 'eligible'}:${runtimeFailure ?? ''}`;
    if (lastDecisionTelemetry.current === key) return;
    lastDecisionTelemetry.current = key;
    emitRuntimeTelemetry('engine-selection', active);
    if (capability.eligible) emitRuntimeTelemetry('engine-admission', active);
    else {
      emitRuntimeTelemetry('engine-rejection', active, capability.reason);
      emitRuntimeTelemetry('engine-fallback', active, capability.reason);
    }
    if (runtimeFailure) emitRuntimeTelemetry('engine-fallback', active, runtimeFailure);
  }, [active, capability.eligible, capability.reason, runtimeFailure]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '80px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const refresh = () => setRetry((value) => value + 1);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('beforeprint', refresh);
    window.addEventListener('afterprint', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('beforeprint', refresh);
      window.removeEventListener('afterprint', refresh);
    };
  }, []);

  useEffect(() => {
    mountRef.current?.setPaused(paused || !visible || Boolean(capability.reason));
  }, [paused, visible, capability.reason]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (
      !active ||
      !canvas ||
      !host ||
      !enabled ||
      !capability.eligible ||
      runtimeFailure === 'context-lost'
    ) {
      mountRef.current?.dispose();
      mountRef.current = null;
      setRuntimeReady(false);
      return;
    }
    let cancelled = false;
    let timeout = 0;
    let idle = 0;
    const start = async () => {
      try {
        const runtime = await loadVisualEngineRuntime(active.engineId);
        if (cancelled) return;
        const mounted = runtime.mountVisualEngine({ canvas, config: active, capability, paused });
        if (!mounted) {
          setRuntimeFailure('webgl-unavailable');
          if (VISUAL_ENGINE_CATALOG[active.engineId].runtimeEngine === 'webgl-three') {
            emitRuntimeTelemetry('webgl-context-failure', active, 'webgl-unavailable');
          }
          return;
        }
        mountRef.current = mounted;
        const resize = () => {
          const rect = host.getBoundingClientRect();
          mounted.resize(rect.width, rect.height, capability.dpr);
        };
        resize();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
        observer?.observe(host);
        setRuntimeFailure(undefined);
        setRuntimeReady(true);
        return () => observer?.disconnect();
      } catch {
        if (!cancelled) {
          setRuntimeFailure('webgl-unavailable');
          if (VISUAL_ENGINE_CATALOG[active.engineId].runtimeEngine === 'webgl-three') {
            emitRuntimeTelemetry('webgl-context-failure', active, 'webgl-unavailable');
          }
        }
      }
    };
    let disconnect: void | (() => void);
    const launch = () => { void start().then((cleanup) => { disconnect = cleanup; }); };
    const scheduler = window as Window & {
      requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof scheduler.requestIdleCallback === 'function') {
      idle = scheduler.requestIdleCallback(launch, { timeout: 2_500 });
    } else {
      timeout = window.setTimeout(launch, 0);
    }
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (idle) scheduler.cancelIdleCallback?.(idle);
      if (typeof disconnect === 'function') disconnect();
      mountRef.current?.dispose();
      mountRef.current = null;
      setRuntimeReady(false);
    };
  }, [active, capability, enabled, paused, retry]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const lost = (event: Event) => {
      event.preventDefault();
      const count = (contextLosses.get(active.engineId) ?? 0) + 1;
      contextLosses.set(active.engineId, count);
      emitRuntimeTelemetry('webgl-context-loss', active, 'context-lost');
      mountRef.current?.dispose();
      mountRef.current = null;
      setRuntimeReady(false);
      if (count >= 2) setRuntimeFailure('context-lost');
      else setRetry((value) => value + 1);
    };
    const restored = () => emitRuntimeTelemetry('webgl-context-restored', active);
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, [active]);

  const reason = runtimeFailure ?? (!enabled ? 'budget' : capability.reason);
  return (
    <div
      ref={hostRef}
      className={className}
      style={{ position: 'relative', ...style }}
      data-creative-scene-host=""
      data-active-engine={active?.engineId}
      data-runtime-ready={runtimeReady || undefined}
      data-fallback-reason={!runtimeReady ? reason : undefined}
    >
      {validated.map(({ config, result }) =>
        config !== active || !runtimeReady ? (
          <VisualEngineFallback key={config.engineId} config={config} reason={result.valid ? reason : 'invalid'} />
        ) : null,
      )}
      {active && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          data-visual-engine-canvas={active.engineId}
          hidden={!runtimeReady}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
      )}
      {active && runtimeReady && <SemanticOverlay config={active} />}
      {semanticOverlay}
    </div>
  );
}

function single<Config extends VisualEngineConfig>(props: VisualEngineComponentProps<Config>) {
  const { config, ...host } = props;
  return <CreativeSceneHost {...host} scenes={[config]} />;
}

export const CanvasParticleSystem = (props: VisualEngineComponentProps<CanvasParticleSystemConfig>) => single(props);
export const CanvasVectorField = (props: VisualEngineComponentProps<CanvasVectorFieldConfig>) => single(props);
export const ThreeProductStage = (props: VisualEngineComponentProps<ThreeProductStageConfig>) => single(props);
export const ThreeModelOrbit = (props: VisualEngineComponentProps<ThreeModelOrbitConfig>) => single(props);
export const ThreeSpatialGallery = (props: VisualEngineComponentProps<ThreeSpatialGalleryConfig>) => single(props);
export const ThreeDataConstellation = (props: VisualEngineComponentProps<ThreeDataConstellationConfig>) => single(props);
export const ShaderImageReveal = (props: VisualEngineComponentProps<ShaderImageRevealConfig>) => single(props);
export const ShaderAmbientField = (props: VisualEngineComponentProps<ShaderAmbientFieldConfig>) => single(props);

export function resetCreativeSceneContextLossesForTests() {
  contextLosses.clear();
}
