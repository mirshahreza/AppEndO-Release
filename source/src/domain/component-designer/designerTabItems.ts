import type {
  UiTabsAlignment,
  UiTabsOverflow,
  UiTabsPanelAttachment,
  UiTabsPanelLifecycle,
  UiTabsPlacement,
  UiTabsVariant,
  UiTabsWidth,
  UiTabVisualMode,
} from '../../shared/ui/UiTabs';

export type DesignerTabItemRecord = {
  key: string;
  label: string;
};

export const DEFAULT_DESIGNER_TAB_ITEMS: DesignerTabItemRecord[] = [
  { key: 'tab-0', label: 'Tab 1' },
  { key: 'tab-1', label: 'Tab 2' },
];

export const LAYOUT_TAB_PANE_PROP = '_designerTabPane';
export const LAYOUT_TAB_PANE_CLASS =
  'flex min-h-[120px] min-w-0 flex-1 flex-col gap-2 p-3';

const asRecordArray = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const parseDesignerTabItems = (raw: unknown): DesignerTabItemRecord[] => {
  const records = asRecordArray(raw);
  const items = records.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      return { key: `tab-${index}`, label: `Tab ${index + 1}` };
    }
    const rec = entry as Record<string, unknown>;
    const keySource = typeof rec.key === 'string' && rec.key.trim()
      ? rec.key.trim()
      : typeof rec.id === 'string' && rec.id.trim()
        ? rec.id.trim()
        : `tab-${index}`;
    const label = typeof rec.label === 'string' && rec.label.trim().length > 0
      ? rec.label
      : `Tab ${index + 1}`;
    return { key: keySource, label };
  });
  return items.length > 0 ? items : DEFAULT_DESIGNER_TAB_ITEMS.map((item) => ({ ...item }));
};

export const readUiTabsPlacement = (value: unknown): UiTabsPlacement => (
  value === 'start' || value === 'end' || value === 'top' ? value : 'top'
);

export const readUiTabsAlignment = (value: unknown): UiTabsAlignment => (
  value === 'center' || value === 'end' || value === 'start' ? value : 'start'
);

export const readUiTabsWidth = (value: unknown): UiTabsWidth => (
  value === 'equal' ? 'equal' : 'fit'
);

export const readUiTabsVariant = (value: unknown): UiTabsVariant => (
  value === 'contained' ? 'contained' : 'line'
);

export const readUiTabsVisualMode = (value: unknown): UiTabVisualMode => (
  value === 'icon-label' || value === 'icon-only' || value === 'label' ? value : 'label'
);

export const readUiTabsPanelAttachment = (value: unknown): UiTabsPanelAttachment => (
  value === 'separated' ? 'separated' : 'integrated'
);

export const readUiTabsOverflow = (value: unknown): UiTabsOverflow => (
  value === 'menu' ? 'menu' : 'scroll'
);

export const readUiTabsPanelLifecycle = (value: unknown): UiTabsPanelLifecycle => (
  value === 'eager' || value === 'unmount' || value === 'lazy-keep' ? value : 'lazy-keep'
);

export const isDesignerTabPaneNode = (node: { props: Record<string, unknown> }): boolean =>
  node.props[LAYOUT_TAB_PANE_PROP] === true || node.props[LAYOUT_TAB_PANE_PROP] === 'true';
