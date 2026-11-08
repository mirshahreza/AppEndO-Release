import React, { useMemo, useState } from 'react';
import { Blocks, Columns2, Lock, MoreHorizontal, Play, Redo2, Rows2, Sparkles, Undo2 } from 'lucide-react';
import {
  AppButton,
  CanvasSearchBox,
  CanvasToolbar,
  CanvasViewportControls,
  FormField,
  FormSection,
  UiSelect,
  type CanvasToolbarLayout,
} from '../../../shared/ui';
import {
  CANVAS_LAYOUT_CONTROLS_ANCHOR_CLASS,
  CANVAS_ZOOM_CONTROLS_ANCHOR_CLASS,
  type CanvasToolbarPosition,
} from '../../../shared/ui/surfaceClasses';
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

const POSITION_OPTIONS: CanvasToolbarPosition[] = [
  'top-left',
  'top-right',
  'top-center',
  'bottom-left',
  'bottom-right',
  'bottom-center',
];

const LAYOUT_OPTIONS: CanvasToolbarLayout[] = ['stack', 'row'];

export type CanvasToolbarBaseComponentsConfig = {
  preset: 'authoring' | 'review' | 'simulation';
  presentation: 'floating' | 'attached';
  viewport: 'desktop' | 'tablet' | 'phone';
  state: 'default' | 'disabled' | 'pressed';
  showHistory: boolean;
  showZoom: boolean;
  showOverflow: boolean;
  reverseGroups: boolean;
  leftPosition: CanvasToolbarPosition;
  rightPosition: CanvasToolbarPosition;
  leftLayout: CanvasToolbarLayout;
  rightLayout: CanvasToolbarLayout;
  leftFullWidthButtons: boolean;
  showLeftGroup: boolean;
  showRightGroup: boolean;
};

export const DEFAULT_CANVAS_TOOLBAR_BASE_COMPONENTS_CONFIG: CanvasToolbarBaseComponentsConfig = {
  preset: 'authoring',
  presentation: 'floating',
  viewport: 'desktop',
  state: 'default',
  showHistory: true,
  showZoom: true,
  showOverflow: true,
  reverseGroups: false,
  leftPosition: 'top-left',
  rightPosition: 'top-right',
  leftLayout: 'stack',
  rightLayout: 'stack',
  leftFullWidthButtons: true,
  showLeftGroup: true,
  showRightGroup: true,
};

export function resolveCanvasToolbarPreviewModel(config: CanvasToolbarBaseComponentsConfig) {
  return {
    root: 'canvas-toolbar',
    preset: config.preset,
    attached: config.presentation === 'attached',
    viewport: config.viewport,
    disabled: config.state === 'disabled',
    pressed: config.state === 'pressed',
    left: {
      visible: config.showLeftGroup,
      position: config.leftPosition,
      layout: config.leftLayout,
      fullWidthButtons: config.leftFullWidthButtons,
      showZoom: config.showZoom,
      reverseActions: config.reverseGroups,
    },
    right: {
      visible: config.showRightGroup,
      position: config.rightPosition,
      layout: config.rightLayout,
      showHistory: config.showHistory,
      showOverflow: config.showOverflow,
    },
    controls: {
      leftDetails: config.showLeftGroup,
      rightDetails: config.showRightGroup,
    },
  };
}

const PRESET_RECIPES: Record<CanvasToolbarBaseComponentsConfig['preset'], Partial<CanvasToolbarBaseComponentsConfig>> = {
  authoring: { showHistory: true, showZoom: true, showOverflow: true, showLeftGroup: true, showRightGroup: true },
  review: { showHistory: false, showZoom: true, showOverflow: true, showLeftGroup: false, showRightGroup: true },
  simulation: { showHistory: false, showZoom: false, showOverflow: false, showLeftGroup: true, showRightGroup: true },
};

export function applyCanvasToolbarPreset(
  config: CanvasToolbarBaseComponentsConfig,
  preset: CanvasToolbarBaseComponentsConfig['preset'],
): CanvasToolbarBaseComponentsConfig {
  return { ...config, preset, ...PRESET_RECIPES[preset] };
}

type CanvasToolbarBaseComponentsPreviewProps = {
  config: CanvasToolbarBaseComponentsConfig;
};

