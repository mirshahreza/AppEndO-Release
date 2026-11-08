import type { DesignerDocument } from '../../domain/component-designer/types';
import {
  type ShellNavRegionSlotId,
  isShellNavRegionSlotId,
} from './shellNavRegions';

export const SHELL_NAV_SLOT_NAVIGATION_REF_PROP = 'navigationRef' as const;

export type ShellNavSlotConfig = {
  navigationRef?: string;
};

export type ShellNavSlotConfigMap = Partial<Record<ShellNavRegionSlotId, ShellNavSlotConfig>>;

function readNavigationRefProp(props: Record<string, unknown>): string | undefined {
  const value = props[SHELL_NAV_SLOT_NAVIGATION_REF_PROP];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Reads per-region navigation JSON ids from layout `system-slot` nodes. */
export function extractShellNavSlotConfigFromDocument(
  document: DesignerDocument,
): ShellNavSlotConfigMap {
  const config: ShellNavSlotConfigMap = {};

  for (const node of Object.values(document.nodes)) {
    if (node.type !== 'system-slot') {
      continue;
    }

    const slotId = typeof node.props.slotId === 'string' ? node.props.slotId.trim() : '';
    if (!isShellNavRegionSlotId(slotId) || config[slotId]) {
      continue;
    }

    const navigationRef = readNavigationRefProp(node.props);
    if (navigationRef) {
      config[slotId] = { navigationRef };
    }
  }

  return config;
}

export function resolveShellNavNavigationRef(
  slotId: ShellNavRegionSlotId,
  slotConfig: ShellNavSlotConfigMap,
  shellNavigationRef?: string | null,
): string | null {
  const slotRef = slotConfig[slotId]?.navigationRef?.trim();
  if (slotRef) {
    return slotRef;
  }

  const shellRef = shellNavigationRef?.trim();
  return shellRef && shellRef.length > 0 ? shellRef : null;
}
