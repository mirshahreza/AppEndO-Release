import React, { useMemo, useState } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import {
  AppButton,
  FloatingPanelShell,
  FormField,
  FormSection,
  UiInput,
  UiSelect,
  UiTextarea,
} from '../../../shared/ui';
import type { FloatingPanelBounds, FloatingPanelInitialPosition } from '../../../shared/ui/useFloatingPanel';
import type { SurfaceChromeColorSource } from '../../../shared/ui/surfaceChromeClasses';
import type { AppSurfaceBoxTone } from '../../../shared/ui/surfaceClasses';
import { cn } from '../../../lib/utils';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import { BaseComponentsPreviewFrame, BASE_COMPONENTS_WORKSPACE_INSET_CLASS } from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import {
  BaseComponentsOverlayHeaderFields,
  renderBaseComponentsOverlayHeaderActions,
} from '../components/BaseComponentsOverlayHeaderFields';
import {
  BASE_COMPONENTS_SURFACE_CHROME_DEFAULT,
  BaseComponentsSurfaceChromeSection,
} from '../components/BaseComponentsSurfaceChromeFields';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';
import {
  BASE_COMPONENTS_STUDIO_PANEL_BORDER,
  BASE_COMPONENTS_STUDIO_PANEL_HEADER_BAND_CLASS,
  BASE_COMPONENTS_STUDIO_PANEL_HEADER_CLASS,
  BASE_COMPONENTS_STUDIO_PANEL_TITLE_CLASS,
  type BaseComponentsStudioPanelChrome,
  BASE_COMPONENTS_BADGE_SOFT_CLASS,
} from '../baseComponentsVisualTokens';

type SizePreset = 'chat' | 'preview' | 'compact';
type HeaderHeight = 'chat' | 'compact';
type BodyMode = 'plain' | 'scroll' | 'chat-layout';
type FloatingPanelPreset = 'inspector' | 'toolbox' | 'editor' | 'data-studio';

export type FloatingPanelBaseComponentsConfig = {
  preset: FloatingPanelPreset;
  title: string;
  showTitleIcon: boolean;
  colorSource: SurfaceChromeColorSource;
  tone: AppSurfaceBoxTone;
  customColorHex: string;
  sizePreset: SizePreset;
  headerHeight: HeaderHeight;
  initialPosition: FloatingPanelInitialPosition;
  showHeaderBand: boolean;
  footerMode: 'none' | 'actions' | 'status';
  showThinkingIndicator: boolean;
  bodyMode: BodyMode;
  enableDrag: boolean;
  dragFromHeaderOnly: boolean;
  enableResize: boolean;
  enableMaximize: boolean;
  showCloseButton: boolean;
  headerActionCount: number;
  state: 'default' | 'maximized' | 'disabled';
  direction: 'ltr' | 'rtl';
  /** Preview-only Data Studio modeler chrome presets */
  studioChrome: BaseComponentsStudioPanelChrome;
};

const SIZE_PRESET_BOUNDS: Record<SizePreset, FloatingPanelBounds & { defaultWidth: number; defaultHeight: number }> = {
  chat: {
    minWidth: 792,
    maxWidth: 2196,
    minHeight: 682,
    defaultWidth: 1026,
    defaultHeight: 1202,
    maximizeInset: 16,
  },
  preview: {
    minWidth: 360,
    maxWidth: 1600,
    minHeight: 280,
    defaultWidth: 960,
    defaultHeight: 720,
    maximizeInset: 16,
  },
  compact: {
    minWidth: 320,
    maxWidth: 960,
    minHeight: 240,
    defaultWidth: 480,
    defaultHeight: 420,
    maximizeInset: 16,
  },
};

export const DEFAULT_FLOATING_PANEL_BASE_COMPONENTS_CONFIG: FloatingPanelBaseComponentsConfig = {
  preset: 'inspector',
  title: 'AppEndoo',
  showTitleIcon: true,
  ...BASE_COMPONENTS_SURFACE_CHROME_DEFAULT,
  sizePreset: 'chat',
  headerHeight: 'chat',
  initialPosition: 'center',
  showHeaderBand: true,
  footerMode: 'actions',
  showThinkingIndicator: false,
  bodyMode: 'chat-layout',
  enableDrag: true,
  dragFromHeaderOnly: true,
  enableResize: true,
  enableMaximize: true,
  showCloseButton: true,
  headerActionCount: 0,
  state: 'default',
  direction: 'ltr',
  studioChrome: 'default',
};

