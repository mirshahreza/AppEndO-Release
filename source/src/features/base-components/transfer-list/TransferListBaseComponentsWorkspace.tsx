import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  SideBySideTransferList,
  UiSelect,
  type AppSurfaceBoxTone,
  type SideBySideTransferItem,
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

export type TransferListBaseComponentsConfig = {
  compact: boolean;
  tone: Extract<AppSurfaceBoxTone, 'slate' | 'indigo' | 'emerald' | 'cyan'>;
  state: 'default' | 'empty-left' | 'empty-right';
};

const DEFAULT_CONFIG: TransferListBaseComponentsConfig = {
  compact: false,
  tone: 'slate',
  state: 'default',
};

const ALL_ITEMS: SideBySideTransferItem[] = [
  { id: 'ops', cells: ['ops', 'Operations'] },
  { id: 'finance', cells: ['finance', 'Finance'] },
  { id: 'support', cells: ['support', 'Support'] },
  { id: 'sales', cells: ['sales', 'Sales'] },
];

const COLUMNS = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Name' },
];

export const resolveTransferListOptionLiveness = (config: TransferListBaseComponentsConfig) => ({
  visibleOptions: ['compact', 'tone', 'state'],
  listProps: {
    compact: config.compact,
    tone: config.tone,
    leftEmpty: config.state === 'empty-left',
    rightEmpty: config.state === 'empty-right',
  },
});

export const TransferListBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<TransferListBaseComponentsConfig>(DEFAULT_CONFIG);
  const [rightIds, setRightIds] = useState<string[]>(['ops', 'finance']);
  const configJson = useMemo(() => JSON.stringify(resolveTransferListOptionLiveness(config).listProps, null, 2), [config]);
  const liveness = resolveTransferListOptionLiveness(config);
  const assigned = new Set(
    config.state === 'empty-right' ? [] : config.state === 'empty-left' ? ALL_ITEMS.map((item) => item.id) : rightIds,
  );
  const leftItems = ALL_ITEMS.filter((item) => !assigned.has(item.id));
  const rightItems = ALL_ITEMS.filter((item) => assigned.has(item.id));

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="transfer-list" json={configJson}>
          <BaseComponentsResetButton onClick={() => { setConfig(DEFAULT_CONFIG); setRightIds(['ops', 'finance']); }} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Transfer list" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Compact" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.compact ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, compact: event.target.value === 'yes' }))} ariaLabel="Compact">
                    <option value="no">no</option>
                    <option value="yes">yes</option>
                  </UiSelect>
                </FormField>
                <FormField label="Tone" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.tone} onChange={(event) => setConfig((current) => ({ ...current, tone: event.target.value as TransferListBaseComponentsConfig['tone'] }))} ariaLabel="Tone">
                    {['slate', 'indigo', 'emerald', 'cyan'].map((tone) => <option key={tone} value={tone}>{tone}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state} onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as TransferListBaseComponentsConfig['state'] }))} ariaLabel="State">
                    <option value="default">default</option>
                    <option value="empty-left">empty left</option>
                    <option value="empty-right">empty right</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="transfer-list">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'max-w-3xl')}>
            <SideBySideTransferList
              listId="base-components-transfer"
              leftTitle="Available"
              rightTitle="Assigned"
              leftHint="Double-click or drag onto Assigned."
              rightHint="Double-click or drag onto Available."
              columns={COLUMNS}
              leftItems={leftItems}
              rightItems={rightItems}
              onMoveToRight={(id) => setRightIds((current) => current.includes(id) ? current : [...current, id])}
              onMoveToLeft={(id) => setRightIds((current) => current.filter((item) => item !== id))}
              leftEmptyMessage="Every team is assigned."
              rightEmptyMessage="Assign at least one team."
              tone={liveness.listProps.tone}
              compact={liveness.listProps.compact}
            />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
