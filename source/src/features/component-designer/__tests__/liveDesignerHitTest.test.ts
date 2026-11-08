// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  hitTestLiveDesignerNode,
  liveDesignerOutlineNodeExists,
  measureLiveDesignerNodeHost,
  readLiveDesignerNodeHit,
} from '../components/live-designer/liveDesignerHitTest';

function fakeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  };
}

describe('liveDesignerHitTest', () => {
  it('reads the nearest annotated ancestor', () => {
    const root = document.createElement('div');
    const outer = document.createElement('span');
    outer.setAttribute('data-designer-node-id', 'outer');
    outer.setAttribute('data-designer-node-type', 'layout.stack');
    outer.style.display = 'contents';

    const inner = document.createElement('span');
    inner.setAttribute('data-designer-node-id', 'inner');
    inner.setAttribute('data-designer-node-type', 'heroui.button');
    inner.style.display = 'contents';

    const button = document.createElement('button');
    button.textContent = 'Save';

    inner.appendChild(button);
    outer.appendChild(inner);
    root.appendChild(outer);
    document.body.appendChild(root);

    const hit = readLiveDesignerNodeHit(button);
    expect(hit?.nodeId).toBe('inner');
    expect(hit?.nodeType).toBe('heroui.button');

    root.remove();
  });

  it('measures non-contents hosts relative to a surface', () => {
    const surface = document.createElement('div');
    surface.style.position = 'relative';
    surface.getBoundingClientRect = () => ({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 210,
      bottom: 220,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    const host = document.createElement('div');
    host.setAttribute('data-designer-node-id', 'n1');
    host.getBoundingClientRect = () => ({
      x: 30,
      y: 50,
      left: 30,
      top: 50,
      right: 130,
      bottom: 90,
      width: 100,
      height: 40,
      toJSON: () => ({}),
    });

    surface.appendChild(host);
    document.body.appendChild(surface);

    expect(measureLiveDesignerNodeHost(host, surface)).toEqual({
      left: 20,
      top: 30,
      width: 100,
      height: 40,
    });

    surface.remove();
  });

  describe('hitTestLiveDesignerNode', () => {
    const originalElementFromPoint = document.elementFromPoint;
    const originalElementsFromPoint = document.elementsFromPoint;

    afterEach(() => {
      document.elementFromPoint = originalElementFromPoint;
      document.elementsFromPoint = originalElementsFromPoint;
    });

    it('selects a node under an inspect-mode pointer-events-none preview host', () => {
      const surface = document.createElement('div');
      const host = document.createElement('div');
      host.setAttribute('data-designer-hit-root', 'true');
      host.style.pointerEvents = 'none';

      const node = document.createElement('button');
      node.setAttribute('data-designer-node-id', 'btn-1');
      node.setAttribute('data-designer-node-type', 'heroui.button');
      node.getBoundingClientRect = () => fakeRect(10, 10, 100, 40);

      const overlay = document.createElement('div');
      overlay.style.pointerEvents = 'auto';

      host.appendChild(node);
      surface.appendChild(host);
      surface.appendChild(overlay);
      document.body.appendChild(surface);

      document.elementsFromPoint = () => {
        if (host.style.pointerEvents === 'auto' && overlay.style.pointerEvents === 'none') {
          return [node];
        }
        return [overlay];
      };
      document.elementFromPoint = () => document.elementsFromPoint(0, 0)[0] ?? null;

      const hit = hitTestLiveDesignerNode(20, 20, overlay);
      expect(hit?.nodeId).toBe('btn-1');
      expect(hit?.nodeType).toBe('heroui.button');
      expect(host.style.pointerEvents).toBe('none');
      expect(overlay.style.pointerEvents).toBe('auto');

      surface.remove();
    });

    it('falls back to geometry when stacking sample still misses the preview tree', () => {
      const surface = document.createElement('div');
      const host = document.createElement('div');
      host.setAttribute('data-designer-hit-root', 'true');
      host.style.pointerEvents = 'none';

      const outer = document.createElement('div');
      outer.setAttribute('data-designer-node-id', 'outer');
      outer.setAttribute('data-designer-node-type', 'layout.stack');
      outer.getBoundingClientRect = () => fakeRect(0, 0, 400, 300);

      const inner = document.createElement('div');
      inner.setAttribute('data-designer-node-id', 'inner');
      inner.setAttribute('data-designer-node-type', 'heroui.button');
      inner.getBoundingClientRect = () => fakeRect(20, 20, 80, 32);

      const overlay = document.createElement('div');
      overlay.style.pointerEvents = 'auto';

      outer.appendChild(inner);
      host.appendChild(outer);
      surface.appendChild(host);
      surface.appendChild(overlay);
      document.body.appendChild(surface);

      document.elementsFromPoint = () => [overlay];
      document.elementFromPoint = () => overlay;

      const hit = hitTestLiveDesignerNode(40, 30, overlay);
      expect(hit?.nodeId).toBe('inner');
      expect(host.style.pointerEvents).toBe('none');

      surface.remove();
    });
  });

  it('treats missing document nodes as dead outlines', () => {
    expect(liveDesignerOutlineNodeExists('child', { child: { id: 'child' } })).toBe(true);
    expect(liveDesignerOutlineNodeExists('child', {})).toBe(false);
    expect(liveDesignerOutlineNodeExists(null, { child: { id: 'child' } })).toBe(false);
  });
});
