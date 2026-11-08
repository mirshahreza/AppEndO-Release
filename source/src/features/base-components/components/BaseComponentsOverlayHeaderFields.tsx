import React from 'react';
import { PanelTop, RefreshCw, Settings2 } from 'lucide-react';
import { AppButton, FormField, UiSelect } from '../../../shared/ui';
import {
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_EDIT_CLASS,
  ICON_ACTION_VIEW_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { cn } from '../../../lib/utils';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
} from '../baseComponentsConfiguratorLayout';

export const BASE_COMPONENTS_HEADER_ACTION_COUNTS = [0, 1, 2, 3] as const;

export type BaseComponentsHeaderActionCount = (typeof BASE_COMPONENTS_HEADER_ACTION_COUNTS)[number];

type BaseComponentsOverlayHeaderFieldsProps = {
  showCloseButton: boolean;
  headerActionCount: number;
  onShowCloseButtonChange: (show: boolean) => void;
  onHeaderActionCountChange: (count: BaseComponentsHeaderActionCount) => void;
};

export function renderBaseComponentsOverlayHeaderActions(count: number): React.ReactNode {
  if (count <= 0) {
    return undefined;
  }

  const iconButtonClass = cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-7 w-7');
  const icons = [
    <AppButton key="refresh" size="icon-sm" className={cn(iconButtonClass, ICON_ACTION_VIEW_CLASS)} title="Refresh">
      <RefreshCw className="h-4 w-4" />
    </AppButton>,
    <AppButton key="settings" size="icon-sm" className={cn(iconButtonClass, ICON_ACTION_EDIT_CLASS)} title="Settings">
      <Settings2 className="h-4 w-4" />
    </AppButton>,
    <AppButton key="panel" size="icon-sm" className={cn(iconButtonClass, ICON_ACTION_VIEW_CLASS)} title="Panel">
      <PanelTop className="h-4 w-4" />
    </AppButton>,
  ];

  return icons.slice(0, Math.min(count, 3));
}

export const BaseComponentsOverlayHeaderFields: React.FC<BaseComponentsOverlayHeaderFieldsProps> = ({
  showCloseButton,
  headerActionCount,
  onShowCloseButtonChange,
  onHeaderActionCountChange,
}) => (
  <>
    <FormField label="Close" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
      <UiSelect
        size="sm"
        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
        value={showCloseButton ? 'show' : 'hide'}
        onChange={(event) => onShowCloseButtonChange(event.target.value === 'show')}
        ariaLabel="Close button"
      >
        <option value="show">show</option>
        <option value="hide">hide</option>
      </UiSelect>
    </FormField>
    <FormField label="Header actions" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
      <UiSelect
        size="sm"
        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
        value={String(headerActionCount)}
        onChange={(event) => {
          const count = Number(event.target.value) as BaseComponentsHeaderActionCount;
          if (BASE_COMPONENTS_HEADER_ACTION_COUNTS.includes(count)) {
            onHeaderActionCountChange(count);
          }
        }}
        ariaLabel="Header action count"
      >
        {BASE_COMPONENTS_HEADER_ACTION_COUNTS.map((count) => (
          <option key={count} value={String(count)}>{count}</option>
        ))}
      </UiSelect>
    </FormField>
  </>
);