const CanvasToolbarBaseComponentsPreview: React.FC<CanvasToolbarBaseComponentsPreviewProps> = ({ config }) => {
  const model = resolveCanvasToolbarPreviewModel(config);
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const [secretsOpen, setSecretsOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [activity, setActivity] = useState('Choose a canvas action.');
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewSearch, setPreviewSearch] = useState('');

  const leftActions = [
    <AppButton key="orbit" intent={model.pressed ? 'toggle-on' : 'toggle-off'} size="sm" onClick={() => setActivity('360 view toggled.')} disabled={model.disabled}>
        <Sparkles className="h-3.5 w-3.5" /> 360
    </AppButton>,
    <AppButton key="toolbox" intent={toolboxOpen ? 'toggle-on' : 'toggle-off'} size="sm" onClick={() => setToolboxOpen((value) => !value)} disabled={model.disabled}>
        <Blocks className="h-3.5 w-3.5" /> Toolbox
    </AppButton>,
    <AppButton key="secrets" intent={secretsOpen ? 'toggle-on' : 'toggle-off'} size="sm" onClick={() => setSecretsOpen((value) => !value)} disabled={model.disabled}>
        <Lock className="h-3.5 w-3.5" /> Secrets
    </AppButton>,
  ].filter(Boolean);

  return (
    <div data-bc-preview-root="canvas-toolbar" className={cn(
      'relative min-h-0 flex-1 overflow-hidden bg-slate-100/80',
      model.viewport === 'tablet' && 'mx-auto w-full max-w-3xl',
      model.viewport === 'phone' && 'mx-auto w-full max-w-sm',
    )}>
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)',
          backgroundSize: '16px 16px',
        }}
      />

      {model.left.visible ? (
        <CanvasToolbar
          position={model.left.position}
          layout={model.left.layout}
          fullWidthButtons={model.left.fullWidthButtons}
          className={cn(
            model.attached && '!start-0 !top-0',
            model.viewport === 'phone' && 'max-w-[calc(100%-1rem)]',
            model.left.position === 'top-left' && !model.attached && '!top-14',
          )}
        >
          {model.left.reverseActions ? [...leftActions].reverse() : leftActions}
        </CanvasToolbar>
      ) : null}

      {model.right.visible ? (
        <CanvasToolbar
          position={model.right.position}
          layout={model.right.layout}
          className={cn(
            model.attached && '!end-0 !top-0',
          )}
        >
          {model.right.showHistory ? (
            <>
              <AppButton intent="utility" size="icon-sm" aria-label="Undo" onClick={() => setActivity('Undo applied.')} disabled={model.disabled}><Undo2 className="h-3.5 w-3.5" /></AppButton>
              <AppButton intent="utility" size="icon-sm" aria-label="Redo" onClick={() => setActivity('Redo applied.')} disabled={model.disabled}><Redo2 className="h-3.5 w-3.5" /></AppButton>
            </>
          ) : null}
          <AppButton
            intent={simulateOpen ? 'toggle-on' : 'toggle-off'}
            size="sm"
            onClick={() => setSimulateOpen((value) => !value)}
            disabled={model.disabled}
          >
            <Play className="h-3.5 w-3.5" /> Simulate
          </AppButton>
          {model.right.showOverflow ? <AppButton intent="utility" size="icon-sm" aria-label="More canvas actions" disabled={model.disabled} onClick={() => setActivity('More actions opened.')}><MoreHorizontal className="h-3.5 w-3.5" /></AppButton> : null}
        </CanvasToolbar>
      ) : null}

      <CanvasSearchBox
        value={previewSearch}
        onChange={(value) => {
          setPreviewSearch(value);
          setActivity(value ? `Search: ${value}` : 'Choose a canvas action.');
        }}
        placeholder="Search…"
        ariaLabel="Search canvas"
        disabled={model.disabled}
      />

      {model.left.showZoom ? (
        <div className={CANVAS_ZOOM_CONTROLS_ANCHOR_CLASS}>
          <CanvasViewportControls
            disabled={model.disabled}
            canZoomIn={previewZoom < 1.75}
            canZoomOut={previewZoom > 0.25}
            onZoomIn={() => {
              setPreviewZoom((current) => Math.min(1.75, current + 0.15));
              setActivity('Zoomed in.');
            }}
            onZoomOut={() => {
              setPreviewZoom((current) => Math.max(0.25, current - 0.15));
              setActivity('Zoomed out.');
            }}
            onFitView={() => {
              setPreviewZoom(1);
              setActivity('Fit view.');
            }}
          />
        </div>
      ) : null}

      <div className={CANVAS_LAYOUT_CONTROLS_ANCHOR_CLASS}>
        <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
          <AppButton
            type="button"
            intent="secondary"
            size="icon-sm"
            className="ring-1 ring-slate-300"
            disabled={model.disabled}
            aria-label="Horizontal layout"
            title="Horizontal layout"
            onClick={() => setActivity('Horizontal layout applied.')}
          >
            <Columns2 className="h-3.5 w-3.5" />
          </AppButton>
          <AppButton
            type="button"
            intent="utility"
            size="icon-sm"
            disabled={model.disabled}
            aria-label="Vertical layout"
            title="Vertical layout"
            onClick={() => setActivity('Vertical layout applied.')}
          >
            <Rows2 className="h-3.5 w-3.5" />
          </AppButton>
        </div>
      </div>

      <div className="flex h-full items-center justify-center p-3 text-xs text-slate-500">
        {activity}
      </div>
    </div>
  );
};

