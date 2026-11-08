import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  UiAudioPlayer,
  UiSelect,
  UiVideoPlayer,
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

export type MediaPlayersBaseComponentsConfig = {
  kind: 'video' | 'audio';
  controls: boolean;
  loop: boolean;
  showCaptions: boolean;
  showWaveform: boolean;
  playbackSpeedControl: boolean;
};

const DEFAULT_CONFIG: MediaPlayersBaseComponentsConfig = {
  kind: 'video',
  controls: true,
  loop: false,
  showCaptions: false,
  showWaveform: true,
  playbackSpeedControl: true,
};

export const resolveMediaPlayersOptionLiveness = (config: MediaPlayersBaseComponentsConfig) => ({
  visibleOptions: [
    'kind',
    ...(config.kind === 'video' ? ['controls', 'showCaptions'] : ['showWaveform', 'playbackSpeedControl']),
    'loop',
  ],
  playerProps: {
    kind: config.kind,
    loop: config.loop,
    controls: config.kind === 'video' ? config.controls : true,
    showCaptions: config.kind === 'video' ? config.showCaptions : false,
    showWaveform: config.kind === 'audio' ? config.showWaveform : false,
    playbackSpeedControl: config.kind === 'audio' ? config.playbackSpeedControl : false,
  },
});

export const MediaPlayersBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<MediaPlayersBaseComponentsConfig>(DEFAULT_CONFIG);
  const liveness = resolveMediaPlayersOptionLiveness(config);
  const configJson = useMemo(() => JSON.stringify(liveness.playerProps, null, 2), [liveness]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="media-players" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Media players" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Kind" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.kind} onChange={(event) => setConfig((current) => ({ ...current, kind: event.target.value as MediaPlayersBaseComponentsConfig['kind'] }))} ariaLabel="Player kind">
                    <option value="video">video</option>
                    <option value="audio">audio</option>
                  </UiSelect>
                </FormField>
                {liveness.visibleOptions.includes('controls') ? (
                  <FormField label="Controls" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.controls ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, controls: event.target.value === 'yes' }))} ariaLabel="Controls">
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                <FormField label="Loop" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.loop ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, loop: event.target.value === 'yes' }))} ariaLabel="Loop">
                    <option value="no">no</option>
                    <option value="yes">yes</option>
                  </UiSelect>
                </FormField>
                {liveness.visibleOptions.includes('showCaptions') ? (
                  <FormField label="Captions" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.showCaptions ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, showCaptions: event.target.value === 'yes' }))} ariaLabel="Captions">
                      <option value="no">no</option>
                      <option value="yes">yes</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                {liveness.visibleOptions.includes('showWaveform') ? (
                  <FormField label="Waveform" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.showWaveform ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, showWaveform: event.target.value === 'yes' }))} ariaLabel="Waveform">
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                {liveness.visibleOptions.includes('playbackSpeedControl') ? (
                  <FormField label="Speed control" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.playbackSpeedControl ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, playbackSpeedControl: event.target.value === 'yes' }))} ariaLabel="Speed control">
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </UiSelect>
                  </FormField>
                ) : null}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="media-players">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'max-w-xl')}>
            {config.kind === 'video' ? (
              <UiVideoPlayer
                controls={liveness.playerProps.controls}
                loop={liveness.playerProps.loop}
                showCaptions={liveness.playerProps.showCaptions}
                poster=""
              />
            ) : (
              <UiAudioPlayer
                loop={liveness.playerProps.loop}
                showWaveform={liveness.playerProps.showWaveform}
                playbackSpeedControl={liveness.playerProps.playbackSpeedControl}
              />
            )}
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
