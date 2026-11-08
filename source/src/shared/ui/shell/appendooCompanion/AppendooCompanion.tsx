import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../../../lib/utils';
import { AppendooCompanionFace } from './AppendooCompanionFace';
import {
  APPENDOO_COMPANION_COMPACT_SIZE_PX,
  APPENDOO_COMPANION_DRAG_THRESHOLD_PX,
  APPENDOO_COMPANION_SIZE_PX,
  type AppendooCompanionPosition,
} from './appendooCompanion.types';
import {
  clampCompanionPosition,
  isRtlDocument,
  persistCompanionPosition,
  resolveInitialCompanionPosition,
  resolveTuckSideFromDrop,
  tuckedCompanionPosition,
} from './appendooCompanionPosition';
import { useAppendooCompanionBehavior } from './useAppendooCompanionBehavior';
import './appendooCompanion.css';

export type AppendooCompanionProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  openAriaLabel: string;
  closeAriaLabel: string;
  untuckAriaLabel: string;
};

export const AppendooCompanion: React.FC<AppendooCompanionProps> = ({
  isOpen,
  onOpenChange,
  openAriaLabel,
  closeAriaLabel,
  untuckAriaLabel,
}) => {
  const rootRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const [position, setPosition] = useState<AppendooCompanionPosition>(() => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0, tucked: null };
    }
    return resolveInitialCompanionPosition(window.innerWidth, window.innerHeight, isRtlDocument());
  });
  const [dragged, setDragged] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dropping, setDropping] = useState(false);
  const { face, blinking, reducedMotion } = useAppendooCompanionBehavior(rootRef, dragged, hovered);

  useEffect(() => {
    const onResize = () => {
      setPosition((current) => {
        if (current.tucked) {
          const next = tuckedCompanionPosition(
            current.tucked,
            current.y,
            window.innerWidth,
            window.innerHeight,
          );
          persistCompanionPosition(next);
          return next;
        }
        const next = {
          ...clampCompanionPosition(current, window.innerWidth, window.innerHeight),
          tucked: null,
        };
        persistCompanionPosition(next);
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const commitPosition = useCallback((next: AppendooCompanionPosition) => {
    setPosition(next);
    persistCompanionPosition(next);
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const origin = position.tucked
      ? clampCompanionPosition(
          {
            x: event.clientX - APPENDOO_COMPANION_SIZE_PX / 2,
            y: event.clientY - APPENDOO_COMPANION_SIZE_PX / 2,
          },
          window.innerWidth,
          window.innerHeight,
        )
      : { x: position.x, y: position.y };
    if (position.tucked) {
      setPosition({ ...origin, tucked: null });
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < APPENDOO_COMPANION_DRAG_THRESHOLD_PX) {
      return;
    }

    drag.moved = true;
    if (!dragged) setDragged(true);
    setPosition({
      ...clampCompanionPosition(
        { x: drag.originX + dx, y: drag.originY + dy },
        window.innerWidth,
        window.innerHeight,
      ),
      tucked: null,
    });
  };

  const finishPointer = (event: React.PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (
      typeof event.currentTarget.hasPointerCapture === 'function'
      && event.currentTarget.hasPointerCapture(event.pointerId)
      && typeof event.currentTarget.releasePointerCapture === 'function'
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag.moved) {
      const nextPoint = clampCompanionPosition(
        {
          x: drag.originX + (event.clientX - drag.startX),
          y: drag.originY + (event.clientY - drag.startY),
        },
        window.innerWidth,
        window.innerHeight,
      );
      const tuck = resolveTuckSideFromDrop(nextPoint.x, window.innerWidth);
      const next = tuck
        ? tuckedCompanionPosition(tuck, nextPoint.y, window.innerWidth, window.innerHeight)
        : { ...nextPoint, tucked: null };
      commitPosition(next);
      setDragged(false);
      if (!reducedMotion) {
        setDropping(true);
        window.setTimeout(() => setDropping(false), 520);
      }
      return;
    }

    setDragged(false);
    if (cancelled) return;
    if (position.tucked) {
      commitPosition({
        ...clampCompanionPosition(
          { x: drag.originX, y: drag.originY },
          window.innerWidth,
          window.innerHeight,
        ),
        tucked: null,
      });
      return;
    }

    onOpenChange(!isOpen);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (position.tucked) {
      commitPosition({
        ...clampCompanionPosition(position, window.innerWidth, window.innerHeight),
        tucked: null,
      });
      return;
    }
    onOpenChange(!isOpen);
  };

  const ariaLabel = position.tucked
    ? untuckAriaLabel
    : (isOpen ? closeAriaLabel : openAriaLabel);

  return (
    <button
      ref={rootRef}
      type="button"
      data-testid="appendoo-companion"
      aria-label={ariaLabel}
      aria-pressed={isOpen}
      data-face={face}
      className={cn(
        'appendoo-companion',
        isOpen && 'is-panel-open',
        dragged && 'is-dragging',
        dropping && 'is-dropping',
        blinking && 'is-blinking',
        reducedMotion && 'is-reduced',
        position.tucked && 'is-tucked',
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: position.tucked ? undefined : (isOpen ? APPENDOO_COMPANION_COMPACT_SIZE_PX : APPENDOO_COMPANION_SIZE_PX),
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finishPointer(event, false)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onKeyDown={onKeyDown}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <AppendooCompanionFace face={face} blinking={blinking} />
    </button>
  );
};
