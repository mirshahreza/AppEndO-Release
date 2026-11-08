import * as React from 'react';
import { FilePlus2, FilterX, FolderOpen, ListRestart, SearchX, ShieldX } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  FormField,
  FormSection,
  LoadingSpinner,
  QueryErrorPanel,
  SectionEmptyState,
  UiProgress,
  UiSelect,
  UiSkeleton,
} from '../../../shared/ui';
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

export type LoadingErrorEmptyBaseComponentsConfig = {
  kind: 'loading' | 'error' | 'empty';
  loading: 'delayed-spinner' | 'skeleton' | 'inline-progress';
  error: 'inline' | 'panel' | 'page';
  empty: 'section-message' | 'first-use' | 'filtered' | 'no-results' | 'permission';
  retry: boolean;
  details: boolean;
  primaryAction: boolean;
  state: 'default' | 'long-message' | 'offline' | 'retrying';
};
type Config = LoadingErrorEmptyBaseComponentsConfig;

const DEFAULT_CONFIG: Config = {
  kind: 'loading',
  loading: 'skeleton',
  error: 'panel',
  empty: 'first-use',
  retry: true,
  details: false,
  primaryAction: true,
  state: 'default',
};

const OPTIONS: { label: string; key: keyof Config; values: readonly string[]; kinds?: readonly Config['kind'][] }[] = [
  { label: 'Kind', key: 'kind', values: ['loading', 'error', 'empty'] },
  { label: 'Loading recipe', key: 'loading', values: ['delayed-spinner', 'skeleton', 'inline-progress'], kinds: ['loading'] },
  { label: 'Error preset', key: 'error', values: ['inline', 'panel', 'page'], kinds: ['error'] },
  { label: 'Empty preset', key: 'empty', values: ['section-message', 'first-use', 'filtered', 'no-results', 'permission'], kinds: ['empty'] },
  { label: 'Retry action', key: 'retry', values: ['true', 'false'], kinds: ['error'] },
  { label: 'Details action', key: 'details', values: ['false', 'true'], kinds: ['error'] },
  { label: 'Primary action', key: 'primaryAction', values: ['true', 'false'], kinds: ['empty'] },
  { label: 'State', key: 'state', values: ['default', 'long-message', 'offline', 'retrying'], kinds: ['error'] },
];

export const resolveLoadingErrorEmptyOptionKeys = (config: Config) =>
  OPTIONS.filter((option) => !option.kinds || option.kinds.includes(config.kind)).map((option) => option.key);

export const resolveLoadingErrorEmptyPreviewModel = (config: Config) => ({
  renderer: config.kind === 'loading'
    ? config.loading === 'skeleton' ? 'UiSkeleton' : config.loading === 'inline-progress' ? 'UiProgress' : 'LoadingSpinner'
    : config.kind === 'error' ? 'QueryErrorPanel' : 'empty-composition',
  retryEnabled: config.kind === 'error' && config.retry,
  detailsVisible: config.kind === 'error' && config.details,
  primaryActionVisible: config.kind === 'empty' && config.primaryAction,
  state: config.kind === 'error' ? config.state : null,
});

export const exportLoadingErrorEmptyConfig = (config: Config) => ({
  public: {},
  composition: config.kind === 'loading'
    ? { loadingPreset: config.loading }
    : config.kind === 'error'
      ? { errorPreset: config.error, retryAction: config.retry, detailsAction: config.details }
      : { emptyPreset: config.empty, primaryAction: config.primaryAction },
  demo: { kind: config.kind, ...(config.kind === 'error' ? { state: config.state } : {}) },
});

const SECTION_MESSAGE_SAMPLE = 'No staff notes on file for this member.';

