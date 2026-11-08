import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Languages } from 'lucide-react';
import { takePendingInlineTranslationKeys } from '../../../core/culture/inlineTranslationCapture';
import { useCulture } from '../../../core/culture/CultureContext';
import type { PlatformCultureTranslationsResponse } from '../../../shared/api/contracts/platform/cultureTranslations';
import { usePlatformCultureTranslationsQuery } from '../../../shared/api/queries/platformCrud';
import { cn } from '../../../lib/utils';
import {
  collectInlineTranslationDomTargets,
  type InlineTranslationDomTarget,
} from './collectInlineTranslationDomTargets';
import { buildEffectiveCultureDraft } from './inlineTranslationCultureDraft';
import { InlineTranslationEditDialog } from './InlineTranslationEditDialog';
import { INLINE_TRANSLATION_LAYER_Z_CLASS } from './inlineTranslationDomMarkers';
import { INLINE_TRANSLATION_SCAN_ROOT_ATTR } from '../../../shared/ui/shell/inlineTranslationScanRoot';
import { resolveInlineTranslationContentRoot } from './resolveInlineTranslationContentRoot';
import {
  clearAllInlineTranslationLabelHighlights,
  setInlineTranslationLabelHighlight,
} from './inlineTranslationLabelHighlight';
import { resolveTranslationIconAnchor } from './resolveTranslationIconAnchor';
import { InlineTranslationModeChrome } from './InlineTranslationModeChrome';
import { useInlineTranslationInteractionLock } from './useInlineTranslationInteractionLock';
import { useInlineTranslationSave } from './useInlineTranslationSave';

export type InlineTranslationOverlayProps = {
  active: boolean;
  onFinish: () => void;
};

type AnchorTarget = InlineTranslationDomTarget & {
  targetId: string;
  top: number;
  left: number;
  translateClassName: string;
};

const measureTargets = (
  targets: InlineTranslationDomTarget[],
  elementTargetIds: WeakMap<HTMLElement, string>,
  shellDirection: 'ltr' | 'rtl',
): AnchorTarget[] => targets.map((target) => {
  let targetId = elementTargetIds.get(target.element);
  if (!targetId) {
    targetId = `it-${target.key}-${Math.random().toString(36).slice(2, 8)}`;
    elementTargetIds.set(target.element, targetId);
  }
  const anchor = resolveTranslationIconAnchor(target.element, shellDirection);
  return {
    ...target,
    targetId,
    top: anchor.top,
    left: anchor.left,
    translateClassName: anchor.translateClassName,
  };
});

const buildScanKeyMap = (
  cultureId: string,
  runtimeKeys: ReadonlyMap<string, string>,
  translationsData?: PlatformCultureTranslationsResponse,
): Map<string, string> => {
  const combined = new Map<string, string>();

  if (translationsData) {
    const effective = buildEffectiveCultureDraft(translationsData, cultureId);
    for (const [key, value] of Object.entries(effective)) {
      const trimmed = value.trim();
      if (trimmed) {
        combined.set(key, trimmed);
      }
    }
  }

  for (const [key, value] of runtimeKeys) {
    const trimmed = value.trim();
    if (trimmed) {
      combined.set(key, trimmed);
    }
  }

  return combined;
};