export function resolveFloatingPanelPreviewModel(config: FloatingPanelBaseComponentsConfig) {
  const studioChrome = config.studioChrome !== 'default';
  return {
    root: 'floating-panel',
    preset: config.preset,
    title: config.title,
    titleIcon: config.showTitleIcon,
    colorSource: studioChrome ? 'tone' as const : config.colorSource,
    tone: studioChrome ? 'slate' as const : config.tone,
    customColorHex: config.customColorHex,
    bounds: SIZE_PRESET_BOUNDS[config.sizePreset],
    sizePreset: config.sizePreset,
    initialPosition: config.initialPosition,
    headerHeight: studioChrome ? 'studio' as const : config.headerHeight,
    studioChrome: config.studioChrome,
    showSurfaceChromeControls: !studioChrome,
    showHeaderHeightControl: !studioChrome,
    showHeaderBand: config.showHeaderBand,
    footerMode: config.footerMode,
    showThinkingIndicator: config.showThinkingIndicator,
    bodyMode: config.bodyMode,
    enableDrag: config.enableDrag,
    dragFromHeaderOnly: config.enableDrag && config.dragFromHeaderOnly,
    showDragRegionControl: config.enableDrag,
    enableResize: config.enableResize,
    enableMaximize: config.enableMaximize,
    showCloseButton: config.showCloseButton,
    headerActionCount: config.headerActionCount,
    maximized: config.enableMaximize && config.state === 'maximized',
    disabled: config.state === 'disabled',
    direction: config.direction,
  };
}

export function applyFloatingPanelPreset(
  config: FloatingPanelBaseComponentsConfig,
  preset: FloatingPanelPreset,
): FloatingPanelBaseComponentsConfig {
  const recipe: Record<FloatingPanelPreset, Partial<FloatingPanelBaseComponentsConfig>> = {
    inspector: { sizePreset: 'compact', bodyMode: 'scroll', footerMode: 'status' },
    toolbox: { sizePreset: 'compact', bodyMode: 'plain', footerMode: 'none' },
    editor: { sizePreset: 'preview', bodyMode: 'scroll', footerMode: 'actions' },
    'data-studio': { sizePreset: 'preview', bodyMode: 'scroll', footerMode: 'status', studioChrome: 'column' },
  };
  return { ...config, preset, ...recipe[preset] };
}

const SAMPLE_MESSAGES = [
  { role: 'user' as const, content: 'How do floating panels behave in AppEndO?' },
  { role: 'assistant' as const, content: 'They are fixed overlays with drag, resize, and maximize — anchored from the top-right like AppEndoo.' },
  { role: 'user' as const, content: 'Can I configure the shell in baseComponents?' },
  { role: 'assistant' as const, content: 'Yes. Toggle header band, footer composer, size preset, and interaction flags from the configurator.' },
];

