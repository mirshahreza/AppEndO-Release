export const LIVE_DESIGNER_NODE_ID_ATTR = 'data-designer-node-id';
export const LIVE_DESIGNER_NODE_TYPE_ATTR = 'data-designer-node-type';
/** Preview host that inspect mode may mark `pointer-events-none` (shell chrome guard). */
export const LIVE_DESIGNER_HIT_ROOT_ATTR = 'data-designer-hit-root';

export type LiveDesignerNodeHit = {
  nodeId: string;
  nodeType: string;
  host: Element;
};

export type LiveDesignerOutlineRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function isDisplayContents(element: Element): boolean {
  return getComputedStyle(element).display === 'contents';
}

function unionClientRects(rects: readonly DOMRectReadOnly[]): LiveDesignerOutlineRect | null {
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;
  let found = false;

  for (const rect of rects) {
    if (rect.width <= 0 && rect.height <= 0) {
      continue;
    }
    found = true;
    minLeft = Math.min(minLeft, rect.left);
    minTop = Math.min(minTop, rect.top);
    maxRight = Math.max(maxRight, rect.right);
    maxBottom = Math.max(maxBottom, rect.bottom);
  }

  if (!found) {
    return null;
  }

  return {
    left: minLeft,
    top: minTop,
    width: Math.max(0, maxRight - minLeft),
    height: Math.max(0, maxBottom - minTop),
  };
}

/** Collect box-generating descendants under a display:contents host. */
function collectBoxGeneratingRects(host: Element): DOMRectReadOnly[] {
  const rects: DOMRectReadOnly[] = [];

  const visit = (element: Element) => {
    if (isDisplayContents(element)) {
      Array.from(element.children).forEach(visit);
      return;
    }
    rects.push(element.getBoundingClientRect());
  };

  Array.from(host.children).forEach(visit);
  return rects;
}

function measureLiveDesignerNodeHostAbsolute(host: Element): LiveDesignerOutlineRect | null {
  if (isDisplayContents(host)) {
    return unionClientRects(collectBoxGeneratingRects(host));
  }

  const rect = host.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) {
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  return unionClientRects(collectBoxGeneratingRects(host));
}

export function measureLiveDesignerNodeHost(
  host: Element,
  relativeTo: Element,
): LiveDesignerOutlineRect | null {
  const relativeRect = relativeTo.getBoundingClientRect();
  const absolute = measureLiveDesignerNodeHostAbsolute(host);

  if (!absolute || (absolute.width <= 0 && absolute.height <= 0)) {
    return null;
  }

  return {
    left: absolute.left - relativeRect.left,
    top: absolute.top - relativeRect.top,
    width: absolute.width,
    height: absolute.height,
  };
}

function pointInRect(clientX: number, clientY: number, rect: LiveDesignerOutlineRect): boolean {
  return clientX >= rect.left
    && clientX <= rect.left + rect.width
    && clientY >= rect.top
    && clientY <= rect.top + rect.height;
}

function designerNodeDepth(host: Element): number {
  let depth = 0;
  let current: Element | null = host;
  while (current) {
    if (current.hasAttribute(LIVE_DESIGNER_NODE_ID_ATTR)) {
      depth += 1;
    }
    current = current.parentElement;
  }
  return depth;
}

function findLiveDesignerHitRoot(overlay: HTMLElement): HTMLElement | null {
  const surface = overlay.parentElement;
  if (!surface) {
    return null;
  }

  const marked = surface.querySelector(`[${LIVE_DESIGNER_HIT_ROOT_ATTR}]`);
  if (marked instanceof HTMLElement) {
    return marked;
  }

  const sibling = overlay.previousElementSibling;
  return sibling instanceof HTMLElement ? sibling : null;
}

function hitTestLiveDesignerNodeByGeometry(
  clientX: number,
  clientY: number,
  surface: Element,
): LiveDesignerNodeHit | null {
  const hosts = surface.querySelectorAll(`[${LIVE_DESIGNER_NODE_ID_ATTR}]`);
  let best: LiveDesignerNodeHit | null = null;
  let bestDepth = -1;
  let bestArea = Infinity;

  for (const host of hosts) {
    const rect = measureLiveDesignerNodeHostAbsolute(host);
    if (!rect || !pointInRect(clientX, clientY, rect)) {
      continue;
    }

    const depth = designerNodeDepth(host);
    const area = rect.width * rect.height;
    if (depth < bestDepth || (depth === bestDepth && area >= bestArea)) {
      continue;
    }

    const hit = readLiveDesignerNodeHit(host);
    if (!hit) {
      continue;
    }

    best = hit;
    bestDepth = depth;
    bestArea = area;
  }

  return best;
}

export function readLiveDesignerNodeHit(element: Element | null): LiveDesignerNodeHit | null {
  if (!element || !(element instanceof Element)) {
    return null;
  }

  const host = element.closest(`[${LIVE_DESIGNER_NODE_ID_ATTR}]`);
  if (!host) {
    return null;
  }

  const nodeId = host.getAttribute(LIVE_DESIGNER_NODE_ID_ATTR)?.trim() ?? '';
  if (!nodeId) {
    return null;
  }

  return {
    nodeId,
    nodeType: host.getAttribute(LIVE_DESIGNER_NODE_TYPE_ATTR)?.trim() ?? '',
    host,
  };
}

/**
 * Hit-test under the inspect overlay.
 *
 * Inspect mode sets `pointer-events-none` on the preview host so shell chrome
 * (sidebar z-40, menus) cannot steal clicks. `elementFromPoint` skips that
 * whole tree, so we briefly re-enable the hit root, then fall back to a
 * geometry scan of annotated nodes if the stacking sample still misses.
 */
export function hitTestLiveDesignerNode(
  clientX: number,
  clientY: number,
  overlay: HTMLElement,
): LiveDesignerNodeHit | null {
  const overlayPrevious = overlay.style.pointerEvents;
  overlay.style.pointerEvents = 'none';

  const hitRoot = findLiveDesignerHitRoot(overlay);
  const hitRootPrevious = hitRoot?.style.pointerEvents;
  if (hitRoot) {
    hitRoot.style.pointerEvents = 'auto';
  }

  try {
    const stack = typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)];

    for (const element of stack) {
      if (!(element instanceof Element)) {
        continue;
      }
      const hit = readLiveDesignerNodeHit(element);
      if (hit) {
        return hit;
      }
    }

    const surface = overlay.parentElement;
    return surface ? hitTestLiveDesignerNodeByGeometry(clientX, clientY, surface) : null;
  } finally {
    overlay.style.pointerEvents = overlayPrevious;
    if (hitRoot) {
      hitRoot.style.pointerEvents = hitRootPrevious ?? '';
    }
  }
}

export function liveDesignerOutlineNodeExists(
  nodeId: string | null | undefined,
  nodes: Record<string, unknown> | null | undefined,
): boolean {
  return Boolean(nodeId && nodes?.[nodeId]);
}