export const InlineTranslationOverlay: React.FC<InlineTranslationOverlayProps> = ({
  active,
  onFinish,
}) => {
  useInlineTranslationInteractionLock(active);
  const { cultureId, direction, ready } = useCulture();
  const translationsQuery = usePlatformCultureTranslationsQuery(active && ready);
  const saveTranslation = useInlineTranslationSave(cultureId);
  const [anchors, setAnchors] = useState<AnchorTarget[]>([]);
  const [editing, setEditing] = useState<{ key: string; currentValue: string } | null>(null);
  const keysSnapshotRef = useRef(new Map<string, string>());
  const elementTargetIdsRef = useRef(new WeakMap<HTMLElement, string>());
  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;

  const rescan = useCallback(() => {
    if (!active || !ready) {
      setAnchors([]);
      return;
    }

    const root = resolveInlineTranslationContentRoot();
    if (!root) {
      setAnchors([]);
      return;
    }

    const freshKeys = takePendingInlineTranslationKeys();
    if (freshKeys.size > 0) {
      for (const [key, value] of freshKeys) {
        keysSnapshotRef.current.set(key, value);
      }
    }

    const scanKeys = buildScanKeyMap(
      cultureId,
      keysSnapshotRef.current,
      translationsQuery.data,
    );
    const targets = collectInlineTranslationDomTargets(root, scanKeys);
    setAnchors(measureTargets(targets, elementTargetIdsRef.current, direction));
  }, [active, cultureId, direction, ready, translationsQuery.data]);

  useEffect(() => {
    if (!active) {
      keysSnapshotRef.current.clear();
      setAnchors([]);
    }
  }, [active]);

  useEffect(() => () => {
    clearAllInlineTranslationLabelHighlights(anchorsRef.current);
  }, []);

  useEffect(() => {
    keysSnapshotRef.current.clear();
    setAnchors([]);
  }, [cultureId]);

  useLayoutEffect(() => {
    rescan();
  }, [rescan, cultureId, ready]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(rescan);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [active, rescan]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const schedule = () => {
      window.requestAnimationFrame(rescan);
    };

    const root = resolveInlineTranslationContentRoot();
    const observers: MutationObserver[] = [];

    if (root) {
      const contentObserver = new MutationObserver(schedule);
      contentObserver.observe(root, { childList: true, subtree: true, characterData: true });
      observers.push(contentObserver);
    }

    const surfaceObserver = new MutationObserver(schedule);
    surfaceObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', INLINE_TRANSLATION_SCAN_ROOT_ATTR] });
    observers.push(surfaceObserver);

    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);

    return () => {
      for (const observer of observers) {
        observer.disconnect();
      }
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [active, rescan]);

  useEffect(() => {
    if (!active || !translationsQuery.isSuccess) {
      return;
    }
    rescan();
  }, [active, rescan, translationsQuery.isSuccess, translationsQuery.dataUpdatedAt]);

  const handleFinish = useCallback(() => {
    setEditing(null);
    onFinish();
  }, [onFinish]);

  const iconLayer = active && typeof document !== 'undefined'
    ? createPortal(
      <div
        data-inline-translation-layer
        className={cn('pointer-events-none fixed inset-0 overflow-visible', INLINE_TRANSLATION_LAYER_Z_CLASS)}
        aria-hidden={anchors.length === 0}
      >
        {anchors.map((anchor) => (
          <button
            key={anchor.targetId}
            type="button"
            className={cn(
              'pointer-events-auto fixed rounded-full border border-cyan-200 bg-white/95 p-0.5 text-cyan-700 shadow-sm backdrop-blur-[1px]',
              'hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-800',
              anchor.translateClassName,
            )}
            style={{
              top: anchor.top,
              left: anchor.left,
            }}
            title={`Edit translation: ${anchor.key}`}
            aria-label={`Edit translation for ${anchor.displayedText}`}
            onMouseEnter={() => {
              setInlineTranslationLabelHighlight(anchor.element, true);
            }}
            onMouseLeave={() => {
              setInlineTranslationLabelHighlight(anchor.element, false);
            }}
            onFocus={() => {
              setInlineTranslationLabelHighlight(anchor.element, true);
            }}
            onBlur={() => {
              setInlineTranslationLabelHighlight(anchor.element, false);
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setEditing({ key: anchor.key, currentValue: anchor.displayedText });
            }}
          >
            <Languages className="h-3 w-3" aria-hidden />
          </button>
        ))}
      </div>,
      document.body,
    )
    : null;

  const chromeLayer = active && typeof document !== 'undefined'
    ? createPortal(
      <div data-inline-translation-layer className="contents">
        <InlineTranslationModeChrome onFinish={handleFinish} />
        <InlineTranslationEditDialog
          open={Boolean(editing)}
          cultureKey={editing?.key ?? null}
          currentValue={editing?.currentValue ?? ''}
          onClose={() => setEditing(null)}
          onSave={async (nextValue) => {
            if (!editing) {
              return;
            }
            await saveTranslation(editing.key, nextValue);
            setEditing(null);
            window.requestAnimationFrame(rescan);
          }}
        />
      </div>,
      document.body,
    )
    : null;

  if (!active) {
    return null;
  }

  return (
    <>
      {chromeLayer}
      {iconLayer}
    </>
  );
};
