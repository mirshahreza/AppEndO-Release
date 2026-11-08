import type { PrismaClient } from '@prisma/client';

/**
 * Expand Base Info subtree ids under `nodeId` (inclusive).
 * Uses parentId walks; HID prefix is an optimization when ids are hierarchical.
 */
export const expandSubtreeIds = async (
  prisma: Pick<PrismaClient, 'baseInfo'>,
  nodeIds: readonly string[],
): Promise<string[]> => {
  const roots = [...new Set(nodeIds.map((id) => id.trim()).filter(Boolean))];
  if (roots.length === 0) {
    return [];
  }

  const result = new Set<string>(roots);
  let frontier = [...roots];

  while (frontier.length > 0) {
    const children = await prisma.baseInfo.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    const next: string[] = [];
    for (const child of children) {
      if (!result.has(child.id)) {
        result.add(child.id);
        next.push(child.id);
      }
    }
    frontier = next;
  }

  return [...result];
};
