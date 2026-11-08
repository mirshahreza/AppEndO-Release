import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, RotateCcw, Undo2, X } from 'lucide-react';
import {
  AppButton,
  AppToast,
  FormField,
  FormSection,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import type { AppToastType } from '../../../shared/ui/AppToast';
import { APP_TOAST_TYPES } from '../../../shared/ui/AppToast';
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
  BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
} from '../baseComponentsConfiguratorLayout';

export type ToastBaseComponentsConfig = {
  type: AppToastType;
  title: string;
  message: string;
  duration: 'persistent' | 3000 | 5000 | 8000;
  dismissible: boolean;
  action: boolean;
  lifecycle: 'static' | 'promise';
  position: 'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end';
  stack: number;
  state: 'entering' | 'visible' | 'paused' | 'updated' | 'exiting';
};

const DEFAULT_CONFIG: ToastBaseComponentsConfig = {
  type: 'success',
  title: 'Published',
  message: 'Changes saved successfully.',
  duration: 5000,
  dismissible: true,
  action: true,
  lifecycle: 'static',
  position: 'top-end',
  stack: 1,
  state: 'visible',
};

type ToastBaseComponentsPreviewProps = {
  config: ToastBaseComponentsConfig;
  visible: boolean;
};

export const resolveToastPreviewTitle = (config: ToastBaseComponentsConfig) =>
  config.lifecycle === 'promise'
    ? config.state === 'entering'
      ? 'Publishing…'
      : config.state === 'updated'
        ? `${config.title} · updated`
        : `${config.title} · resolved`
    : config.title;

export const resolveToastPreviewModel = (config: ToastBaseComponentsConfig) => ({
  appToastProps: { type: config.type, text: config.message },
  title: resolveToastPreviewTitle(config),
  dismissible: config.dismissible,
  actionVisible: config.action,
  stackCount: config.stack,
  alignment: config.position.includes('center') ? 'center' : config.position.includes('end') ? 'end' : 'start',
  edge: config.position.includes('bottom') ? 'bottom' : 'top',
  autoDismissMs: config.duration === 'persistent' ? null : config.duration,
  state: config.state,
});

const ToastBaseComponentsPreview: React.FC<ToastBaseComponentsPreviewProps & { onDismiss: () => void }> = ({ config, visible, onDismiss }) => {
  const model = resolveToastPreviewModel(config);
  return <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'relative min-h-[320px]', model.edge === 'bottom' ? 'justify-end' : 'justify-start', model.alignment === 'center' ? 'items-center' : model.alignment === 'end' ? 'items-end' : 'items-start')}>
    <p className="absolute start-4 top-3 text-xs text-slate-500">Viewport simulation · {config.duration === 'persistent' ? 'persistent' : `${config.duration} ms`} · {config.state}</p>
    {visible ? <div className="flex max-w-sm flex-col gap-2 pt-7">{Array.from({ length: model.stackCount }, (_, index) => (
      <div key={index} data-toast-state={config.state} className={cn('rounded-lg border border-slate-200 bg-white p-2 shadow-md transition-all', config.state === 'entering' && 'translate-y-2 opacity-60', config.state === 'paused' && 'ring-2 ring-amber-200', config.state === 'updated' && 'ring-2 ring-indigo-200', config.state === 'exiting' && 'translate-y-1 opacity-40')}>
        <div className="mb-1 flex items-center justify-between gap-2"><strong className="text-xs text-slate-800">{model.title}</strong>{model.dismissible ? <AppButton intent="utility" size="sm" aria-label="Dismiss toast" onClick={onDismiss}><X className="h-3.5 w-3.5" /></AppButton> : null}</div>
        <AppToast {...model.appToastProps} />
        {model.actionVisible ? <AppButton intent="utility" size="sm" className="mt-1"><Undo2 className="h-3.5 w-3.5" />Undo</AppButton> : null}
      </div>
    ))}</div> : null}
  </div>;
};

export const ToastBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<ToastBaseComponentsConfig>(DEFAULT_CONFIG);
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const configJson = useMemo(() => JSON.stringify(config, null, 2), [config]);

  useEffect(() => () => {
    if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
    if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
  }, []);

  const showToast = () => {
    if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
    if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
    setVisible(false);
    showTimerRef.current = window.setTimeout(() => {
      setVisible(true);
      showTimerRef.current = null;
    }, 0);
    if (config.duration !== 'persistent') {
      dismissTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        dismissTimerRef.current = null;
      }, config.duration);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="toast" json={configJson}>
          <BaseComponentsResetButton onClick={() => {
            setConfig(DEFAULT_CONFIG);
            setVisible(false);
          }} />
          <AppButton intent="primary" size="sm" onClick={showToast}>
            <Bell className="h-3.5 w-3.5" />
            Show toast
          </AppButton>
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Feedback" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Type" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.type}
                    onChange={(event) => {
                      const value = event.target.value as AppToastType;
                      if (APP_TOAST_TYPES.includes(value)) {
                        setConfig((current) => ({ ...current, type: value }));
                      }
                    }}
                    ariaLabel="Toast type"
                  >
                    {APP_TOAST_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField label="Message" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={config.message}
                    onChange={(event) => setConfig((current) => ({ ...current, message: event.target.value }))}
                  />
                </FormField>
                <FormField label="Title" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS} value={config.title} onChange={(event) => setConfig((current) => ({ ...current, title: event.target.value }))} />
                </FormField>
                <FormField label="Duration" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.duration)} onChange={(event) => setConfig((current) => ({ ...current, duration: event.target.value === 'persistent' ? 'persistent' : Number(event.target.value) as 3000 | 5000 | 8000 }))} ariaLabel="Toast duration">
                    <option value="persistent">persistent</option><option value="3000">3000 ms</option><option value="5000">5000 ms</option><option value="8000">8000 ms</option>
                  </UiSelect>
                </FormField>
                <FormField label="Lifecycle" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.lifecycle} onChange={(event) => setConfig((current) => ({ ...current, lifecycle: event.target.value as ToastBaseComponentsConfig['lifecycle'] }))} ariaLabel="Toast lifecycle">
                    <option value="static">static</option><option value="promise">promise</option>
                  </UiSelect>
                </FormField>
                <FormField label="Position" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.position} onChange={(event) => setConfig((current) => ({ ...current, position: event.target.value as ToastBaseComponentsConfig['position'] }))} ariaLabel="Toast position">
                    {['top-start', 'top-center', 'top-end', 'bottom-start', 'bottom-center', 'bottom-end'].map((position) => <option key={position} value={position}>{position}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="Stack count" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.stack)} onChange={(event) => setConfig((current) => ({ ...current, stack: Number(event.target.value) }))} ariaLabel="Toast stack count">
                    {[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state} onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as ToastBaseComponentsConfig['state'] }))} ariaLabel="Toast state">
                    {['entering', 'visible', 'paused', 'updated', 'exiting'].map((state) => <option key={state} value={state}>{state}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="Controls" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <div className="flex flex-wrap gap-2">
                    <AppButton intent={config.dismissible ? 'primary' : 'secondary'} size="sm" onClick={() => setConfig((current) => ({ ...current, dismissible: !current.dismissible }))}><X className="h-3.5 w-3.5" />Dismissible</AppButton>
                    <AppButton intent={config.action ? 'primary' : 'secondary'} size="sm" onClick={() => setConfig((current) => ({ ...current, action: !current.action }))}><RotateCcw className="h-3.5 w-3.5" />Action</AppButton>
                  </div>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="toast">
          <ToastBaseComponentsPreview config={config} visible={visible} onDismiss={() => setVisible(false)} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
