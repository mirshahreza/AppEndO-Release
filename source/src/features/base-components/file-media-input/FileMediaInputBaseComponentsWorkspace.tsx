import * as React from 'react';
import { cn } from '../../../lib/utils';
import { FormField, FormSection, UiSelect } from '../../../shared/ui';
import {
  FileMediaInput,
  type FileMediaInputState,
} from '../../../shared/ui/file-media-input/FileMediaInput';
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

export type FileMediaInputBaseComponentsConfig = {
  preset: 'button' | 'drop-zone' | 'image' | 'avatar' | 'queue';
  multiple: boolean;
  accept: 'any' | 'images' | 'documents' | 'audio-video';
  limits: 'safe-defaults' | 'single-small' | 'media-large';
  preview: boolean;
  queueActions: 'retry,cancel,remove' | 'cancel,remove' | 'remove';
  transform: 'none' | 'image-optimize' | 'crop';
  state: FileMediaInputState;
  enableImageEditor: boolean;
  openEditorOnPick: boolean;
};

const DEFAULT_CONFIG: FileMediaInputBaseComponentsConfig = {
  preset: 'drop-zone',
  multiple: false,
  accept: 'images',
  limits: 'safe-defaults',
  preview: true,
  queueActions: 'retry,cancel,remove',
  transform: 'none',
  state: 'default',
  enableImageEditor: true,
  openEditorOnPick: false,
};

const OPTIONS: { label: string; key: keyof FileMediaInputBaseComponentsConfig; values: readonly string[] }[] = [
  { label: 'Preset', key: 'preset', values: ['button', 'drop-zone', 'image', 'avatar', 'queue'] },
  { label: 'Multiple files', key: 'multiple', values: ['false', 'true'] },
  { label: 'Accepted types', key: 'accept', values: ['any', 'images', 'documents', 'audio-video'] },
  { label: 'Limits', key: 'limits', values: ['safe-defaults', 'single-small', 'media-large'] },
  { label: 'Preview', key: 'preview', values: ['true', 'false'] },
  { label: 'Queue actions', key: 'queueActions', values: ['retry,cancel,remove', 'cancel,remove', 'remove'] },
  { label: 'Transform', key: 'transform', values: ['none', 'image-optimize', 'crop'] },
  { label: 'State', key: 'state', values: ['default', 'dragging', 'rejected', 'uploading', 'success', 'error'] },
  { label: 'Image editor', key: 'enableImageEditor', values: ['true', 'false'] },
  { label: 'Open editor on pick', key: 'openEditorOnPick', values: ['true', 'false'] },
];

const ACCEPT_BY_KIND: Record<FileMediaInputBaseComponentsConfig['accept'], string | undefined> = {
  any: undefined,
  images: 'image/*',
  documents: '.pdf,.doc,.docx,.txt',
  'audio-video': 'audio/*,video/*',
};

export const applyFileMediaInputOption = (
  current: FileMediaInputBaseComponentsConfig,
  key: keyof FileMediaInputBaseComponentsConfig,
  value: string,
): FileMediaInputBaseComponentsConfig => {
  const next = {
    ...current,
    [key]: key === 'multiple' || key === 'preview' || key === 'enableImageEditor' || key === 'openEditorOnPick'
      ? value === 'true'
      : value,
  } as FileMediaInputBaseComponentsConfig;
  if (key === 'preset' && (value === 'image' || value === 'avatar')) {
    next.multiple = false;
    next.accept = 'images';
    next.preview = true;
  }
  if (key === 'accept' && (value === 'documents' || value === 'audio-video')) {
    next.preview = false;
  }
  if (key === 'limits' && value === 'single-small') next.multiple = false;
  if (key === 'multiple' && value === 'true' && next.limits === 'single-small') {
    next.limits = 'safe-defaults';
  }
  return next;
};

export const resolveFileMediaInputOptionLiveness = (
  config: FileMediaInputBaseComponentsConfig,
) => {
  const limits = config.limits === 'single-small'
    ? { maxCount: 1, maxSizeMb: 2 }
    : config.limits === 'media-large'
      ? { maxCount: 10, maxSizeMb: 100 }
      : { maxCount: 5, maxSizeMb: 10 };
  const imagePreset = config.preset === 'image' || config.preset === 'avatar';
  return {
    visibleOptions: [
      'preset',
      ...(!imagePreset && config.limits !== 'single-small' ? ['multiple'] : []),
      ...(!imagePreset ? ['accept'] : []),
      'limits',
      ...(!imagePreset && config.accept !== 'documents' && config.accept !== 'audio-video'
        ? ['preview']
        : []),
      ...(config.preset === 'queue' ? ['queueActions'] : []),
      ...(imagePreset ? ['enableImageEditor', 'openEditorOnPick'] : []),
      'transform',
      'state',
    ],
    primitiveProps: {
      preset: config.preset,
      state: config.state,
      multiple: config.multiple,
      accept: ACCEPT_BY_KIND[config.accept],
      ...limits,
      showPreview: config.preview,
      queueActions: config.preset === 'queue'
        ? config.queueActions.split(',') as Array<'retry' | 'cancel' | 'remove'>
        : ['remove'] as const,
      enableImageEditor: config.enableImageEditor,
      openEditorOnPick: config.openEditorOnPick,
    },
    transform: config.transform,
  };
};

export const FileMediaInputBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_CONFIG);
  const [files, setFiles] = React.useState<File[]>([]);

  const setOption = (key: keyof FileMediaInputBaseComponentsConfig, value: string) => {
    setConfig((current) => applyFileMediaInputOption(current, key, value));
  };
  const optionLiveness = resolveFileMediaInputOptionLiveness(config);
  const limits = {
    maxCount: optionLiveness.primitiveProps.maxCount,
    maxSizeMb: optionLiveness.primitiveProps.maxSizeMb,
  };
  const json = React.useMemo(() => JSON.stringify({
    public: {
      allowsMultiple: config.multiple,
      acceptedFileTypes: ACCEPT_BY_KIND[config.accept] ?? '*/*',
      ...limits,
      showPreview: config.preview,
    },
    composition: {
      preset: config.preset,
      queueActions: config.queueActions.split(','),
      transform: config.transform,
    },
    demo: { state: config.state, localOnly: true, selectedFileNames: files.map((file) => file.name) },
  }, null, 2), [config, files, limits]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="file-media-input" json={json}>
          <BaseComponentsResetButton onClick={() => { setConfig(DEFAULT_CONFIG); setFiles([]); }} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="File input" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {OPTIONS.filter((option) => optionLiveness.visibleOptions.includes(option.key)).map((option) => (
                  <FormField key={option.key} label={option.label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={String(config[option.key])}
                      onChange={(event) => setOption(option.key, event.target.value)}
                      ariaLabel={option.label}
                    >
                      {option.values.map((value) => <option key={value} value={value}>{value}</option>)}
                    </UiSelect>
                  </FormField>
                ))}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="file-media-input">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'items-center justify-center')}>
            <div className="flex w-full max-w-lg flex-col items-center gap-2">
              {config.transform !== 'none' ? (
                <p className="text-[11px] text-slate-500" data-bc-file-transform={config.transform}>
                  {config.transform === 'crop' ? 'Crop selected images before upload.' : 'Optimize images before upload.'}
                </p>
              ) : null}
              <FileMediaInput
                {...optionLiveness.primitiveProps}
                files={files}
                onFilesChange={setFiles}
                onStateChange={(state) => setConfig((current) => ({ ...current, state }))}
              />
            </div>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