function renderBodyContent(mode: BodyMode) {
  if (mode === 'scroll') {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="space-y-2">
          {Array.from({ length: 24 }, (_, index) => (
            <p key={index} className="text-xs text-slate-600">
              Scrollable body line {index + 1} — only the body region scrolls while the header and footer stay fixed.
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'chat-layout') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-3">
          {SAMPLE_MESSAGES.map((message, index) => (
            <div
              key={index}
              className={cn(
                'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                message.role === 'user'
                  ? 'ms-auto border border-primary-400/30 bg-primary-500 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-800',
              )}
            >
              {message.content}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white p-3">
      <p className="text-sm text-slate-700">
        Body host uses a flat white surface. Drag the header to move (when header drag is on), the corner grip to resize, and maximize to fill the viewport with inset.
      </p>
    </div>
  );
}

export const FloatingPanelBaseComponentsPreview: React.FC<{
  config: FloatingPanelBaseComponentsConfig;
  open: boolean;
  onClose: () => void;
}> = ({ config, open, onClose }) => {
  const model = resolveFloatingPanelPreviewModel(config);
  const preset = model.bounds;
  const studioBorder = BASE_COMPONENTS_STUDIO_PANEL_BORDER[config.studioChrome];
  const useStudioChrome = config.studioChrome !== 'default';
  const [composerStatus, setComposerStatus] = useState('Ready to send.');

  return (
    <FloatingPanelShell
      open={open}
      onClose={onClose}
      title={model.title}
      colorSource={model.colorSource}
      tone={model.tone}
      customColorHex={model.customColorHex}
      titleIcon={model.titleIcon ? <Bot className="h-5 w-5 text-primary-500" /> : undefined}
      titleClassName={useStudioChrome ? BASE_COMPONENTS_STUDIO_PANEL_TITLE_CLASS : undefined}
      borderClassName={studioBorder || undefined}
      headerExtra={
        config.showThinkingIndicator ? (
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-amber-500">
            <span className="block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            Thinking
          </div>
        ) : undefined
      }
      headerActions={renderBaseComponentsOverlayHeaderActions(config.headerActionCount)}
      showCloseButton={model.showCloseButton}
      headerBand={
        config.showHeaderBand ? (
          <div className={useStudioChrome ? BASE_COMPONENTS_STUDIO_PANEL_HEADER_BAND_CLASS : 'px-4 py-2.5'}>
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold leading-5 text-slate-800">Preview model</p>
              <span className={cn(BASE_COMPONENTS_BADGE_SOFT_CLASS, 'items-center gap-1 border-slate-200 bg-slate-50 text-slate-600')}>
                <Sparkles className="h-3 w-3 text-slate-400" />
                Chat
              </span>
            </div>
          </div>
        ) : undefined
      }
      footer={
        config.footerMode !== 'none' ? (
          <div className="px-4 py-3">
            {config.footerMode === 'status' ? (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Last saved 2 minutes ago</span>
                <span>Session geometry</span>
              </div>
            ) : <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <UiTextarea
                size="sm"
                rows={2}
                defaultValue="Type a baseComponents message…"
                ariaLabel="Composer"
              />
              <div className="mt-2 flex items-center justify-end">
                <span className="me-auto text-[10px] text-slate-500">{composerStatus}</span>
                <AppButton intent="primary" size="icon-md" aria-label="Send message" onClick={() => setComposerStatus('Message sent.')}>
                  <Send className="h-3.5 w-3.5" />
                </AppButton>
              </div>
            </div>}
          </div>
        ) : undefined
      }
      bounds={{
        minWidth: preset.minWidth,
        maxWidth: preset.maxWidth,
        minHeight: preset.minHeight,
        maximizeInset: preset.maximizeInset,
      }}
      defaultWidth={preset.defaultWidth}
      defaultHeight={preset.defaultHeight}
      initialPosition={config.initialPosition}
      enableDrag={model.enableDrag}
      dragFromHeaderOnly={model.dragFromHeaderOnly}
      enableResize={model.enableResize}
      enableMaximize={model.enableMaximize}
      initialMaximized={model.maximized}
      headerClassName={
        useStudioChrome
          ? BASE_COMPONENTS_STUDIO_PANEL_HEADER_CLASS
          : (config.headerHeight === 'chat' ? 'h-[60px]' : 'h-[30px] px-3')
      }
      contained
    >
      <div data-bc-preview-root="floating-panel" dir={config.direction} className={cn('flex min-h-0 flex-1 flex-col', config.state === 'disabled' && 'pointer-events-none opacity-60')}>
        {renderBodyContent(config.bodyMode)}
      </div>
    </FloatingPanelShell>
  );
};

export const FloatingPanelBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<FloatingPanelBaseComponentsConfig>(DEFAULT_FLOATING_PANEL_BASE_COMPONENTS_CONFIG);
  const configJson = useMemo(() => JSON.stringify({
    public: {
      size: config.sizePreset,
      position: config.initialPosition,
      capabilities: [
        config.enableDrag && 'drag',
        config.enableResize && 'resize',
        config.enableMaximize && 'maximize',
      ].filter(Boolean),
      bodyMode: config.bodyMode,
      bounds: SIZE_PRESET_BOUNDS[config.sizePreset],
      showCloseButton: config.showCloseButton,
      headerActionCount: config.headerActionCount,
    },
    composition: {
      preset: config.preset,
      header: { title: config.title, icon: config.showTitleIcon, height: config.headerHeight },
      bands: config.showHeaderBand ? ['description'] : [],
      footer: config.footerMode,
      surfacePreset: config.studioChrome === 'default' ? 'neutral-raised' : config.studioChrome,
    },
    demo: { fixtures: { body: config.bodyMode }, scenarios: { state: config.state, direction: config.direction } },
  }, null, 2), [config]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="floating-panel" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_FLOATING_PANEL_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
          <FormSection title="Shell" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
            <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
              <FormField label="Preset" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.preset}
                  onChange={(event) => {
                    const preset = event.target.value as FloatingPanelPreset;
                    setConfig((current) => applyFloatingPanelPreset(current, preset));
                  }}
                  ariaLabel="Floating panel preset"
                >
                  {['inspector', 'toolbox', 'editor', 'data-studio'].map((value) => <option key={value} value={value}>{value}</option>)}
                </UiSelect>
              </FormField>
              <FormField label="Title" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiInput
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.title}
                  onChange={(event) => setConfig((current) => ({ ...current, title: event.target.value }))}
                />
              </FormField>

              <FormField label="Title icon" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.showTitleIcon ? 'yes' : 'no'}
                  onChange={(event) => {
                    setConfig((current) => ({
                      ...current,
                      showTitleIcon: event.target.value === 'yes',
                    }));
                  }}
                  ariaLabel="Show title icon"
                >
                  <option value="yes">show</option>
                  <option value="no">hide</option>
                </UiSelect>
              </FormField>
              <BaseComponentsOverlayHeaderFields
                showCloseButton={config.showCloseButton}
                headerActionCount={config.headerActionCount}
                onShowCloseButtonChange={(showCloseButton) => setConfig((current) => ({ ...current, showCloseButton }))}
                onHeaderActionCountChange={(headerActionCount) => setConfig((current) => ({ ...current, headerActionCount }))}
              />

              {config.studioChrome === 'default' ? <FormField label="Header" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.headerHeight}
                  onChange={(event) => {
                    const headerHeight = event.target.value as HeaderHeight;
                    if (headerHeight === 'chat' || headerHeight === 'compact') {
                      setConfig((current) => ({ ...current, headerHeight }));
                    }
                  }}
                  ariaLabel="Header height"
                >
                  <option value="chat">60px</option>
                  <option value="compact">30px</option>
                </UiSelect>
              </FormField> : null}

              <FormField label="Size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.sizePreset}
                  onChange={(event) => {
                    const sizePreset = event.target.value as SizePreset;
                    if (sizePreset === 'chat' || sizePreset === 'preview' || sizePreset === 'compact') {
                      setConfig((current) => ({ ...current, sizePreset }));
                    }
                  }}
                  ariaLabel="Size preset"
                >
                  <option value="chat">chat</option>
                  <option value="preview">preview</option>
                  <option value="compact">compact</option>
                </UiSelect>
              </FormField>

              <FormField
                label="Studio chrome"
                hint="Applies Data Studio modeler floating-window chrome (border-2 + white header). Preview only."
                className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
              >
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.studioChrome}
                  onChange={(event) => {
                    const studioChrome = event.target.value as BaseComponentsStudioPanelChrome;
                    if (
                      studioChrome === 'default'
                      || studioChrome === 'column'
                      || studioChrome === 'relation'
                      || studioChrome === 'designer'
                    ) {
                      setConfig((current) => ({ ...current, studioChrome }));
                    }
                  }}
                  ariaLabel="Studio chrome preset"
                >
                  <option value="default">default</option>
                  <option value="column">modeler column</option>
                  <option value="relation">modeler relation</option>
                  <option value="designer">modeler designer</option>
                </UiSelect>
              </FormField>

              <FormField label="Position" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.initialPosition}
                  onChange={(event) => {
                    const initialPosition = event.target.value as FloatingPanelInitialPosition;
                    if (
                      initialPosition === 'center'
                      || initialPosition === 'bottom-right'
                      || initialPosition === 'top-right'
                      || initialPosition === 'top-left'
                    ) {
                      setConfig((current) => ({ ...current, initialPosition }));
                    }
                  }}
                  ariaLabel="Initial position"
                >
                  <option value="center">center</option>
                  <option value="bottom-right">bottom-right</option>
                  <option value="top-right">top-right</option>
                  <option value="top-left">top-left</option>
                </UiSelect>
              </FormField>
            </div>
          </FormSection>

          {config.studioChrome === 'default' ? <BaseComponentsSurfaceChromeSection
            config={config}
            onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
          /> : null}

          <FormSection title="Regions & behavior" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
            <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
              <FormField label="Header band" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.showHeaderBand ? 'yes' : 'no'}
                  onChange={(event) => {
                    setConfig((current) => ({
                      ...current,
                      showHeaderBand: event.target.value === 'yes',
                    }));
                  }}
                  ariaLabel="Header band"
                >
                  <option value="yes">show</option>
                  <option value="no">hide</option>
                </UiSelect>
              </FormField>

              <FormField label="Footer content" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.footerMode} onChange={(event) => setConfig((current) => ({ ...current, footerMode: event.target.value as FloatingPanelBaseComponentsConfig['footerMode'] }))} ariaLabel="Footer content">
                  <option value="none">none</option><option value="actions">actions</option><option value="status">status</option>
                </UiSelect>
              </FormField>

              <FormField label="Thinking" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.showThinkingIndicator ? 'yes' : 'no'}
                  onChange={(event) => {
                    setConfig((current) => ({
                      ...current,
                      showThinkingIndicator: event.target.value === 'yes',
                    }));
                  }}
                  ariaLabel="Thinking indicator"
                >
                  <option value="no">hide</option>
                  <option value="yes">show</option>
                </UiSelect>
              </FormField>

              <FormField label="Body" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.bodyMode}
                  onChange={(event) => {
                    const bodyMode = event.target.value as BodyMode;
                    if (bodyMode === 'plain' || bodyMode === 'scroll' || bodyMode === 'chat-layout') {
                      setConfig((current) => ({ ...current, bodyMode }));
                    }
                  }}
                  ariaLabel="Body mode"
                >
                  <option value="plain">plain</option>
                  <option value="scroll">scroll</option>
                  <option value="chat-layout">chat</option>
                </UiSelect>
              </FormField>

              <FormField label="Drag" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.enableDrag ? 'on' : 'off'}
                  onChange={(event) => {
                    setConfig((current) => ({
                      ...current,
                      enableDrag: event.target.value === 'on',
                    }));
                  }}
                  ariaLabel="Enable drag"
                >
                  <option value="on">on</option>
                  <option value="off">off</option>
                </UiSelect>
              </FormField>

              {config.enableDrag ? <FormField label="Drag region" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.dragFromHeaderOnly ? 'header' : 'panel'}
                  onChange={(event) => {
                    setConfig((current) => ({
                      ...current,
                      dragFromHeaderOnly: event.target.value === 'header',
                    }));
                  }}
                  ariaLabel="Floating panel drag region"
                >
                  <option value="header">header only</option>
                  <option value="panel">entire panel</option>
                </UiSelect>
              </FormField> : null}

              <FormField label="Resize" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.enableResize ? 'on' : 'off'}
                  onChange={(event) => {
                    setConfig((current) => ({
                      ...current,
                      enableResize: event.target.value === 'on',
                    }));
                  }}
                  ariaLabel="Enable resize"
                >
                  <option value="on">on</option>
                  <option value="off">off</option>
                </UiSelect>
              </FormField>

              <FormField label="Maximize" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.enableMaximize ? 'on' : 'off'}
                  onChange={(event) => {
                    setConfig((current) => ({
                      ...current,
                      enableMaximize: event.target.value === 'on',
                      state: event.target.value === 'off' && current.state === 'maximized' ? 'default' : current.state,
                    }));
                  }}
                  ariaLabel="Enable maximize"
                >
                  <option value="on">on</option>
                  <option value="off">off</option>
                </UiSelect>
              </FormField>
              <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state} onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as FloatingPanelBaseComponentsConfig['state'] }))} ariaLabel="Panel state">
                  <option value="default">default</option>{config.enableMaximize ? <option value="maximized">maximized</option> : null}<option value="disabled">disabled content</option>
                </UiSelect>
              </FormField>
              <FormField label="Direction" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.direction} onChange={(event) => setConfig((current) => ({ ...current, direction: event.target.value as 'ltr' | 'rtl' }))} ariaLabel="Panel direction">
                  <option value="ltr">LTR</option><option value="rtl">RTL</option>
                </UiSelect>
              </FormField>
            </div>
          </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="floating-panel" fill>
          <div className="flex h-full items-center justify-center overflow-hidden p-4">
            <FloatingPanelBaseComponentsPreview config={config} open onClose={() => undefined} />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