const EMPTY_COPY = {
  'section-message': { title: '', body: SECTION_MESSAGE_SAMPLE, icon: FolderOpen, action: '' },
  'first-use': { title: 'No deployment targets yet', body: 'Create a target to start publishing releases.', icon: FolderOpen, action: 'Create target' },
  filtered: { title: 'No targets match these filters', body: 'Clear one or more filters to broaden the list.', icon: FilterX, action: 'Clear filters' },
  'no-results': { title: 'No results for this search', body: 'Check the spelling or try a broader phrase.', icon: SearchX, action: 'Reset search' },
  permission: { title: 'Targets are not available', body: 'Ask a workspace administrator for deployment access.', icon: ShieldX, action: 'View access guide' },
} as const;

export const LoadingErrorEmptyBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_CONFIG);
  const setOption = (key: keyof Config, value: string) => {
    setConfig((current) => ({
      ...current,
      [key]: key === 'retry' || key === 'details' || key === 'primaryAction' ? value === 'true' : value,
    }));
  };
  const json = React.useMemo(() => JSON.stringify(exportLoadingErrorEmptyConfig(config), null, 2), [config]);
  const empty = EMPTY_COPY[config.empty];
  const EmptyIcon = empty.icon;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="loading-error-empty" json={json}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Async state" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {OPTIONS.filter((option) => resolveLoadingErrorEmptyOptionKeys(config).includes(option.key)).map((option) => (
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
        <BaseComponentsPreviewFrame sectionId="loading-error-empty">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'items-center justify-center')}>
            <section className="flex min-h-72 w-full max-w-2xl items-center justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-busy={config.kind === 'loading'}>
              {config.kind === 'loading' ? (
                config.loading === 'skeleton' ? (
                  <div className="w-full space-y-4">
                    <div className="flex items-center gap-3">
                      <UiSkeleton className="h-10 w-10 rounded-full" animationType="shimmer" />
                      <div className="flex-1 space-y-2">
                        <UiSkeleton className="h-4 w-48 rounded" animationType="shimmer" />
                        <UiSkeleton className="h-3 w-72 max-w-full rounded" animationType="shimmer" />
                      </div>
                    </div>
                    {[0, 1, 2].map((row) => <UiSkeleton key={row} className="h-12 w-full rounded-lg" animationType="shimmer" />)}
                  </div>
                ) : config.loading === 'inline-progress' ? (
                  <div className="w-full max-w-md">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">Publishing release</span>
                      <span className="tabular-nums text-slate-500">62%</span>
                    </div>
                    <UiProgress value={62} label="Publishing release progress" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <LoadingSpinner className="h-5 w-5 animate-spin text-emerald-600" label="Loading deployment targets" />
                    Loading deployment targets…
                  </div>
                )
              ) : config.kind === 'error' ? (
                <div className={cn('w-full', config.error === 'inline' && 'max-w-md border-l-2 border-rose-300 ps-3')}>
                  <QueryErrorPanel
                    className={cn(config.error === 'page' ? 'h-64' : 'h-auto')}
                    message={config.state === 'offline' ? 'The network is offline.' : 'Deployment targets could not be loaded.'}
                    detail={config.state === 'long-message' ? 'The service returned an unexpected response while loading deployment targets. Check the service status, then retry.' : undefined}
                    onRetry={config.retry ? () => setConfig((current) => ({ ...current, state: current.state === 'retrying' ? 'default' : 'retrying' })) : undefined}
                    isRetrying={config.state === 'retrying'}
                  />
                  {config.details ? (
                    <div className="mt-3 text-center">
                      <AppButton intent="utility" size="sm"><ListRestart className="h-3.5 w-3.5" /> View error details</AppButton>
                    </div>
                  ) : null}
                </div>
              ) : config.empty === 'section-message' ? (
                <div className="w-full max-w-xl">
                  <SectionEmptyState>{SECTION_MESSAGE_SAMPLE}</SectionEmptyState>
                </div>
              ) : (
                <div className="max-w-md text-center">
                  <EmptyIcon className="mx-auto h-9 w-9 text-emerald-600" />
                  <h2 className="mt-3 text-base font-bold text-slate-900">{empty.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{empty.body}</p>
                  {config.primaryAction ? (
                    <AppButton className="mt-4" intent="primary" size="sm">
                      <FilePlus2 className="h-3.5 w-3.5" /> {empty.action}
                    </AppButton>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
