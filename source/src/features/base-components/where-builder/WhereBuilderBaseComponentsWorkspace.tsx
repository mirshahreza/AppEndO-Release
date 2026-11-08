import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  UiSelect,
  SAMPLE_WHERE_FIELDS,
  SAMPLE_WHERE_CONTEXT_ITEMS,
  UiWhereBuilder,
  createSampleWhereTree,
  type WhereGroupNode,
} from '../../../shared/ui';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
} from '../baseComponentsConfiguratorLayout';

export type WhereBuilderBaseComponentsConfig = {
  fixture: 'simple' | 'nested' | 'empty';
  density: 'compact' | 'default';
  allowNestedGroups: boolean;
  showPreview: boolean;
  contextValues: boolean;
  allowManualNodes: boolean;
  showTreeLines: boolean;
  showGroupBoxes: boolean;
  allowReorder: boolean;
  state: 'default' | 'disabled' | 'empty' | 'invalid';
  viewport: 'desktop' | 'phone';
};

const DEFAULT_CONFIG: WhereBuilderBaseComponentsConfig = {
  fixture: 'nested',
  density: 'default',
  allowNestedGroups: true,
  showPreview: true,
  contextValues: true,
  allowManualNodes: true,
  showTreeLines: false,
  showGroupBoxes: false,
  allowReorder: true,
  state: 'default',
  viewport: 'desktop',
};

const OPTIONS: { label: string; key: keyof WhereBuilderBaseComponentsConfig; values: readonly string[] }[] = [
  { label: 'Fixture', key: 'fixture', values: ['simple', 'nested', 'empty'] },
  { label: 'Density', key: 'density', values: ['default', 'compact'] },
  { label: 'Nested groups', key: 'allowNestedGroups', values: ['true', 'false'] },
  { label: 'SQL preview', key: 'showPreview', values: ['true', 'false'] },
  { label: 'Context values', key: 'contextValues', values: ['true', 'false'] },
  { label: 'Manual expression', key: 'allowManualNodes', values: ['true', 'false'] },
  { label: 'Tree lines', key: 'showTreeLines', values: ['true', 'false'] },
  { label: 'Group boxes', key: 'showGroupBoxes', values: ['true', 'false'] },
  { label: 'Reorder', key: 'allowReorder', values: ['true', 'false'] },
  { label: 'State', key: 'state', values: ['default', 'disabled', 'empty', 'invalid'] },
  { label: 'Viewport', key: 'viewport', values: ['desktop', 'phone'] },
];

const treeForConfig = (config: WhereBuilderBaseComponentsConfig): WhereGroupNode => {
  if (config.state === 'empty' || config.fixture === 'empty') {
    return createSampleWhereTree('empty');
  }
  return createSampleWhereTree(config.fixture);
};

export const applyWhereBuilderOption = (
  current: WhereBuilderBaseComponentsConfig,
  key: keyof WhereBuilderBaseComponentsConfig,
  value: string,
): WhereBuilderBaseComponentsConfig => {
  if (key === 'allowNestedGroups' || key === 'showPreview' || key === 'contextValues' || key === 'allowManualNodes' || key === 'showTreeLines' || key === 'showGroupBoxes' || key === 'allowReorder') {
    return { ...current, [key]: value === 'true' };
  }
  if (key === 'fixture') {
    const fixture = value as WhereBuilderBaseComponentsConfig['fixture'];
    return {
      ...current,
      fixture,
      state: fixture === 'empty' ? 'empty' : current.state === 'empty' ? 'default' : current.state,
    };
  }
  if (key === 'state') {
    const state = value as WhereBuilderBaseComponentsConfig['state'];
    return {
      ...current,
      state,
      fixture: state === 'empty' ? 'empty' : current.fixture === 'empty' ? 'nested' : current.fixture,
    };
  }
  return { ...current, [key]: value } as WhereBuilderBaseComponentsConfig;
};

export const resolveWhereBuilderOptionLiveness = (config: WhereBuilderBaseComponentsConfig) => {
  const tree = treeForConfig(config);
  const firstConditionId = tree.children.find((child) => child.kind === 'condition')?.id;
  return {
    visibleOptions: ['fixture', 'density', 'allowNestedGroups', 'showPreview', 'contextValues', 'allowManualNodes', 'showTreeLines', 'showGroupBoxes', 'allowReorder', 'state', 'viewport'],
    viewportClass: config.viewport === 'phone' ? 'max-w-sm' : 'max-w-3xl',
    builderProps: {
      density: config.density,
      allowNestedGroups: config.allowNestedGroups,
      showPreview: config.showPreview,
      isDisabled: config.state === 'disabled',
      invalidConditionId: config.state === 'invalid' ? firstConditionId : undefined,
      fields: SAMPLE_WHERE_FIELDS,
      contextItems: config.contextValues ? SAMPLE_WHERE_CONTEXT_ITEMS : undefined,
      allowManualNodes: config.allowManualNodes,
      showTreeLines: config.showTreeLines,
      showGroupBoxes: config.showGroupBoxes,
      allowReorder: config.allowReorder,
    },
    childCount: tree.children.length,
    nestedGroupCount: tree.children.filter((child) => child.kind === 'group').length,
  };
};

export const WhereBuilderBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<WhereBuilderBaseComponentsConfig>(DEFAULT_CONFIG);
  const [tree, setTree] = useState<WhereGroupNode>(() => treeForConfig(DEFAULT_CONFIG));
  const optionLiveness = resolveWhereBuilderOptionLiveness(config);
  const json = useMemo(() => JSON.stringify({
    public: {
      density: config.density,
      allowNestedGroups: config.allowNestedGroups,
      isDisabled: config.state === 'disabled',
      allowManualNodes: config.allowManualNodes,
      showTreeLines: config.showTreeLines,
      showGroupBoxes: config.showGroupBoxes,
      allowReorder: config.allowReorder,
    },
    composition: { showPreview: config.showPreview, contextValues: config.contextValues },
    demo: { fixture: config.fixture, state: config.state, viewport: config.viewport },
  }, null, 2), [config]);

  const setOption = (key: keyof WhereBuilderBaseComponentsConfig, value: string) => {
    const next = applyWhereBuilderOption(config, key, value);
    setConfig(next);
    setTree(treeForConfig(next));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="where-builder" json={json}>
          <BaseComponentsResetButton onClick={() => {
            setConfig(DEFAULT_CONFIG);
            setTree(treeForConfig(DEFAULT_CONFIG));
          }}
          />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Where builder" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {OPTIONS.map((option) => (
                  <FormField
                    key={option.key}
                    label={option.label}
                    className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                    reserveHintSlot={false}
                  >
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={String(config[option.key])}
                      onChange={(event) => setOption(option.key, event.target.value)}
                      ariaLabel={option.label}
                    >
                      {option.values.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </UiSelect>
                  </FormField>
                ))}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="where-builder">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, optionLiveness.viewportClass)}>
            <UiWhereBuilder
              value={tree}
              onChange={setTree}
              {...optionLiveness.builderProps}
            />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
