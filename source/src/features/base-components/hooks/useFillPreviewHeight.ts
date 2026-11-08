import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures a fill-height preview host so pixel-height widgets (charts) can
 * actually occupy `h-full` instead of a fixed fallback.
 */
export function useFillPreviewHeight(enabled: boolean, fallback = 420): {
  hostRef: React.RefObject<HTMLDivElement | null>;
  height: number;
} {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(fallback);

  useLayoutEffect(() => {
    if (!enabled) {
      setHeight(fallback);
      return;
    }
    const node = hostRef.current;
    if (!node) return;
    const update = () => setHeight(Math.max(160, Math.round(node.clientHeight)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, fallback]);

  return { hostRef, height };
}
