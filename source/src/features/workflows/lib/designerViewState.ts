import type { DesignerViewState, DesignerViewport } from '../types';

export function normalizeDesignerViewport(value: unknown): DesignerViewport | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  const { x, y, zoom } = candidate;
  if (
    typeof x === 'number' && Number.isFinite(x)
    && typeof y === 'number' && Number.isFinite(y)
    && typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0
  ) {
    return { x, y, zoom };
  }
  return undefined;
}

export function parseDesignerView(viewJson: string | null | undefined): DesignerViewState {
  if (!viewJson) return { nodePositions: {} };
  try {
    const parsed = JSON.parse(viewJson) as Partial<DesignerViewState>;
    const viewport = normalizeDesignerViewport(parsed.viewport);
    return {
      nodePositions: parsed.nodePositions ?? {},
      ...(viewport ? { viewport } : {}),
    };
  } catch {
    return { nodePositions: {} };
  }
}

export function serializeDesignerView(view: DesignerViewState): string {
  const payload: DesignerViewState = { nodePositions: view.nodePositions };
  const viewport = normalizeDesignerViewport(view.viewport);
  if (viewport) {
    payload.viewport = viewport;
  }
  return JSON.stringify(payload);
}

/** Compares canonical designer-view JSON so load-time normalization (dropped invalid
 * viewport, key ordering) does not register as an author edit. */
export function isDesignerViewDirty(view: DesignerViewState, savedViewJson: string): boolean {
  return serializeDesignerView(view) !== serializeDesignerView(parseDesignerView(savedViewJson));
}
