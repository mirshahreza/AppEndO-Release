import * as React from 'react';
import { Info, Settings2, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AppButton, FormField, FormSection, UiInput, UiSelect, UiTooltip } from '../../../shared/ui';
import { ShellResponsivePopover } from '../../../shared/ui/shell-foundation/ShellResponsivePopover';
import { BaseComponentsConfigToolbarControls, BaseComponentsResetButton } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
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

export type PopoverTooltipBaseComponentsConfig = {
  pattern: 'tooltip' | 'informational-popover' | 'interactive-popover' | 'picker-popover';
  placement: 'top' | 'bottom' | 'start' | 'end';
  alignment: 'start' | 'center' | 'end';
  trigger: 'button' | 'icon-button' | 'field' | 'text';
  dismiss: 'escape,outside' | 'escape,outside,blur' | 'escape';
  delay: 0 | 300 | 500 | 800;
  collision: boolean;
  state: 'closed' | 'open' | 'disabled';
};

export const DEFAULT_POPOVER_TOOLTIP_BASE_COMPONENTS_CONFIG: PopoverTooltipBaseComponentsConfig = {
  pattern: 'tooltip',
  placement: 'top',
  alignment: 'center',
  trigger: 'icon-button',
  dismiss: 'escape,outside',
  delay: 500,
  collision: true,
  state: 'open',
};

export function applyPopoverTooltipOption(
  config: PopoverTooltipBaseComponentsConfig,
  key: keyof PopoverTooltipBaseComponentsConfig,
  value: string,
): PopoverTooltipBaseComponentsConfig {
  return {
    ...config,
    [key]: key === 'delay' ? Number(value) : key === 'collision' ? value === 'true' : value,
    ...(key === 'pattern' && value !== 'tooltip' && (config.placement === 'start' || config.placement === 'end')
      ? { placement: 'bottom' as const }
      : {}),
    ...(key === 'pattern' && value !== 'tooltip' && config.alignment === 'center'
      ? { alignment: 'start' as const }
      : {}),
  } as PopoverTooltipBaseComponentsConfig;
}

export function resolvePopoverTooltipPreviewModel(config: PopoverTooltipBaseComponentsConfig) {
  const tooltip = config.pattern === 'tooltip';
  const side = config.placement === 'start' ? 'left' : config.placement === 'end' ? 'right' : config.placement;
  const tooltipAlignment = config.alignment === 'center'
    ? ''
    : config.placement === 'start' || config.placement === 'end'
      ? ` ${config.alignment === 'start' ? 'top' : 'bottom'}`
      : ` ${config.alignment}`;
  const popoverPlacement = `${config.placement === 'top' ? 'top' : 'bottom'}-${config.alignment === 'end' ? 'end' : 'start'}` as const;
  return {
    root: 'popover-tooltip',
    component: tooltip ? 'UiTooltip' : 'ShellResponsivePopover',
    pattern: config.pattern,
    trigger: config.trigger,
    disabled: config.state === 'disabled',
    controlledOpen: config.state === 'open',
    placement: tooltip ? `${side}${tooltipAlignment}` : popoverPlacement,
    fallbackPlacement: tooltip || !config.collision
      ? null
      : popoverPlacement.startsWith('top') ? 'bottom-start' : 'top-start',
    shouldFlip: config.collision,
    delay: tooltip ? config.delay : null,
    dismissOnOutside: !tooltip && config.dismiss.includes('outside'),
    dismissOnBlur: !tooltip && config.dismiss.includes('blur'),
    controls: {
      delay: tooltip,
      dismiss: !tooltip,
      sidePlacement: tooltip,
      centerAlignment: tooltip,
    },
    content: config.pattern === 'picker-popover' ? 'picker' : config.pattern === 'interactive-popover' ? 'action' : 'information',
  };
}

const OPTIONS: { label: string; key: keyof PopoverTooltipBaseComponentsConfig; values: readonly string[] }[] = [
  { label: 'Pattern', key: 'pattern', values: ['tooltip', 'informational-popover', 'interactive-popover', 'picker-popover'] },
  { label: 'Placement', key: 'placement', values: ['top', 'bottom', 'start', 'end'] },
  { label: 'Alignment', key: 'alignment', values: ['start', 'center', 'end'] },
  { label: 'Trigger', key: 'trigger', values: ['button', 'icon-button', 'field', 'text'] },
  { label: 'Dismiss policy', key: 'dismiss', values: ['escape,outside', 'escape,outside,blur', 'escape'] },
  { label: 'Delay', key: 'delay', values: ['0', '300', '500', '800'] },
  { label: 'Collision flip', key: 'collision', values: ['true', 'false'] },
  { label: 'State', key: 'state', values: ['closed', 'open', 'disabled'] },
];

