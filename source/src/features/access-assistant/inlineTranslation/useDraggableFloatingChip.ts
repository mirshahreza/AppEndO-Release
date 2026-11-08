import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const CHIP_POSITION_STORAGE_KEY = 'appendo:inline-translation-chip-position';

type ChipPosition = {
  x: number;
  y: number;
};

const readStoredChipPosition = (): ChipPosition | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(CHIP_POSITION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as ChipPosition;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
};

const writeStoredChipPosition = (position: ChipPosition | null): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (!position) {
      window.sessionStorage.removeItem(CHIP_POSITION_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(CHIP_POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // ignore
  }
};

const clampChipPosition = (
  position: ChipPosition,
  chipWidth: number,
  chipHeight: number,
): ChipPosition => {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - chipWidth - margin);
  const maxY = Math.max(margin, window.innerHeight - chipHeight - margin);
  return {
    x: Math.min(maxX, Math.max(margin, position.x)),
    y: Math.min(maxY, Math.max(margin, position.y)),
  };
};

export function useDraggableFloatingChip(active: boolean) {
  const chipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<ChipPosition | null>(() => readStoredChipPosition());
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }
    if (position) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const chip = chipRef.current;
      if (!chip) {
        return;
      }
      const rect = chip.getBoundingClientRect();
      setPosition({
        x: rect.left,
        y: rect.top,
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [active, position]);

  const onDragHandlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const chip = chipRef.current;
    if (!chip) {
      return;
    }
    const rect = chip.getBoundingClientRect();
    const origin = position ?? { x: rect.left, y: rect.top };
    setPosition(origin);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [position]);

  const onDragHandlePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const chip = chipRef.current;
    const width = chip?.offsetWidth ?? 200;
    const height = chip?.offsetHeight ?? 40;
    const next = clampChipPosition({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    }, width, height);
    setPosition(next);
  }, []);

  const onDragHandlePointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const chip = chipRef.current;
    if (chip) {
      const rect = chip.getBoundingClientRect();
      const final = { x: rect.left, y: rect.top };
      setPosition(final);
      writeStoredChipPosition(final);
    }
  }, []);

  const chipStyle: CSSProperties = position
    ? { left: position.x, top: position.y, bottom: 'auto', transform: 'none' }
    : {
      left: '50%',
      bottom: '1rem',
      top: 'auto',
      transform: 'translateX(-50%)',
    };

  return {
    chipRef,
    chipStyle,
    onDragHandlePointerDown,
    onDragHandlePointerMove,
    onDragHandlePointerUp,
  };
}
