import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  UiMapChoropleth,
  UiMapPin,
  UiSelect,
  type UiMapTileProvider,
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

export type MapBaseComponentsConfig = {
  kind: 'pin' | 'choropleth';
  tileProvider: UiMapTileProvider;
  clusterMarkers: boolean;
  height: 200 | 280 | 360;
};

const DEFAULT_CONFIG: MapBaseComponentsConfig = {
  kind: 'pin',
  tileProvider: 'osm',
  clusterMarkers: false,
  height: 280,
};

const PINS = [
  { id: 'teh', lat: 35.6892, lng: 51.389, label: 'Tehran' },
  { id: 'ist', lat: 41.0082, lng: 28.9784, label: 'Istanbul' },
  { id: 'dxb', lat: 25.2048, lng: 55.2708, label: 'Dubai' },
];

const REGIONS = [
  { regionCode: 'IR', value: 42, label: 'Iran' },
  { regionCode: 'TR', value: 28, label: 'Turkey' },
  { regionCode: 'AE', value: 19, label: 'UAE' },
];

export const resolveMapOptionLiveness = (config: MapBaseComponentsConfig) => ({
  visibleOptions: [
    'kind',
    'tileProvider',
    ...(config.kind === 'pin' ? ['clusterMarkers'] : []),
    'height',
  ],
  mapProps: {
    kind: config.kind,
    tileProvider: config.tileProvider,
    clusterMarkers: config.kind === 'pin' ? config.clusterMarkers : false,
    height: config.height,
  },
});

export const MapBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<MapBaseComponentsConfig>(DEFAULT_CONFIG);
  const liveness = resolveMapOptionLiveness(config);
  const configJson = useMemo(() => JSON.stringify(liveness.mapProps, null, 2), [liveness]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="map" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Map" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Kind" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.kind} onChange={(event) => setConfig((current) => ({ ...current, kind: event.target.value as MapBaseComponentsConfig['kind'] }))} ariaLabel="Map kind">
                    <option value="pin">pin</option>
                    <option value="choropleth">choropleth</option>
                  </UiSelect>
                </FormField>
                <FormField label="Tiles" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.tileProvider} onChange={(event) => setConfig((current) => ({ ...current, tileProvider: event.target.value as UiMapTileProvider }))} ariaLabel="Tile provider">
                    <option value="osm">osm</option>
                    <option value="mapbox">mapbox</option>
                    <option value="google">google</option>
                  </UiSelect>
                </FormField>
                {liveness.visibleOptions.includes('clusterMarkers') ? (
                  <FormField label="Cluster markers" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.clusterMarkers ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, clusterMarkers: event.target.value === 'yes' }))} ariaLabel="Cluster markers">
                      <option value="no">no</option>
                      <option value="yes">yes</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                <FormField label="Height" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.height)} onChange={(event) => setConfig((current) => ({ ...current, height: Number(event.target.value) as MapBaseComponentsConfig['height'] }))} ariaLabel="Height">
                    <option value="200">200</option>
                    <option value="280">280</option>
                    <option value="360">360</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="map">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'max-w-3xl overflow-hidden rounded-lg border border-slate-200')}>
            {config.kind === 'pin' ? (
              <UiMapPin
                data={PINS}
                tileProvider={liveness.mapProps.tileProvider}
                clusterMarkers={liveness.mapProps.clusterMarkers}
                height={liveness.mapProps.height}
              />
            ) : (
              <UiMapChoropleth
                data={REGIONS}
                tileProvider={liveness.mapProps.tileProvider}
                height={liveness.mapProps.height}
              />
            )}
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