export const PopoverTooltipBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_POPOVER_TOOLTIP_BASE_COMPONENTS_CONFIG);
  const previewModel = resolvePopoverTooltipPreviewModel(config);
  const [open, setOpen] = React.useState(DEFAULT_POPOVER_TOOLTIP_BASE_COMPONENTS_CONFIG.state === 'open');
  const [region, setRegion] = React.useState('West Europe');
  React.useEffect(() => setOpen(config.state === 'open'), [config.state, config.pattern]);

  const json = React.useMemo(() => JSON.stringify({
    public: {
      placement: config.placement,
      align: config.alignment,
      dismissPolicy: config.dismiss.split(','),
      delay: config.delay,
      shouldFlip: config.collision,
    },
    composition: {
      contentKind: config.pattern === 'tooltip' ? 'plain-text' : 'react-content',
    },
    demo: { pattern: config.pattern, trigger: config.trigger, state: config.state },
  }, null, 2), [config]);

  const setOption = (key: keyof PopoverTooltipBaseComponentsConfig, value: string) => {
    setConfig((current) => applyPopoverTooltipOption(current, key, value));
  };

  const trigger = config.trigger === 'field' ? (
    <UiInput
      size="sm"
      value="Deployment region"
      readOnly
      ariaLabel="Open deployment guidance"
      disabled={config.state === 'disabled'}
      className="w-48 cursor-pointer"
    />
  ) : (
    <AppButton
      type="button"
      intent="utility"
      size={config.trigger === 'icon-button' ? 'icon-sm' : 'sm'}
      disabled={config.state === 'disabled'}
    >
      {config.trigger === 'icon-button' ? <Info className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
      {config.trigger === 'icon-button' ? <span className="sr-only">Open guidance</span> : config.trigger === 'text' ? 'Deployment guidance' : 'Delivery settings'}
    </AppButton>
  );

  const tooltipPlacement = previewModel.placement as React.ComponentProps<typeof UiTooltip>['placement'];
  const popoverPlacement = previewModel.placement as 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="popover-tooltip" json={json}>
          <BaseComponentsResetButton onClick={() => { setConfig(DEFAULT_POPOVER_TOOLTIP_BASE_COMPONENTS_CONFIG); setOpen(true); }} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Overlay" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {OPTIONS.filter((option) => (
                  (config.pattern === 'tooltip' || option.key !== 'delay')
                  && (config.pattern !== 'tooltip' || option.key !== 'dismiss')
                )).map((option) => {
                  const values = option.key === 'placement' && config.pattern !== 'tooltip'
                    ? ['top', 'bottom']
                    : option.key === 'alignment' && config.pattern !== 'tooltip'
                      ? ['start', 'end']
                    : option.values;
                  return (
                  <FormField key={option.key} label={option.label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={String(config[option.key])}
                      onChange={(event) => setOption(option.key, event.target.value)}
                      ariaLabel={option.label}
                    >
                      {values.map((value) => <option key={value} value={value}>{value}</option>)}
                    </UiSelect>
                  </FormField>
                  );
                })}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="popover-tooltip" fill>
          <div data-bc-preview-root="popover-tooltip" className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'h-full items-center justify-center')}>
            <div className="flex min-h-64 w-full max-w-lg items-center justify-center rounded-lg border border-slate-200 bg-slate-50/60">
              {previewModel.component === 'UiTooltip' ? (
                <UiTooltip
                  content="Changes apply to the next deployment."
                  placement={tooltipPlacement}
                  delay={config.delay}
                  shouldFlip={config.collision}
                  isOpen={config.state === 'open' ? true : undefined}
                  disabled={config.state === 'disabled'}
                >
                  {trigger}
                </UiTooltip>
              ) : (
                <ShellResponsivePopover
                  open={open}
                  onOpenChange={setOpen}
                  trigger={trigger}
                  placement={popoverPlacement}
                  fallbackPlacement={previewModel.fallbackPlacement ?? popoverPlacement}
                  dismissOnOutside={previewModel.dismissOnOutside}
                  dismissOnEscape
                  dismissOnBlur={previewModel.dismissOnBlur}
                  ariaLabel="Deployment guidance"
                  className="w-72 p-3"
                >
                  <div className="flex items-start gap-2">
                    <SlidersHorizontal className="mt-0.5 h-4 w-4 text-violet-600" />
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Deployment guidance</h2>
                      <p className="mt-1 text-xs text-slate-600">Choose a region close to the primary data source.</p>
                      {config.pattern === 'picker-popover' ? (
                        <UiSelect size="sm" className="mt-3" value={region} onChange={(event) => setRegion(event.target.value)} ariaLabel="Recommended deployment region">
                          <option>West Europe</option>
                          <option>North Europe</option>
                          <option>East US</option>
                        </UiSelect>
                      ) : null}
                      {config.pattern === 'interactive-popover' ? (
                        <AppButton className="mt-3" intent="primary" size="sm" onClick={() => setOpen(false)}>
                          <Settings2 className="h-3.5 w-3.5" /> Apply recommendation
                        </AppButton>
                      ) : null}
                    </div>
                  </div>
                </ShellResponsivePopover>
              )}
            </div>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
