type WorkspaceSplitDragFinish = () => void;

type WorkspaceSplitPointerDragOptions = {
  pointerId: number;
  captureElement: HTMLElement;
  onMove: (clientX: number, clientY: number) => void;
  onFinish: WorkspaceSplitDragFinish;
};

type WorkspaceSplitMouseDragOptions = {
  onMove: (clientX: number, clientY: number) => void;
  onFinish: WorkspaceSplitDragFinish;
};

function releasePointerCaptureSafe(element: HTMLElement, pointerId: number): void {
  try {
    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  } catch {
    // Element may be unmounted.
  }
}

export function beginWorkspaceSplitPointerDrag({
  pointerId,
  captureElement,
  onMove,
  onFinish,
}: WorkspaceSplitPointerDragOptions): void {
  try {
    captureElement.setPointerCapture(pointerId);
  } catch {
    // Ignore unsupported capture targets.
  }

  let finished = false;

  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;

    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    document.removeEventListener('pointercancel', handlePointerUp);
    captureElement.removeEventListener('lostpointercapture', handleLostCapture);
    releasePointerCaptureSafe(captureElement, pointerId);
    onFinish();
  };

  const handlePointerMove = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) {
      return;
    }
    onMove(moveEvent.clientX, moveEvent.clientY);
  };

  const handlePointerUp = (upEvent: PointerEvent) => {
    if (upEvent.pointerId !== pointerId) {
      return;
    }
    finish();
  };

  const handleLostCapture = (lostEvent: PointerEvent) => {
    if (lostEvent.pointerId !== pointerId) {
      return;
    }
    finish();
  };

  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);
  document.addEventListener('pointercancel', handlePointerUp);
  captureElement.addEventListener('lostpointercapture', handleLostCapture);
}

export function beginWorkspaceSplitMouseDrag({
  onMove,
  onFinish,
}: WorkspaceSplitMouseDragOptions): void {
  let finished = false;

  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    onFinish();
  };

  const handleMouseMove = (moveEvent: MouseEvent) => {
    onMove(moveEvent.clientX, moveEvent.clientY);
  };

  const handleMouseUp = () => {
    finish();
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}
