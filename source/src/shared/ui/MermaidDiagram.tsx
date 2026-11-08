import React, { memo, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

export type MermaidDiagramProps = {
  chart: string;
  className?: string;
  /** Shown while the diagram library loads or renders. */
  loadingLabel?: string;
  ariaLabel?: string;
};

type MermaidModule = typeof import('mermaid').default;
type MermaidRenderResult = Awaited<ReturnType<MermaidModule['render']>>;

let mermaidModulePromise: Promise<MermaidModule> | null = null;
let mermaidInitialized = false;
let renderSequence = 0;
let renderChain: Promise<unknown> = Promise.resolve();

const renderedSvgCache = new Map<string, string>();

const loadMermaid = async (): Promise<MermaidModule> => {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((module) => module.default);
  }

  const mermaid = await mermaidModulePromise;
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeCSS: `
        .er.entityLabel,
        .er.entityLabel text,
        .er.entityLabel tspan {
          font-weight: 700 !important;
        }
      `,
      er: {
        useMaxWidth: true,
        diagramPadding: 12,
      },
    });
    mermaidInitialized = true;
  }

  return mermaid;
};

const queueMermaidRender = (
  mermaid: MermaidModule,
  renderId: string,
  chart: string,
): Promise<MermaidRenderResult> => {
  const run = () => mermaid.render(renderId, chart);
  const next = renderChain.then(run, run);
  renderChain = next.then(() => undefined, () => undefined);
  return next;
};

const revealDiagram = (onReveal: () => void) => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(onReveal);
  });
};

/** Warm the Mermaid bundle before the diagram panel mounts. */
export const preloadMermaid = (): Promise<MermaidModule> => loadMermaid();

const MermaidDiagramComponent: React.FC<MermaidDiagramProps> = ({
  chart,
  className,
  loadingLabel = 'Rendering…',
  ariaLabel = 'Diagram',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeChartRef = useRef('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const trimmedChart = chart.trim();

  const mountSvg = (svg: string, chartKey: string, bind?: (element: HTMLElement) => void) => {
    const container = containerRef.current;
    if (!container || activeChartRef.current !== chartKey) {
      return;
    }

    container.innerHTML = svg;
    bind?.(container);
    setIsVisible(false);
    revealDiagram(() => {
      if (activeChartRef.current !== chartKey) {
        return;
      }
      setIsRendering(false);
      setIsVisible(true);
    });
  };

  useEffect(() => {
    activeChartRef.current = trimmedChart;
    const container = containerRef.current;

    setError(null);
    setIsRendering(true);
    setIsVisible(false);

    if (!trimmedChart || !container) {
      if (container) {
        container.innerHTML = '';
      }
      setIsRendering(false);
      return;
    }

    container.innerHTML = '';
    let cancelled = false;

    const cachedSvg = renderedSvgCache.get(trimmedChart);
    if (cachedSvg) {
      mountSvg(cachedSvg, trimmedChart);
      return () => {
        cancelled = true;
      };
    }

    const render = async () => {
      try {
        const mermaid = await loadMermaid();
        if (cancelled || activeChartRef.current !== trimmedChart || !containerRef.current) {
          return;
        }

        if (containerRef.current.clientWidth === 0) {
          await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => resolve());
          });
        }

        if (cancelled || activeChartRef.current !== trimmedChart || !containerRef.current) {
          return;
        }

        const renderId = `mermaid-${++renderSequence}`;
        const result = await queueMermaidRender(mermaid, renderId, trimmedChart);

        if (cancelled || activeChartRef.current !== trimmedChart || !containerRef.current) {
          return;
        }

        renderedSvgCache.set(trimmedChart, result.svg);
        mountSvg(result.svg, trimmedChart, result.bindFunctions);
      } catch (cause) {
        if (!cancelled && activeChartRef.current === trimmedChart) {
          setError(cause instanceof Error ? cause.message : 'Failed to render diagram.');
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
          setIsRendering(false);
          setIsVisible(false);
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
    };
  }, [trimmedChart]);

  return (
    <div className={cn('relative grid min-h-[16rem]', className)}>
      {isRendering ? (
        <div
          className={cn(
            'col-start-1 row-start-1 z-10 flex min-h-[16rem] items-center justify-center bg-slate-50 transition-opacity duration-300 ease-out',
            isVisible ? 'pointer-events-none opacity-0' : 'opacity-100',
          )}
          aria-live="polite"
          aria-busy="true"
        >
          <p className="text-xs text-slate-500">{loadingLabel}</p>
        </div>
      ) : null}

      {error ? (
        <p className="col-start-1 row-start-1 px-3 py-2 text-xs text-rose-600">{error}</p>
      ) : null}

      <div
        ref={containerRef}
        className={cn(
          'col-start-1 row-start-1 overflow-auto p-3 transition-opacity duration-300 ease-out',
          '[&_svg_.entityLabel]:font-bold [&_svg_.entityLabel_text]:font-bold',
          '[&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full',
          isVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-label={ariaLabel}
        aria-hidden={!isVisible}
      />
    </div>
  );
};

export const MermaidDiagram = memo(MermaidDiagramComponent);
