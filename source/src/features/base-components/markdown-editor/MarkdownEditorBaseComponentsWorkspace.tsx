import React, { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import {
  AppButton,
  AppSurfaceBox,
  FormField,
  FormSection,
  MarkdownEditDialog,
  MarkdownPreview,
  UiSelect,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
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
import {
  BASE_COMPONENTS_CAPTION_CLASS,
  BASE_COMPONENTS_EMPTY_STATE_CLASS,
} from '../baseComponentsVisualTokens';
import { markdownToolbarProps } from '../../../shared/lib/markdownEditorToolbar';

export { markdownToolbarProps };

const SAMPLE_MARKDOWN = `## Purpose

Describe what this model represents and who uses it.

### Rules

- Keep identifiers in **snake_case**
- Document nullable columns in operator notes

> Changes to primary keys require a migration plan.

\`\`\`md
# Example heading
- bullet item
\`\`\`
`;

export type MarkdownCapability = 'links' | 'code' | 'images' | 'tables' | 'ai';

export type MarkdownEditorBaseComponentsConfig = {
  toolbar: 'minimal' | 'standard' | 'full';
  capabilities: readonly MarkdownCapability[];
  fullscreen: boolean;
  allowFullscreen: boolean;
  direction: 'auto' | 'ltr' | 'rtl';
  state: 'default' | 'empty' | 'long' | 'read-only';
};

const DEFAULT_CONFIG: MarkdownEditorBaseComponentsConfig = {
  toolbar: 'standard',
  capabilities: ['links', 'code'],
  fullscreen: false,
  allowFullscreen: true,
  direction: 'auto',
  state: 'default',
};

const CAPABILITY_PRESETS: Array<{ label: string; value: readonly MarkdownCapability[] }> = [
  { label: 'none', value: [] },
  { label: 'links', value: ['links'] },
  { label: 'links and code', value: ['links', 'code'] },
  { label: 'links, images, tables, code', value: ['links', 'images', 'tables', 'code'] },
  { label: 'full plus AI', value: ['links', 'images', 'tables', 'code', 'ai'] },
];

const capabilityKey = (capabilities: readonly MarkdownCapability[]) => capabilities.join(',');

export const resolveMarkdownEditorOptionLiveness = (
  config: MarkdownEditorBaseComponentsConfig,
  markdown: string,
) => {
  const content = config.state === 'empty'
    ? ''
    : config.state === 'long'
      ? `${markdown}\n\n${markdown}\n\n${markdown}`
      : markdown;
  return {
    content,
    visibleOptions: ['toolbar', 'capabilities', 'fullscreen', 'direction', 'state'],
    previewProps: { content, dir: config.direction },
    dialogProps: {
      initialValue: content,
      readOnly: config.state === 'read-only',
      dir: config.direction,
      toolbarProps: (() => {
        const base = markdownToolbarProps(config.toolbar);
        const allowed = new Set(config.capabilities);
        return {
          ...base,
          enableLink: base.enableLink && allowed.has('links'),
          enableCodeBlock: base.enableCodeBlock && allowed.has('code'),
          enableImage: base.enableImage && allowed.has('images'),
          enableTable: base.enableTable && allowed.has('tables'),
        };
      })(),
    },
    allowFullscreen: config.allowFullscreen,
    fullscreen: config.allowFullscreen && config.fullscreen,
  };
};

export const MarkdownEditorBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<MarkdownEditorBaseComponentsConfig>(DEFAULT_CONFIG);
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);
  const [editOpen, setEditOpen] = useState(false);

  const optionLiveness = resolveMarkdownEditorOptionLiveness(config, markdown);
  const previewContent = optionLiveness.content;
  const configJson = useMemo(() => JSON.stringify({
    ...config,
    markdownLength: previewContent.length,
  }, null, 2), [config, previewContent]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="markdown-editor" json={configJson}>
          <BaseComponentsResetButton onClick={() => {
            setConfig(DEFAULT_CONFIG);
            setMarkdown(SAMPLE_MARKDOWN);
          }} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Editor options" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Toolbar" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.toolbar} onChange={(event) => setConfig((current) => ({ ...current, toolbar: event.target.value as MarkdownEditorBaseComponentsConfig['toolbar'] }))} ariaLabel="Markdown toolbar">
                    <option value="minimal">minimal</option><option value="standard">standard</option><option value="full">full</option>
                  </UiSelect>
                </FormField>
                <FormField label="Capabilities" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={capabilityKey(config.capabilities)}
                    onChange={(event) => {
                      const next = CAPABILITY_PRESETS.find((preset) => capabilityKey(preset.value) === event.target.value);
                      if (next) setConfig((current) => ({ ...current, capabilities: next.value }));
                    }}
                    ariaLabel="Markdown capabilities"
                  >
                    {CAPABILITY_PRESETS.map((preset) => (
                      <option key={preset.label} value={capabilityKey(preset.value)}>{preset.label}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField label="Fullscreen" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.allowFullscreen ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, allowFullscreen: event.target.value === 'yes', fullscreen: event.target.value === 'yes' ? current.fullscreen : false }))} ariaLabel="Allow fullscreen">
                    <option value="yes">allowed</option><option value="no">off</option>
                  </UiSelect>
                </FormField>
                <FormField label="Preview direction" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.direction}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === 'auto' || value === 'ltr' || value === 'rtl') {
                        setConfig((current) => ({ ...current, direction: value }));
                      }
                    }}
                    ariaLabel="Preview document direction"
                  >
                    <option value="auto">auto</option>
                    <option value="ltr">ltr</option>
                    <option value="rtl">rtl</option>
                  </UiSelect>
                </FormField>

                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state} onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as MarkdownEditorBaseComponentsConfig['state'] }))} ariaLabel="Markdown state">
                    {['default', 'empty', 'long', 'read-only'].map((state) => <option key={state} value={state}>{state}</option>)}
                  </UiSelect>
                </FormField>

                <AppButton intent="utility" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </AppButton>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="markdown-editor">
          <div className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
            <AppSurfaceBox
              tone="cyan"
              layout="panel"
              fill
              title="Markdown preview"
              className={optionLiveness.fullscreen ? 'min-h-full' : 'min-h-[280px]'}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">{config.toolbar} toolbar</span>
                <span>{config.capabilities.length ? config.capabilities.join(', ') : 'no extras'}</span>
                {config.allowFullscreen ? (
                  <AppButton size="sm" intent="utility" onClick={() => setConfig((current) => ({ ...current, fullscreen: !current.fullscreen }))}>
                    {config.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  </AppButton>
                ) : null}
                <span>{config.state}</span>
              </div>
              <MarkdownPreview
                {...optionLiveness.previewProps}
                emptyFallback={(
                  <button
                    type="button"
                    className={BASE_COMPONENTS_EMPTY_STATE_CLASS}
                    onClick={() => setEditOpen(true)}
                  >
                    <span className="text-[11px] font-medium text-slate-600">No Markdown yet</span>
                    <span className={cn('ps-[4px]', BASE_COMPONENTS_CAPTION_CLASS)}>
                      Open the editor to write content.
                    </span>
                  </button>
                )}
              />
            </AppSurfaceBox>
          </div>
        </BaseComponentsPreviewFrame>
      </div>

      <MarkdownEditDialog
        open={editOpen}
        title="Edit Markdown"
        initialValue={optionLiveness.dialogProps.initialValue}
        onClose={() => setEditOpen(false)}
        onSave={(value) => {
          setMarkdown(value);
          setConfig((current) => ({ ...current, state: 'default' }));
        }}
        placeholder="Write content…"
        readOnly={optionLiveness.dialogProps.readOnly}
        dir={optionLiveness.dialogProps.dir}
        toolbarProps={optionLiveness.dialogProps.toolbarProps}
      />
    </div>
  );
};
