import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useOptionalCulture } from '../../../../core/culture/CultureContext';
import { cn } from '../../../../lib/utils';
import { AppButton } from '../../AppButton';
import { NativeButton } from '../../NativeButton';
import {
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_CANCEL_CLASS,
  ICON_ACTION_CONFIRM_CLASS,
  ICON_ACTION_EDIT_CLASS,
  ICON_ACTION_VIEW_CLASS,
  SHADOW_FLOATING,
} from '../../surfaceClasses';
import { AppendooCompanionFace } from '../appendooCompanion/AppendooCompanionFace';
import type { AppendooCompanionFace as CompanionFace } from '../appendooCompanion/appendooCompanion.types';
import { APPENDOO_SHAPE_IDS, type AppendooShapeId } from '../appendooCompanion/appendooBodyShape';
import { PAGE_GUIDE_IGNORE_ATTR } from './pageGuide.attrs';
import { collectPageGuideStops, filterPageGuideStopsByTopic, pageGuideTopicAvailability } from './collectPageGuideStops';
import { PageGuideChooser, type PageGuideChooserCopy } from './PageGuideChooser';
import {
  PAGE_GUIDE_AUTOPLAY_MS,
  type PageGuidePoint,
  type PageGuideRect,
  type PageGuideStop,
  type PageGuideTopic,
} from './pageGuide.types';
import {
  clampPageGuideHotspot,
  pointPageGuideAnchor,
  resolvePageGuideCenterCluster,
  resolvePageGuideSpeechCluster,
  stackPageGuideBubbleAboveHead,
} from './resolvePageGuidePlacement';
import { usePageGuideCompanionDrag } from './usePageGuideCompanionDrag';
import { usePageGuideCompanionIdle } from './usePageGuideCompanionIdle';
import { usePageGuideContentReady } from './usePageGuideContentReady';
import { pageGuideTravelDistance } from './pageGuideTravel';
import { usePageGuideTravel } from './usePageGuideTravel';
import { revealPageGuideGroup, resolvePageGuideGroupRoot } from './pageGuideReveal';
import './pageGuide.css';

export type PageGuideCopy = {
  closeAria: string;
  next: string;
  previous: string;
  playAria: string;
  pauseAria: string;
  done: string;
  step: (current: number, total: number) => string;
  emptyTitle: string;
  emptyHint: string;
  changeShapeAria: string;
  chooser: PageGuideChooserCopy;
};

export type PageGuideOverlayProps = {
  copy: PageGuideCopy;
  pathname: string;
  onClose: () => void;
};

const reducedMotionPreferred = (): boolean => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

const isRtlDocument = (): boolean => (
  typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
);

const fallbackAnchor = (): PageGuideRect => (
  pointPageGuideAnchor({
    x: window.innerWidth / 2 - 8,
    y: window.innerHeight / 2 - 8,
    width: 16,
    height: 16,
  })
);

const measureAnchor = (element: HTMLElement): PageGuideRect => {
  try {
    return pointPageGuideAnchor(element.getBoundingClientRect());
  } catch {
    return fallbackAnchor();
  }
};

const collectStopsSafely = (): PageGuideStop[] => {
  try {
    return collectPageGuideStops();
  } catch {
    return [];
  }
};

const formatPageGuideStep = (copy: PageGuideCopy, current: number, total: number): string => {
  try {
    const label = copy.step?.(current, total);
    return typeof label === 'string' && label.trim() ? label : `${current} / ${total}`;
  } catch {
    return `${current} / ${total}`;
  }
};

const PAGE_GUIDE_ICON_BUTTON_CLASS = cn(
  ICON_ACTION_BUTTON_BASE_CLASS,
  'h-7 w-7 shrink-0 border-0 bg-transparent p-0 min-h-0 min-w-0',
);

const PAGE_GUIDE_BODY_SHAPES = APPENDOO_SHAPE_IDS.filter(
  (shape): shape is AppendooShapeId => shape !== 'none',
);

const nextPageGuideBodyShape = (current: AppendooShapeId): AppendooShapeId => {
  const index = PAGE_GUIDE_BODY_SHAPES.indexOf(current);
  return PAGE_GUIDE_BODY_SHAPES[(index + 1) % PAGE_GUIDE_BODY_SHAPES.length] ?? 'peach';
};

