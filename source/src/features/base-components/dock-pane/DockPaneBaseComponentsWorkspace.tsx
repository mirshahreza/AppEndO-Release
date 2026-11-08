import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  isLeadingUiDockPane,
  isVerticalUiDockPane,
  UiDockPane,
  UiSelect,
  type UiDockPaneDock,
} from '../../../shared/ui';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsConfigToolbarControls, BaseComponentsResetButton } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import { BaseComponentsPreviewFrame, BASE_COMPONENTS_WORKSPACE_INSET_CLASS } from '../components/BaseComponentsWorkspacePanel';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';

export type DockPaneBaseComponentsConfig = {
  dock: UiDockPaneDock;
};

export const DEFAULT_DOCK_PANE_BASE_COMPONENTS_CONFIG: DockPaneBaseComponentsConfig = {
  dock: 'left',
};

const DOCK_OPTIONS: Array<{ value: UiDockPaneDock; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

export const resolveDockPaneOptionLiveness = (config: DockPaneBaseComponentsConfig) => ({
  visibleOptions: ['dock'],
  dockPaneProps: {
    dock: config.dock,
  },
});

export const DockPaneBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<DockPaneBaseComponentsConfig>(DEFAULT_DOCK_PANE_BASE_COMPONENTS_CONFIG);
  const liveness = resolveDockPaneOptionLiveness(config);
  const configJson = useMemo(() => JSON.stringify(liveness.dockPaneProps, null, 2), [liveness]);
  const pane = (
    <UiDockPane dock={config.dock} className="gap-3 bg-default-50 p-3">
      <p className="text-sm font-medium text-slate-700">Dock pane</p>
      <p className="text-xs text-slate-500">Sticks to the {config.dock} edge.</p>
    </UiDockPane>
  );
  const content = (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-white text-sm text-slate-500">
      Content area
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="dock-pane" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_DOCK_PANE_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Dock pane" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Dock" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.dock}
                    onChange={(event) => setConfig({ dock: event.target.value as UiDockPaneDock })}
                    ariaLabel="Dock"
                  >
                    {DOCK_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="dock-pane">
          <div data-bc-preview-root="dock-pane" className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'h-[28rem] p-0')}>
            <div
              className={cn(
                'h-full min-h-0 w-full overflow-hidden rounded-md border border-slate-200',
                isVerticalUiDockPane(config.dock) ? 'flex flex-col' : 'flex flex-row',
              )}
            >
              {isLeadingUiDockPane(config.dock) ? pane : content}
              {isLeadingUiDockPane(config.dock) ? content : pane}
            </div>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
