import type { PackageRepackChangedItem } from '../../../shared/api/contracts/package/repack';
import { PACKAGE_REPACK_CATEGORY_LABELS } from '../../../shared/api/contracts/package/repack';
import type { PackageRepackItemCategory } from '../../../shared/api/contracts/package/repack';

export type SuggestedRepackDescriptionInput = {
  version: string;
  changedItems: PackageRepackChangedItem[];
  addedApiLabels: string[];
  addedComponentLabels: string[];
  addedPortalLabels: string[];
  addedNavigationLabels: string[];
  addedWorkflowLabels: string[];
  hasInstallSql: boolean;
  removedApiLabels: string[];
  removedComponentLabels: string[];
  removedPortalLabels: string[];
  removedNavigationLabels: string[];
  removedWorkflowLabels: string[];
};

function formatBulletList(items: string[], maxItems = 12): string {
  if (items.length === 0) return '';
  const shown = items.slice(0, maxItems);
  const lines = shown.map((item) => `- ${item}`);
  if (items.length > maxItems) {
    lines.push(`- …and ${items.length - maxItems} more`);
  }
  return lines.join('\n');
}

function groupChangedItemsByCategory(
  changedItems: PackageRepackChangedItem[],
): Array<{ category: PackageRepackItemCategory; labels: string[] }> {
  const grouped = new Map<PackageRepackItemCategory, string[]>();
  for (const item of changedItems) {
    const current = grouped.get(item.category) ?? [];
    current.push(item.label);
    grouped.set(item.category, current);
  }
  return Array.from(grouped.entries()).map(([category, labels]) => ({ category, labels }));
}

export function buildSuggestedRepackDescription(input: SuggestedRepackDescriptionInput): string {
  const versionLabel = input.version.trim() || '…';
  const sections: string[] = [];

  if (input.changedItems.length > 0) {
    const changedLines: string[] = [];
    for (const group of groupChangedItemsByCategory(input.changedItems)) {
      const categoryLabel = PACKAGE_REPACK_CATEGORY_LABELS[group.category];
      changedLines.push(`${categoryLabel}:`);
      changedLines.push(formatBulletList(group.labels));
    }
    sections.push(`Changed since v${versionLabel}:\n${changedLines.join('\n')}`);
  }

  const addedLines = [
    ...input.addedApiLabels.map((label) => `API: ${label}`),
    ...input.addedComponentLabels.map((label) => `UI component: ${label}`),
    ...input.addedPortalLabels.map((label) => `Portal: ${label}`),
    ...input.addedNavigationLabels.map((label) => `Navigation: ${label}`),
    ...input.addedWorkflowLabels.map((label) => `Workflow: ${label}`),
    ...(input.hasInstallSql ? ['Database install SQL script'] : []),
  ];
  if (addedLines.length > 0) {
    sections.push(`Added:\n${formatBulletList(addedLines)}`);
  }

  const removedLines = [
    ...input.removedApiLabels.map((label) => `API: ${label}`),
    ...input.removedComponentLabels.map((label) => `UI component: ${label}`),
    ...input.removedPortalLabels.map((label) => `Portal: ${label}`),
    ...input.removedNavigationLabels.map((label) => `Navigation: ${label}`),
    ...input.removedWorkflowLabels.map((label) => `Workflow: ${label}`),
  ];
  if (removedLines.length > 0) {
    sections.push(`Removed:\n${formatBulletList(removedLines)}`);
  }

  if (sections.length === 0) {
    return `Repack for v${versionLabel}. No file changes, additions, or removals were selected yet.`;
  }

  return sections.join('\n\n');
}
