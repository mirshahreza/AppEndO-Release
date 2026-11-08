import React, { useMemo, useState } from 'react';
import {
  AppButton,
  FormField,
  FormSection,
  HtmlEditor,
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
} from '../baseComponentsConfiguratorLayout';

const SAMPLE_HTML = `<h2>Welcome</h2>
<p>This is a <strong>full HTML editor</strong> with Visual, Source, Split, and Preview modes.</p>
<ul>
  <li>TipTap WYSIWYG toolbar</li>
  <li>Monaco source with format + find</li>
  <li>BaseComponentsed live preview</li>
</ul>
<blockquote>Sanitize on save · Prettier format in Source/Split</blockquote>
`;

export type HtmlEditorBaseComponentsConfig = {
  mode: 'visual' | 'source' | 'split' | 'preview';
  toolbar: 'minimal' | 'standard' | 'full';
  sourceDiagnostics: boolean;
  fullscreen: boolean;
  allowFullscreen: boolean;
  direction: 'auto' | 'ltr' | 'rtl';
  previewDevice: 'desktop' | 'tablet' | 'mobile';
  state: 'default' | 'empty' | 'long' | 'media' | 'read-only';
};

const DEFAULT_CONFIG: HtmlEditorBaseComponentsConfig = {
  mode: 'visual',
  toolbar: 'standard',
  sourceDiagnostics: true,
  fullscreen: false,
  allowFullscreen: true,
  direction: 'auto',
  previewDevice: 'desktop',
  state: 'default',
};

export const htmlToolbarProps = (toolbar: HtmlEditorBaseComponentsConfig['toolbar']) => ({
  showToolbar: toolbar !== 'minimal',
  enableHeading: toolbar === 'full',
  enableImage: toolbar === 'full',
  enableTable: toolbar === 'full',
  enableCodeBlock: toolbar !== 'minimal',
  // Block-level content direction (per paragraph) — distinct from preview `dir`.
  enableTextDirection: toolbar !== 'minimal',
});

export const resolveHtmlEditorOptionLiveness = (
  config: HtmlEditorBaseComponentsConfig,
  html: string,
) => {
  const value = config.state === 'empty'
    ? ''
    : config.state === 'long'
      ? `${html}${html}${html}`
      : config.state === 'media'
        ? `${html}<figure><img src="https://picsum.photos/640/240" alt="Editorial preview" /></figure>`
        : html;
  const previewMode = config.mode === 'preview' || config.mode === 'split';
  return {
    value,
    visibleOptions: [
      'mode',
      ...(config.mode === 'visual' ? ['toolbar'] : []),
      ...(previewMode ? ['direction', 'previewDevice'] : []),
      'sourceDiagnostics',
      'fullscreen',
      'state',
    ],
    editorProps: {
      value,
      mode: config.mode,
      previewDevice: config.previewDevice,
      dir: config.direction,
      readOnly: config.state === 'read-only' || config.state === 'long' || config.state === 'media',
      ...htmlToolbarProps(config.toolbar),
    },
    sourceDiagnostics: config.sourceDiagnostics,
    allowFullscreen: config.allowFullscreen,
    fullscreen: config.allowFullscreen && config.fullscreen,
  };
};

export const HtmlEditorBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<HtmlEditorBaseComponentsConfig>(DEFAULT_CONFIG);
  const [html, setHtml] = useState(SAMPLE_HTML);

  const optionLiveness = resolveHtmlEditorOptionLiveness(config, html);
  const previewContent = optionLiveness.value;
  const configJson = useMemo(() => JSON.stringify({
    ...config,
    htmlLength: previewContent.length,
  }, null, 2), [config, previewContent]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="html-editor" json={configJson}>
          <BaseComponentsResetButton
            onClick={() => {
              setConfig(DEFAULT_CONFIG);
              setHtml(SAMPLE_HTML);
            }}
          />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection
              title="Editor options"
              tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}
            >
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Mode" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.mode} onChange={(event) => setConfig((current) => ({ ...current, mode: event.target.value as HtmlEditorBaseComponentsConfig['mode'] }))} ariaLabel="HTML editor mode">
                    <option value="visual">visual</option><option value="source">source</option><option value="split">split</option><option value="preview">preview</option>
                  </UiSelect>
                </FormField>
                {config.mode === 'visual' ? (
                  <FormField label="Toolbar" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.toolbar} onChange={(event) => setConfig((current) => ({ ...current, toolbar: event.target.value as HtmlEditorBaseComponentsConfig['toolbar'] }))} ariaLabel="HTML editor toolbar">
                      <option value="minimal">minimal</option><option value="standard">standard</option><option value="full">full</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                {config.mode === 'preview' || config.mode === 'split' ? (
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
                ) : null}

                {config.mode === 'preview' || config.mode === 'split' ? (
                  <FormField label="Device" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.previewDevice}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === 'desktop' || value === 'tablet' || value === 'mobile') {
                          setConfig((current) => ({ ...current, previewDevice: value }));
                        }
                      }}
                      ariaLabel="Preview device"
                    >
                      <option value="desktop">desktop</option>
                      <option value="tablet">tablet</option>
                      <option value="mobile">mobile</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.state}
                    onChange={(event) => {
                      const state = event.target.value as HtmlEditorBaseComponentsConfig['state'];
                      if (state === 'empty') setHtml('');
                      setConfig((current) => ({ ...current, state }));
                    }}
                    ariaLabel="HTML editor state"
                  >
                    {['default', 'empty', 'long', 'media', 'read-only'].map((state) => <option key={state} value={state}>{state}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="Source diagnostics" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.sourceDiagnostics ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, sourceDiagnostics: event.target.value === 'yes' }))} ariaLabel="HTML source diagnostics">
                    <option value="yes">show</option><option value="no">hide</option>
                  </UiSelect>
                </FormField>
                <FormField label="Fullscreen" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.allowFullscreen ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, allowFullscreen: event.target.value === 'yes', fullscreen: event.target.value === 'yes' ? current.fullscreen : false }))} ariaLabel="Allow HTML fullscreen">
                    <option value="yes">allowed</option><option value="no">off</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="html-editor">
          <div className={cn('flex min-w-0 flex-col p-2', optionLiveness.fullscreen ? 'h-full min-h-full' : 'h-full min-h-[360px]')}>
            {config.sourceDiagnostics && (config.mode === 'source' || config.mode === 'split') ? (
              <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800" role="status">
                Source diagnostics: sanitized markup · no executable scripts.
              </p>
            ) : null}
            {config.allowFullscreen ? (
              <div className="mb-2">
                <AppButton
                  size="sm"
                  intent="utility"
                  onClick={() => setConfig((current) => ({ ...current, fullscreen: !current.fullscreen }))}
                >
                  {config.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                </AppButton>
              </div>
            ) : null}
            <HtmlEditor
              {...optionLiveness.editorProps}
              onChange={(value) => {
                setHtml(value);
                if (config.state === 'empty') {
                  setConfig((current) => ({ ...current, state: 'default' }));
                }
              }}
              onModeChange={(mode) => setConfig((current) => ({ ...current, mode }))}
              onPreviewDeviceChange={(previewDevice) => setConfig((current) => ({
                ...current,
                previewDevice: previewDevice === 'fluid' ? 'desktop' : previewDevice,
              }))}
              editorHeight="100%"
              className={cn('min-h-[340px] flex-1', config.state === 'empty' && 'border-dashed')}
            />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
