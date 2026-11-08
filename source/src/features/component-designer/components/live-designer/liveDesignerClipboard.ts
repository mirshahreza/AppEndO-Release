import type { DesignerNode } from '../../../../domain/component-designer/types';
import { extractDesignerNodeSubtree } from '../../../../domain/component-designer/nodeSubtreeClone';

export const LIVE_DESIGNER_CLIPBOARD_MIME = 'application/x-appendo-live-designer-subtree+json';

export type LiveDesignerClipboardPayload = {
  version: 1;
  rootNodeId: string;
  nodes: Record<string, DesignerNode>;
};

let memoryClipboard: LiveDesignerClipboardPayload | null = null;

export function getLiveDesignerClipboard(): LiveDesignerClipboardPayload | null {
  return memoryClipboard;
}

export function setLiveDesignerClipboard(payload: LiveDesignerClipboardPayload | null): void {
  memoryClipboard = payload;
}

export function copyLiveDesignerSubtree(
  nodes: Record<string, DesignerNode>,
  nodeId: string,
): LiveDesignerClipboardPayload | null {
  const snapshot = extractDesignerNodeSubtree(nodes, nodeId);
  if (!snapshot) {
    return null;
  }

  const payload: LiveDesignerClipboardPayload = {
    version: 1,
    rootNodeId: snapshot.rootNodeId,
    nodes: snapshot.nodes,
  };
  setLiveDesignerClipboard(payload);

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(JSON.stringify(payload)).catch(() => {
      // Memory clipboard is enough for same-tab paste.
    });
  }

  return payload;
}

export function parseLiveDesignerClipboardText(raw: string): LiveDesignerClipboardPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LiveDesignerClipboardPayload>;
    if (
      parsed?.version !== 1
      || typeof parsed.rootNodeId !== 'string'
      || !parsed.rootNodeId
      || !parsed.nodes
      || typeof parsed.nodes !== 'object'
      || !parsed.nodes[parsed.rootNodeId]
    ) {
      return null;
    }
    return {
      version: 1,
      rootNodeId: parsed.rootNodeId,
      nodes: parsed.nodes as Record<string, DesignerNode>,
    };
  } catch {
    return null;
  }
}

export async function readLiveDesignerClipboard(): Promise<LiveDesignerClipboardPayload | null> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseLiveDesignerClipboardText(text);
      if (parsed) {
        setLiveDesignerClipboard(parsed);
        return parsed;
      }
    } catch {
      // Fall back to in-memory clipboard (permission denied / empty).
    }
  }
  return getLiveDesignerClipboard();
}