export const CanvasToolbarBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<CanvasToolbarBaseComponentsConfig>(DEFAULT_CANVAS_TOOLBAR_BASE_COMPONENTS_CONFIG);
  const configJson = useMemo(() => JSON.stringify({
    public: {
      edge: config.leftPosition,
      layout: config.leftLayout,
      width: config.leftFullWidthButtons ? 'full' : 'fit',
      presentation: config.presentation,
    },
    composition: {
      preset: config.preset,
      groups: { history: config.showHistory, zoom: config.showZoom, overflow: config.showOverflow },
      visibility: { left: config.showLeftGroup, right: config.showRightGroup },
      right: { edge: config.rightPosition, layout: config.rightLayout },
      reverseLeftActions: config.reverseGroups,
    },
    demo: { fixtures: { actions: config.preset }, scenarios: { state: config.state, viewport: config.viewport } },
  }, null, 2), [config]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="canvas-toolbar" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CANVAS_TOOLBAR_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Composition" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {([
                  ['Preset', 'preset', ['authoring', 'review', 'simulation']],
                  ['Presentation', 'presentation', ['floating', 'attached']],
                  ['State', 'state', ['default', 'disabled', 'pressed']],
                  ['Viewport', 'viewport', ['desktop', 'tablet', 'phone']],
                ] as const).map(([label, field, options]) => (
                  <FormField key={field} label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config[field]}
                      onChange={(event) => {
                        if (field === 'preset') {
                          const preset = event.target.value as CanvasToolbarBaseComponentsConfig['preset'];
                          setConfig((current) => applyCanvasToolbarPreset(current, preset));
                          return;
                        }
                        setConfig((current) => ({ ...current, [field]: event.target.value }));
                      }}
                      ariaLabel={label}
                    >
                      {options.map((value) => <option key={value} value={value}>{value}</option>)}
                    </UiSelect>
                  </FormField>
                ))}
                {([
                  ['History actions', 'showHistory'],
                  ['Viewport zoom', 'showZoom'],
                  ['Overflow action', 'showOverflow'],
                  ['Reverse left actions', 'reverseGroups'],
                ] as const).map(([label, field]) => (
                  <FormField key={field} label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config[field] ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, [field]: event.target.value === 'yes' }))} ariaLabel={label}>
                      <option value="yes">show</option><option value="no">hide</option>
                    </UiSelect>
                  </FormField>
                ))}
              </div>
            </FormSection>
            <FormSection title="Left group" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Visible" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showLeftGroup ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showLeftGroup: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Left group visibility"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField>

                {config.showLeftGroup ? <FormField label="Position" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.leftPosition}
                    onChange={(event) => {
                      const value = event.target.value as CanvasToolbarPosition;
                      if (POSITION_OPTIONS.includes(value)) {
                        setConfig((current) => ({ ...current, leftPosition: value }));
                      }
                    }}
                    ariaLabel="Left group position"
                  >
                    {POSITION_OPTIONS.map((position) => (
                      <option key={position} value={position}>{position}</option>
                    ))}
                  </UiSelect>
                </FormField> : null}

                {config.showLeftGroup ? <FormField label="Layout" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.leftLayout}
                    onChange={(event) => {
                      const value = event.target.value as CanvasToolbarLayout;
                      if (LAYOUT_OPTIONS.includes(value)) {
                        setConfig((current) => ({ ...current, leftLayout: value }));
                      }
                    }}
                    ariaLabel="Left group layout"
                  >
                    {LAYOUT_OPTIONS.map((layout) => (
                      <option key={layout} value={layout}>{layout}</option>
                    ))}
                  </UiSelect>
                </FormField> : null}

                {config.showLeftGroup ? <FormField label="Full-width buttons" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.leftFullWidthButtons ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        leftFullWidthButtons: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Left group full width buttons"
                  >
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </UiSelect>
                </FormField> : null}
              </div>
            </FormSection>

            <FormSection title="Right group" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Visible" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showRightGroup ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showRightGroup: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Right group visibility"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField>

                {config.showRightGroup ? <FormField label="Position" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.rightPosition}
                    onChange={(event) => {
                      const value = event.target.value as CanvasToolbarPosition;
                      if (POSITION_OPTIONS.includes(value)) {
                        setConfig((current) => ({ ...current, rightPosition: value }));
                      }
                    }}
                    ariaLabel="Right group position"
                  >
                    {POSITION_OPTIONS.map((position) => (
                      <option key={position} value={position}>{position}</option>
                    ))}
                  </UiSelect>
                </FormField> : null}

                {config.showRightGroup ? <FormField label="Layout" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.rightLayout}
                    onChange={(event) => {
                      const value = event.target.value as CanvasToolbarLayout;
                      if (LAYOUT_OPTIONS.includes(value)) {
                        setConfig((current) => ({ ...current, rightLayout: value }));
                      }
                    }}
                    ariaLabel="Right group layout"
                  >
                    {LAYOUT_OPTIONS.map((layout) => (
                      <option key={layout} value={layout}>{layout}</option>
                    ))}
                  </UiSelect>
                </FormField> : null}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="canvas-toolbar">
          <CanvasToolbarBaseComponentsPreview config={config} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