export const PageGuideOverlay: React.FC<PageGuideOverlayProps> = ({
  copy,
  pathname,
  onClose,
}) => {
  const culture = useOptionalCulture();
  const direction = culture?.direction ?? (isRtlDocument() ? 'rtl' : 'ltr');
  const isRtl = direction === 'rtl';
  const [stops, setStops] = useState<PageGuideStop[]>(() => collectStopsSafely());
  const [topic, setTopic] = useState<PageGuideTopic | null>(null);
  const [index, setIndex] = useState(0);
  const [anchor, setAnchor] = useState<PageGuideRect | null>(null);
  const [landing, setLanding] = useState(false);
  const [awaitingPage, setAwaitingPage] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [shape, setShape] = useState<AppendooShapeId>('peach');
  const pathnameRef = useRef(pathname);
  const frozenCompanionRef = useRef<PageGuidePoint | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleSize, setBubbleSize] = useState({ width: 288, height: 148 });
  const reducedMotion = reducedMotionPreferred();
  const pageReady = usePageGuideContentReady(pathname, awaitingPage);

  const refreshStops = useCallback(() => {
    setStops(collectStopsSafely());
  }, []);

  useLayoutEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    setAwaitingPage(true);
  }, [pathname]);

  useLayoutEffect(() => {
    if (awaitingPage) return;
    refreshStops();
  }, [awaitingPage, refreshStops]);

  useLayoutEffect(() => {
    if (!awaitingPage || !pageReady) return;
    setStops(collectStopsSafely());
    setIndex(0);
    setAwaitingPage(false);
  }, [awaitingPage, pageReady]);

  const choosing = topic == null;
  const visibleStops = useMemo(
    () => (topic ? filterPageGuideStopsByTopic(stops, topic) : []),
    [stops, topic],
  );
  const available = useMemo(() => pageGuideTopicAvailability(stops), [stops]);
  const total = visibleStops.length;
  const stop = visibleStops[index] ?? null;

  useLayoutEffect(() => {
    if (awaitingPage) return;
    if (choosing || !stop) {
      setAnchor(fallbackAnchor());
      return;
    }
    if (typeof stop.element.scrollIntoView === 'function') {
      try {
        stop.element.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: 'auto',
        });
      } catch {
        // Detached or non-scrollable nodes must not crash the tour.
      }
    }
    setAnchor(measureAnchor(stop.element));
  }, [awaitingPage, choosing, stop]);

  useLayoutEffect(() => {
    if (awaitingPage || choosing || !stop) return;
    if (!revealPageGuideGroup(stop.element)) return undefined;
    let cancelled = false;
    const refresh = () => {
      if (!cancelled) setStops(collectStopsSafely());
    };
    const root = resolvePageGuideGroupRoot(stop.element)
      ?? stop.element.parentElement
      ?? document.body;
    const observer = new MutationObserver(refresh);
    try {
      observer.observe(root, { childList: true, subtree: true });
    } catch {
      observer.disconnect();
    }
    const timer = window.setTimeout(() => {
      refresh();
      observer.disconnect();
    }, 160);
    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [awaitingPage, choosing, stop]);

  useEffect(() => {
    const onViewport = () => {
      if (awaitingPage || choosing || !stop) return;
      setAnchor(measureAnchor(stop.element));
    };
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
    return () => {
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, [awaitingPage, choosing, stop]);

  const companionTarget = useMemo<PageGuidePoint | null>(() => {
    if (awaitingPage) return frozenCompanionRef.current;
    if (choosing) {
      return resolvePageGuideCenterCluster(
        bubbleSize.width,
        bubbleSize.height,
        window.innerWidth,
        window.innerHeight,
      ).companion;
    }
    if (!anchor) return null;
    return resolvePageGuideSpeechCluster(
      anchor,
      bubbleSize.width,
      bubbleSize.height,
      window.innerWidth,
      window.innerHeight,
      isRtl,
    ).companion;
  }, [anchor, awaitingPage, bubbleSize.height, bubbleSize.width, choosing, isRtl]);

  const originRef = useRef<PageGuidePoint>({ x: 24, y: 24 });
  const snapToRef = useRef<(point: PageGuidePoint) => void>(() => {});
  const retargetRef = useRef<() => void>(() => {});
  const [homing, setHoming] = useState(false);
  const drag = usePageGuideCompanionDrag(originRef, useCallback((drop: PageGuidePoint) => {
    snapToRef.current(drop);
    setHoming(true);
    retargetRef.current();
  }, []));
  const { point: companionPoint, traveling, snapTo, retarget } = usePageGuideTravel(
    drag.dragging ? null : companionTarget,
  );
  snapToRef.current = snapTo;
  retargetRef.current = retarget;

  const displayCompanion = drag.held ?? companionPoint;
  originRef.current = displayCompanion;
  if (!awaitingPage) {
    frozenCompanionRef.current = displayCompanion;
  }

  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const restSpeech = stackPageGuideBubbleAboveHead(
    companionTarget ?? displayCompanion,
    bubbleSize.width,
    bubbleSize.height,
    viewportWidth,
    viewportHeight,
  );
  const followSpeech = stackPageGuideBubbleAboveHead(
    displayCompanion,
    bubbleSize.width,
    bubbleSize.height,
    viewportWidth,
    viewportHeight,
  );
  const yanked = drag.dragging || (
    homing
    && companionTarget != null
    && pageGuideTravelDistance(displayCompanion, companionTarget) >= 8
  );
  const speech = yanked ? restSpeech : followSpeech;

  useEffect(() => {
    if (!homing) return;
    if (!companionTarget || pageGuideTravelDistance(displayCompanion, companionTarget) < 8) {
      setHoming(false);
    }
  }, [companionTarget, displayCompanion, homing]);

  useEffect(() => {
    if (awaitingPage || traveling || drag.dragging || homing) {
      setLanding(false);
      return undefined;
    }
    setLanding(true);
    const timer = window.setTimeout(() => setLanding(false), 760);
    return () => window.clearTimeout(timer);
  }, [awaitingPage, drag.dragging, homing, traveling, stop?.id, shape]);

  useLayoutEffect(() => {
    const node = bubbleRef.current;
    if (!node) return;
    setBubbleSize({ width: node.offsetWidth, height: node.offsetHeight });
  }, [stop?.id, stop?.hint, total, choosing]);

  const goTo = useCallback((nextIndex: number) => {
    if (total === 0) return;
    setIndex(((nextIndex % total) + total) % total);
  }, [total]);

  const chooseTopic = useCallback((next: PageGuideTopic) => {
    setTopic(next);
    setIndex(0);
    setPlaying(false);
  }, []);

  const returnToChooser = useCallback(() => {
    setTopic(null);
    setIndex(0);
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing || awaitingPage || choosing || total <= 1 || drag.dragging) return undefined;
    if (index >= total - 1) {
      setPlaying(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      goTo(index + 1);
    }, PAGE_GUIDE_AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [awaitingPage, choosing, drag.dragging, goTo, index, playing, total]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (choosing) return;
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        if (index >= total - 1 && total > 0) onClose();
        else goTo(index + 1);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (index === 0) returnToChooser();
        else goTo(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choosing, goTo, index, onClose, returnToChooser, total]);

  const title = choosing ? copy.chooser.title : (stop?.title ?? copy.emptyTitle);
  const hint = choosing ? copy.chooser.hint : (stop?.hint ?? copy.emptyHint);
  const isLast = !choosing && (total === 0 || index >= total - 1);
  const { look, pose, wonk } = usePageGuideCompanionIdle(
    displayCompanion,
    !reducedMotion && !drag.dragging,
  );
  const face: CompanionFace = drag.dragging
    ? 'grabbed'
    : awaitingPage || traveling
      ? 'curious'
      : landing
        ? 'happy'
        : 'thinking';
  const mess = (wonk - 1) / 9;
  const canPlay = !choosing && total > 1;
  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (!canPlay) return;
    if (isLast) goTo(0);
    setPlaying(true);
  };

  return createPortal(
    <div
      className={cn('page-guide-root', reducedMotion && 'is-reduced')}
      data-testid="page-guide-overlay"
      {...{ [PAGE_GUIDE_IGNORE_ATTR]: '' }}
    >
      {!awaitingPage && !choosing ? visibleStops.map((item, itemIndex) => {
        let rect: DOMRect;
        try {
          rect = item.element.getBoundingClientRect();
        } catch {
          return null;
        }
        const spot = clampPageGuideHotspot(
          { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          window.innerWidth,
          window.innerHeight,
        );
        return (
          <button
            key={`${item.id}-${itemIndex}`}
            type="button"
            className={cn('page-guide-hotspot', itemIndex === index && 'is-active')}
            style={{ left: spot.x, top: spot.y }}
            data-testid="page-guide-hotspot"
            aria-label={item.title}
            aria-current={itemIndex === index ? 'step' : undefined}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIndex(itemIndex);
            }}
          >
            <span className="page-guide-hotspot-dot" aria-hidden />
            {itemIndex === index ? (
              <>
                <span className="page-guide-hotspot-ping" aria-hidden />
                <span className="page-guide-hotspot-ping is-late" aria-hidden />
                <span className="page-guide-hotspot-ping is-later" aria-hidden />
              </>
            ) : null}
          </button>
        );
      }) : null}

      <button
        type="button"
        className={cn(
          'page-guide-companion',
          landing && !traveling && !drag.dragging && 'is-landing',
          (drag.dragging || homing) && 'is-dragging',
          reducedMotion && 'is-reduced',
        )}
        style={{
          left: displayCompanion.x,
          top: displayCompanion.y,
        }}
        data-testid="page-guide-companion"
        aria-label={copy.changeShapeAria}
        title={copy.changeShapeAria}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
        onClick={() => {
          if (drag.consumeClick()) return;
          setShape((current) => nextPageGuideBodyShape(current));
        }}
      >
        <div className="page-guide-companion-bob">
          <div
            className="page-guide-companion-fidget"
            style={{
              transform: `translate(${look.lookX * 6}px, ${look.lookY * 4}px) scale(${pose.scaleX * (1 + mess * 0.1)}, ${pose.scaleY * (1 - mess * 0.1)}) rotate(${pose.tilt + mess * look.lookX * 10}deg)`,
            }}
          >
            <AppendooCompanionFace
              face={face}
              pointerLook={look}
              body={{ shape, wonk, wonkScatter: wonk > 5.5 }}
            />
          </div>
        </div>
      </button>

      {!awaitingPage ? (
      <div
        ref={bubbleRef}
        dir={direction}
        lang={culture?.language}
        className={cn(
          'page-guide-bubble rounded-lg border border-slate-200 bg-white text-start',
          SHADOW_FLOATING,
          choosing && 'is-chooser',
        )}
        style={{ left: speech.bubble.x, top: speech.bubble.y }}
        role="dialog"
        aria-labelledby="page-guide-title"
        aria-describedby="page-guide-hint"
        data-testid={choosing ? 'page-guide-chooser' : 'page-guide-bubble'}
      >
        <div className="page-guide-bubble-tail" style={{ left: speech.tailOffset }} aria-hidden />
        <div className="flex items-start justify-between gap-2 px-3 pt-3">
          <div className="min-w-0">
            <p id="page-guide-title" className="text-sm font-semibold text-slate-900">
              {title}
            </p>
            {!choosing && total > 0 ? (
              <p className="mt-0.5 text-xs font-normal text-slate-500">
                {formatPageGuideStep(copy, index + 1, total)}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-start gap-0.5">
            <AppButton
              closeIcon
              className="h-7 w-7 shrink-0"
              aria-label={copy.closeAria}
              title={copy.closeAria}
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </AppButton>
          </div>
        </div>
        <p id="page-guide-hint" className="px-3 pt-2 text-xs font-normal leading-relaxed text-slate-600">
          {hint}
        </p>
        {choosing ? (
          <div className="px-3 pb-3 pt-2">
            <PageGuideChooser
              copy={copy.chooser}
              available={available}
              onChoose={chooseTopic}
            />
          </div>
        ) : (
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <span className="page-guide-play">
            {playing && canPlay && !isLast ? (
              <svg
                className="page-guide-play-ring"
                viewBox="0 0 32 32"
                aria-hidden
                data-testid="page-guide-play-ring"
              >
                <circle className="page-guide-play-ring-track" cx="16" cy="16" r="13" />
                <circle
                  key={`${index}-${Number(awaitingPage)}-${Number(drag.dragging)}`}
                  className="page-guide-play-ring-fill"
                  cx="16"
                  cy="16"
                  r="13"
                  pathLength={100}
                  style={{ animationDuration: `${PAGE_GUIDE_AUTOPLAY_MS}ms` }}
                />
              </svg>
            ) : null}
            <NativeButton
              className={cn(PAGE_GUIDE_ICON_BUTTON_CLASS, ICON_ACTION_VIEW_CLASS, playing && 'text-cyan-600')}
              aria-label={playing ? copy.pauseAria : copy.playAria}
              aria-pressed={playing}
              title={playing ? copy.pauseAria : copy.playAria}
              disabled={!canPlay}
              onClick={togglePlay}
            >
              {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            </NativeButton>
          </span>
          <div className="flex items-center gap-0.5">
            <NativeButton
              className={cn(PAGE_GUIDE_ICON_BUTTON_CLASS, ICON_ACTION_CANCEL_CLASS)}
              aria-label={copy.previous}
              title={copy.previous}
              onClick={() => {
                if (index === 0) returnToChooser();
                else goTo(index - 1);
              }}
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </NativeButton>
            <NativeButton
              className={cn(
                PAGE_GUIDE_ICON_BUTTON_CLASS,
                isLast ? ICON_ACTION_CONFIRM_CLASS : ICON_ACTION_EDIT_CLASS,
              )}
              aria-label={isLast ? copy.done : copy.next}
              title={isLast ? copy.done : copy.next}
              onClick={() => {
                if (isLast) onClose();
                else goTo(index + 1);
              }}
            >
              {isLast
                ? <Check className="h-4 w-4" aria-hidden />
                : <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />}
            </NativeButton>
          </div>
        </div>
        )}
      </div>
      ) : null}
    </div>,
    document.body,
  );
};
