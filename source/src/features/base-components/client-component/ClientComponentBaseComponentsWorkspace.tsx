import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  UiClientComponent,
  UiSelect,
} from '../../../shared/ui';
import type { ClientComponentBelowMin, ClientComponentMinViewport } from '../../../shared/lib/clientComponentViewport';
import { ViewportTierContext } from '../../../shared/lib/ViewportTierProvider';
import type { ViewportTier } from '../../../shared/lib/viewportTokens';
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

export type ClientComponentBaseComponentsConfig = {
  minViewport: 'always' | ClientComponentMinViewport;
  belowMin: ClientComponentBelowMin;
  simulatedViewport: ViewportTier;
};

export const DEFAULT_CLIENT_COMPONENT_BASE_COMPONENTS_CONFIG: ClientComponentBaseComponentsConfig = {
  minViewport: 'always',
  belowMin: 'continue',
  simulatedViewport: 'phone',
};

export const resolveClientComponentOptionLiveness = (config: ClientComponentBaseComponentsConfig) => ({
  component: 'UiClientComponent',
  visibleOptions: config.minViewport === 'always' ? ['minViewport'] : ['minViewport', 'belowMin'],
  clientProps: {
    minViewport: config.minViewport,
    belowMin: config.minViewport === 'always' ? 'continue' : config.belowMin,
  },
});

export const ClientComponentBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<ClientComponentBaseComponentsConfig>(
    DEFAULT_CLIENT_COMPONENT_BASE_COMPONENTS_CONFIG,
  );
  const liveness = resolveClientComponentOptionLiveness(config);
  const configJson = useMemo(() => JSON.stringify(liveness.clientProps, null, 2), [liveness]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="client-component" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CLIENT_COMPONENT_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Client component" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Min viewport" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.minViewport}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      minViewport: event.target.value as ClientComponentBaseComponentsConfig['minViewport'],
                    }))}
                    ariaLabel="Min viewport"
                  >
                    <option value="always">always (adapt)</option>
                    <option value="tablet">tablet and up</option>
                    <option value="desktop">desktop only</option>
                  </UiSelect>
                </FormField>
                <FormField label="Below minimum" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.belowMin}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      belowMin: event.target.value as ClientComponentBelowMin,
                    }))}
                    ariaLabel="Below minimum"
                    isDisabled={config.minViewport === 'always'}
                  >
                    <option value="continue">continue (adapt layout)</option>
                    <option value="hide">hide</option>
                    <option value="placeholder">desktop only message</option>
                  </UiSelect>
                </FormField>
                <FormField label="Simulated size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.simulatedViewport}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      simulatedViewport: event.target.value as ViewportTier,
                    }))}
                    ariaLabel="Simulated size"
                  >
                    <option value="phone">phone</option>
                    <option value="tablet">tablet</option>
                    <option value="desktop">desktop</option>
                    <option value="wide">wide</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="client-component">
          <div data-bc-preview-root="client-component" className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
            <ViewportTierContext.Provider value={config.simulatedViewport}>
              <UiClientComponent
                minViewport={liveness.clientProps.minViewport}
                belowMin={liveness.clientProps.belowMin}
              >
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">Adapted client body</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    This host still renders on smaller screens when Below minimum is Continue, so the
                    inner layout can switch to a compact behavior.
                  </p>
                </div>
              </UiClientComponent>
            </ViewportTierContext.Provider>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
