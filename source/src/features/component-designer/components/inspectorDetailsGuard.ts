import type { MouseEventHandler, PointerEventHandler } from 'react';

const stopInspectorDetailsToggle: MouseEventHandler<HTMLElement> & PointerEventHandler<HTMLElement> = (event) => {
  event.stopPropagation();
};

/** Prevents `<details>` sections from toggling when interacting with nested controls. */
export const preventInspectorDetailsToggle = {
  onMouseDown: stopInspectorDetailsToggle,
  onClick: stopInspectorDetailsToggle,
  onPointerDown: stopInspectorDetailsToggle,
};
