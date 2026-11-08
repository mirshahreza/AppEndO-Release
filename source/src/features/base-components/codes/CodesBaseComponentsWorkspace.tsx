import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  UiBarcode,
  UiInput,
  UiQrCode,
  UiSelect,
  type UiBarcodeFormat,
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
  BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';

export type CodesBaseComponentsConfig = {
  kind: 'qr' | 'barcode';
  value: string;
  size: 120 | 160 | 200;
  downloadable: boolean;
  format: UiBarcodeFormat;
  showValue: boolean;
};

const DEFAULT_CONFIG: CodesBaseComponentsConfig = {
  kind: 'qr',
  value: 'https://appendO.dev',
  size: 160,
  downloadable: false,
  format: 'CODE128',
  showValue: true,
};

export const resolveCodesOptionLiveness = (config: CodesBaseComponentsConfig) => ({
  visibleOptions: [
    'kind',
    'value',
    'size',
    ...(config.kind === 'qr' ? ['downloadable'] : ['format', 'showValue']),
  ],
  codeProps: {
    kind: config.kind,
    value: config.value,
    size: config.kind === 'qr' ? config.size : Math.max(1, Math.round(config.size / 80)),
    downloadable: config.kind === 'qr' ? config.downloadable : false,
    format: config.format,
    showValue: config.kind === 'barcode' ? config.showValue : false,
  },
});

export const CodesBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<CodesBaseComponentsConfig>(DEFAULT_CONFIG);
  const liveness = resolveCodesOptionLiveness(config);
  const configJson = useMemo(() => JSON.stringify(liveness.codeProps, null, 2), [liveness]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="codes" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="QR & barcode" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Kind" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.kind} onChange={(event) => setConfig((current) => ({ ...current, kind: event.target.value as CodesBaseComponentsConfig['kind'] }))} ariaLabel="Code kind">
                    <option value="qr">qr</option>
                    <option value="barcode">barcode</option>
                  </UiSelect>
                </FormField>
                <FormField label="Value" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS} value={config.value} autoDir={false} onChange={(event) => setConfig((current) => ({ ...current, value: event.target.value }))} />
                </FormField>
                <FormField label="Size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.size)} onChange={(event) => setConfig((current) => ({ ...current, size: Number(event.target.value) as CodesBaseComponentsConfig['size'] }))} ariaLabel="Size">
                    <option value="120">120</option>
                    <option value="160">160</option>
                    <option value="200">200</option>
                  </UiSelect>
                </FormField>
                {liveness.visibleOptions.includes('downloadable') ? (
                  <FormField label="Download" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.downloadable ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, downloadable: event.target.value === 'yes' }))} ariaLabel="Downloadable">
                      <option value="no">no</option>
                      <option value="yes">yes</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                {liveness.visibleOptions.includes('format') ? (
                  <FormField label="Format" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.format} onChange={(event) => setConfig((current) => ({ ...current, format: event.target.value as UiBarcodeFormat }))} ariaLabel="Barcode format">
                      <option value="CODE128">CODE128</option>
                      <option value="EAN13">EAN13</option>
                      <option value="UPC">UPC</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                {liveness.visibleOptions.includes('showValue') ? (
                  <FormField label="Show value" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.showValue ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, showValue: event.target.value === 'yes' }))} ariaLabel="Show value">
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </UiSelect>
                  </FormField>
                ) : null}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="codes">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'items-center')}>
            {config.kind === 'qr' ? (
              <UiQrCode value={liveness.codeProps.value} size={config.size} downloadable={liveness.codeProps.downloadable} />
            ) : (
              <UiBarcode value={liveness.codeProps.value} format={liveness.codeProps.format} showValue={liveness.codeProps.showValue} size={liveness.codeProps.size} />
            )}
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
