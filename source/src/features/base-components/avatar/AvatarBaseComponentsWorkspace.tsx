import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  UiAvatar,
  UiInput,
  UiSelect,
  type UiAvatarColor,
  type UiAvatarSize,
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

const SIZE_OPTIONS: UiAvatarSize[] = ['sm', 'md', 'lg'];
const COLOR_OPTIONS: UiAvatarColor[] = ['default', 'accent', 'success', 'warning', 'danger'];

export type AvatarBaseComponentsConfig = {
  source: 'image' | 'initials' | 'icon';
  size: UiAvatarSize;
  color: UiAvatarColor;
  initials: string;
  group: 'single' | 'group' | 'stack';
  presence: 'none' | 'online' | 'away' | 'busy' | 'offline';
  shape: 'circle' | 'rounded';
  bordered: boolean;
  state: 'default' | 'image-loading' | 'image-error' | 'disabled';
  maxVisible: number;
};

const DEFAULT_CONFIG: AvatarBaseComponentsConfig = {
  source: 'initials',
  size: 'md',
  color: 'accent',
  initials: 'AM',
  group: 'single',
  presence: 'online',
  shape: 'circle',
  bordered: false,
  state: 'default',
  maxVisible: 4,
};

const AVATAR_IMAGE = 'https://i.pravatar.cc/160?img=12';
const GROUP_MEMBERS = ['AM', 'JD', 'RK', 'SL', 'TN', 'EV'];
const PRESENCE_CLASS: Record<Exclude<AvatarBaseComponentsConfig['presence'], 'none'>, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-400',
  busy: 'bg-rose-500',
  offline: 'bg-slate-400',
};

export const resolveAvatarPreviewModel = (config: AvatarBaseComponentsConfig) => {
  const members = config.group === 'single'
    ? [config.initials]
    : [config.initials, ...GROUP_MEMBERS.slice(1)].slice(0, config.maxVisible);
  return {
    members,
    controls: {
      initials: config.source === 'initials',
      imageState: config.source === 'image',
      maxVisible: config.group !== 'single',
    },
    avatarProps: members.map((fallback, index) => ({
      size: config.size,
      color: config.color,
      src: config.source === 'image' && config.state !== 'image-loading'
        ? config.state === 'image-error' ? '/missing-avatar.png' : `${AVATAR_IMAGE}&member=${index}`
        : undefined,
      alt: config.source === 'image' ? `Team member ${index + 1}` : '',
      fallback: config.source === 'icon' ? '●' : fallback,
      className: cn(
        config.source === 'image' && config.state === 'image-loading' && 'animate-pulse',
        config.shape === 'rounded' && 'rounded-lg',
        config.bordered && 'ring-2 ring-offset-1 ring-slate-300',
      ) || undefined,
      disabled: config.source === 'image' && config.state === 'disabled',
    })),
  };
};

export const exportAvatarBaseComponentsConfig = (config: AvatarBaseComponentsConfig) => ({
  source: config.source,
  size: config.size,
  color: config.color,
  ...(config.source === 'initials' ? { initials: config.initials } : {}),
  group: config.group,
  shape: config.shape,
  bordered: config.bordered,
  presence: config.presence,
  ...(config.source === 'image' ? { imageState: config.state } : {}),
  ...(config.group === 'single' ? {} : { maxVisible: config.maxVisible }),
});

export const AvatarBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<AvatarBaseComponentsConfig>(DEFAULT_CONFIG);
  const configJson = useMemo(() => JSON.stringify(exportAvatarBaseComponentsConfig(config), null, 2), [config]);
  const previewModel = resolveAvatarPreviewModel(config);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="avatar" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Avatar" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Source" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.source} onChange={(event) => setConfig((current) => ({ ...current, source: event.target.value as AvatarBaseComponentsConfig['source'], state: 'default' }))} ariaLabel="Avatar source">
                    <option value="image">image</option><option value="initials">initials</option><option value="icon">icon</option>
                  </UiSelect>
                </FormField>
                <FormField label="Size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.size}
                    onChange={(event) => setConfig((current) => ({ ...current, size: event.target.value as UiAvatarSize }))}
                    ariaLabel="Avatar size"
                  >
                    {SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField label="Color" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.color}
                    onChange={(event) => setConfig((current) => ({ ...current, color: event.target.value as UiAvatarColor }))}
                    ariaLabel="Avatar color"
                  >
                    {COLOR_OPTIONS.map((color) => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </UiSelect>
                </FormField>

                {previewModel.controls.initials ? <FormField label="Initials" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    maxLength={2}
                    value={config.initials}
                    onChange={(event) => setConfig((current) => ({ ...current, initials: event.target.value.toUpperCase() }))}
                  />
                </FormField> : null}
                <FormField label="Shape" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.shape} onChange={(event) => setConfig((current) => ({ ...current, shape: event.target.value as AvatarBaseComponentsConfig['shape'] }))} ariaLabel="Avatar shape">
                    <option value="circle">circle</option><option value="rounded">rounded</option>
                  </UiSelect>
                </FormField>
                <FormField label="Bordered" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.bordered ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, bordered: event.target.value === 'yes' }))} ariaLabel="Avatar bordered">
                    <option value="no">off</option><option value="yes">on</option>
                  </UiSelect>
                </FormField>
                <FormField label="Group" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.group} onChange={(event) => setConfig((current) => ({ ...current, group: event.target.value as AvatarBaseComponentsConfig['group'] }))} ariaLabel="Avatar group mode">
                    <option value="single">single</option><option value="group">group</option><option value="stack">stacked group</option>
                  </UiSelect>
                </FormField>
                <FormField label="Presence" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.presence} onChange={(event) => setConfig((current) => ({ ...current, presence: event.target.value as AvatarBaseComponentsConfig['presence'] }))} ariaLabel="Avatar presence">
                    {['none', 'online', 'away', 'busy', 'offline'].map((presence) => <option key={presence} value={presence}>{presence}</option>)}
                  </UiSelect>
                </FormField>
                {previewModel.controls.imageState ? <FormField label="Image state" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state} onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as AvatarBaseComponentsConfig['state'] }))} ariaLabel="Avatar image state">
                    {['default', 'image-loading', 'image-error', 'disabled'].map((state) => <option key={state} value={state}>{state}</option>)}
                  </UiSelect>
                </FormField> : null}
                {previewModel.controls.maxVisible ? <FormField label="Maximum visible" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.maxVisible)} onChange={(event) => setConfig((current) => ({ ...current, maxVisible: Number(event.target.value) }))} ariaLabel="Maximum visible avatars">
                    {[2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}</option>)}
                  </UiSelect>
                </FormField> : null}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="avatar">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'gap-4')}>
            <div className={cn('flex items-center', config.group === 'stack' ? '-space-x-2 rtl:space-x-reverse' : 'gap-2')}>
              {previewModel.avatarProps.map((avatarProps, index) => (
                <div key={`${avatarProps.fallback}-${index}`} className={cn('relative', avatarProps.disabled && 'opacity-45')}>
                  <UiAvatar
                    size={avatarProps.size}
                    color={avatarProps.color}
                    src={avatarProps.src}
                    alt={avatarProps.alt}
                    fallback={avatarProps.fallback}
                    className={avatarProps.className}
                  />
                  {config.presence !== 'none' ? <span className={cn('absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full border-2 border-white', PRESENCE_CLASS[config.presence])} aria-label={config.presence} /> : null}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">Image, initials, and icon fallbacks share the same group, presence, loading, and error recipes.</p>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
