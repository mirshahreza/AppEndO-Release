import type { Modifier } from '@dnd-kit/core';

const getEventCoordinates = (event: Event): { x: number; y: number } | null => {
  if ('touches' in event && event.touches.length > 0) {
    return {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  }

  if ('clientX' in event && 'clientY' in event) {
    const { clientX, clientY } = event;
    if (typeof clientX === 'number' && typeof clientY === 'number') {
      return { x: clientX, y: clientY };
    }
  }

  return null;
};

/** Keep the dragged overlay centered on the pointer (dnd-kit recommended for DragOverlay). */
export const snapCenterToCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  if (!draggingNodeRect || !activatorEvent) {
    return transform;
  }

  const activatorCoordinates = getEventCoordinates(activatorEvent);
  if (!activatorCoordinates) {
    return transform;
  }

  const offsetX = activatorCoordinates.x - draggingNodeRect.left;
  const offsetY = activatorCoordinates.y - draggingNodeRect.top;

  return {
    x: transform.x + offsetX - draggingNodeRect.width / 2,
    y: transform.y + offsetY - draggingNodeRect.height / 2,
  };
};
