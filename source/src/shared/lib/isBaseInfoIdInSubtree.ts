/**
 * HID subtree check for Base Info ids (`100.4`, `100.4.1`, `100.4.3.2`, …).
 * A node is in the subtree when it is the root or its id is prefixed by `{rootId}.`.
 */
export function isBaseInfoIdInSubtree(rootId: string, nodeId: string): boolean {
  const root = String(rootId ?? '').trim();
  const id = String(nodeId ?? '').trim();
  if (!root || !id) return false;
  return id === root || id.startsWith(`${root}.`);
}
