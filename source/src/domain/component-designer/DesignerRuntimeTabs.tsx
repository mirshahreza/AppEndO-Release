import * as React from 'react';
import { UiTabs, type UiTabItem } from '../../shared/ui/UiTabs';
import type { DesignerNode } from './types';
import type { RuntimeRenderMode } from './runtimeTypes';
import {
  parseDesignerTabItems,
  readUiTabsAlignment,
  readUiTabsOverflow,
  readUiTabsPanelAttachment,
  readUiTabsPlacement,
  readUiTabsVariant,
  readUiTabsVisualMode,
  readUiTabsWidth,
} from './designerTabItems';
import { readString } from './runtimeShared';

type DesignerRuntimeTabsProps = {
  node: DesignerNode;
  items: UiTabItem[];
  className?: string;
  mode: RuntimeRenderMode;
  onSelectionChange?: (key: React.Key) => void;
};

export const DesignerRuntimeTabs: React.FC<DesignerRuntimeTabsProps> = ({
  node,
  items,
  className,
  mode,
  onSelectionChange,
}) => {
  const parsedItems = parseDesignerTabItems(node.props.items);
  const inspectorKey = readString(node.props.defaultSelectedKey, parsedItems[0]?.key ?? 'tab-0');
  const [clickedKey, setClickedKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    setClickedKey(null);
  }, [inspectorKey]);

  const selectedKey = clickedKey && items.some((item) => item.id === clickedKey)
    ? clickedKey
    : inspectorKey;

  return (
    <UiTabs
      items={items}
      selectedKey={selectedKey}
      ariaLabel={readString(node.props.ariaLabel, 'Tabs')}
      placement={readUiTabsPlacement(node.props.placement)}
      alignment={readUiTabsAlignment(node.props.alignment)}
      width={readUiTabsWidth(node.props.width)}
      variant={readUiTabsVariant(node.props.variant)}
      visualMode={readUiTabsVisualMode(node.props.visualMode)}
      panelAttachment={readUiTabsPanelAttachment(node.props.panelAttachment)}
      overflow={readUiTabsOverflow(node.props.overflow)}
      panelLifecycle={mode === 'design' ? 'eager' : 'lazy-keep'}
      className={className}
      onSelectionChange={(key) => {
        setClickedKey(key);
        onSelectionChange?.(key);
      }}
    />
  );
};
