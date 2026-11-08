import React from 'react';
import {
  Ban,
  Check,
  KeyRound,
  Loader2,
  PlugZap,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { getAiProviderLabel, resolveAiProviderHostKind } from '../../../../shared/api/contracts/ai/constants';
import type { TranslationFn } from '../../../../core/culture/TranslationRuntime';
import { renderAiModelCapabilitiesCell } from '../../../../shared/lib/aiModelCapabilityDisplay';
import { AppButton } from '../../../../shared/ui/AppButton';
import { NativeButton } from '../../../../shared/ui/NativeButton';
import { APP_TABLE_GRID_ROW_HOVER_REVEAL_CLASS } from '../../../../shared/ui/surfaceClasses';
import { cn } from '../../../../lib/utils';
import {
  AI_MODELS_ACTION_BUTTON_BASE_CLASS,
  AI_MODELS_ACTION_COLUMN_WIDTH,
  AI_MODELS_SET_DEFAULT_BUTTON_CLASS,
  AI_MODELS_STATUS_BADGE_CLASS,
  PROVIDER_BADGE_CLASS,
  providerRequiresApiKey,
} from './constants';
import type { AiModelsTreeRow } from './aiModelsTree';

export type AiModelsTreeGridActions = {
  onTestProvider: (row: AiModelsTreeRow) => void;
  onSetDefaultModel: (row: AiModelsTreeRow) => void;
  onTestModel: (row: AiModelsTreeRow) => void;
  onDeleteModel: (row: AiModelsTreeRow) => void;
  onDeleteProvider: (row: AiModelsTreeRow) => void;
  testingProvider?: string | null;
  testingModelId?: string | null;
  settingDefaultModelId?: string | null;
  deletingProvider?: string | null;
};

const renderSetAsDefaultButton = (
  row: AiModelsTreeRow,
  defaultModelId: string,
  actions: AiModelsTreeGridActions,
  t: TranslationFn,
) => {
  const model = row.model;
  if (!model || row.kind !== 'model') {
    return null;
  }

  const isDefault = model.id === defaultModelId || model.isDefault;
  if (isDefault) {
    return null;
  }

  const isSettingDefault = actions.settingDefaultModelId === model.id;
  const isBusy = Boolean(actions.settingDefaultModelId);

  return (
    <span
      className={cn(
        APP_TABLE_GRID_ROW_HOVER_REVEAL_CLASS,
        isSettingDefault && 'pointer-events-auto opacity-100',
      )}
    >
      <NativeButton
        type="button"
        data-no-drag
        disabled={isBusy || !model.enabled}
        title={!model.enabled ? t('settings.ai.enableBeforeDefault') : t('settings.ai.setDefaultChat')}
        onClick={(event) => {
          event.stopPropagation();
          actions.onSetDefaultModel(row);
        }}
        className={cn(
          AI_MODELS_SET_DEFAULT_BUTTON_CLASS,
          'cursor-pointer border-indigo-500 bg-indigo-600 text-white transition-colors',
          'hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80',
          'disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none',
        )}
      >
        {isSettingDefault ? (
          <>
            <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" aria-hidden />
            {t('settings.ai.setDefault')}
          </>
        ) : (
          t('settings.ai.setDefault')
        )}
      </NativeButton>
    </span>
  );
};

export const createAiModelsTreeGridColumns = (
  actions: AiModelsTreeGridActions,
  t: TranslationFn,
) => [
  {
    key: 'capabilities',
    header: t('settings.ai.capabilities'),
    style: { width: '250px', minWidth: '250px', maxWidth: '250px' },
    headerStyle: { width: '250px', minWidth: '250px', maxWidth: '250px' },
    renderCell: (row: AiModelsTreeRow) => (
      row.kind === 'model' && row.model
        ? renderAiModelCapabilitiesCell(row.model.capabilities, t)
        : <span className="text-slate-300">-</span>
    ),
  },
  {
    key: 'actions',
    header: '',
    className: 'text-end',
    headerClassName: 'text-end',
    style: {
      width: `${AI_MODELS_ACTION_COLUMN_WIDTH}px`,
      minWidth: `${AI_MODELS_ACTION_COLUMN_WIDTH}px`,
      maxWidth: `${AI_MODELS_ACTION_COLUMN_WIDTH}px`,
    },
    headerStyle: {
      width: `${AI_MODELS_ACTION_COLUMN_WIDTH}px`,
      minWidth: `${AI_MODELS_ACTION_COLUMN_WIDTH}px`,
      maxWidth: `${AI_MODELS_ACTION_COLUMN_WIDTH}px`,
    },
    renderCell: (row: AiModelsTreeRow) => {
      if (row.kind === 'provider') {
        const providerKind = row.provider?.provider;
        const isTesting = Boolean(providerKind && actions.testingProvider === providerKind);
        const isDeleting = Boolean(providerKind && actions.deletingProvider === providerKind);
        const isBusy = Boolean(actions.testingProvider || actions.deletingProvider);

        return (
          <div className="flex items-center justify-end gap-[7px]">
            <AppButton
              size="icon-sm"
              className={`${AI_MODELS_ACTION_BUTTON_BASE_CLASS} ${
                isBusy && !isTesting
                  ? 'text-slate-400'
                  : 'text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700'
              }`}
              aria-label={t('actions.testProviderConnection')}
              title={t('actions.testConnection')}
              onClick={() => actions.onTestProvider(row)}
              disabled={isBusy}
            >
              {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
            </AppButton>
            <AppButton
              size="icon-sm"
              className={`${AI_MODELS_ACTION_BUTTON_BASE_CLASS} ${
                isBusy && !isDeleting
                  ? 'text-slate-400'
                  : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
              }`}
              aria-label={t('actions.deleteProvider')}
              title={t('actions.delete')}
              onClick={() => actions.onDeleteProvider(row)}
              disabled={isBusy}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </AppButton>
          </div>
        );
      }

      const model = row.model;
      if (!model) return null;

      const isTesting = actions.testingModelId === model.id;
      const isBusy = Boolean(actions.testingModelId || actions.settingDefaultModelId);

      return (
        <div className="flex items-center justify-end gap-[7px]">
          <AppButton
            size="icon-sm"
            className={`${AI_MODELS_ACTION_BUTTON_BASE_CLASS} ${
              isBusy && !isTesting
                ? 'text-slate-400'
                : 'text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700'
            }`}
            aria-label={t('actions.testConnection')}
            title={t('actions.testConnection')}
            onClick={() => actions.onTestModel(row)}
            disabled={isBusy}
          >
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
          </AppButton>
          <AppButton
            size="icon-sm"
            className={`${AI_MODELS_ACTION_BUTTON_BASE_CLASS} text-rose-600 hover:bg-rose-50 hover:text-rose-700`}
            aria-label={t('actions.deleteModel')}
            title={t('actions.delete')}
            onClick={() => actions.onDeleteModel(row)}
          >
            <Trash2 className="h-4 w-4" />
          </AppButton>
        </div>
      );
    },
  },
];

export const renderAiModelsNodeLabel = (
  row: AiModelsTreeRow,
  defaultModelId: string,
  actions: AiModelsTreeGridActions,
  t: TranslationFn,
) => {
  if (row.kind === 'provider' && row.provider) {
    const needsApiKey = providerRequiresApiKey(row.provider.provider);
    const hasApiKey = row.provider.hasApiKey;
    const hostKind = resolveAiProviderHostKind(row.provider.provider, row.provider.baseUrl);

    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className={cn(
          'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold',
          PROVIDER_BADGE_CLASS,
        )}
        >
          {getAiProviderLabel(row.provider.provider, row.provider.providerLabel)}
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            hostKind === 'local'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-sky-200 bg-sky-50 text-sky-800',
          )}
          title={hostKind === 'local' ? t('settings.ai.providerHostLocalHint') : t('settings.ai.providerHostCloudHint')}
        >
          {hostKind === 'local' ? t('settings.ai.providerHostLocal') : t('settings.ai.providerHostCloud')}
        </span>

        {needsApiKey ? (
          hasApiKey ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
              title={t('settings.ai.apiKeyConfigured')}
            >
              <KeyRound className="h-3 w-3 shrink-0" aria-hidden />
              {t('settings.ai.apiKeySet')}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
              title={t('settings.ai.apiKeyMissing')}
            >
              <KeyRound className="h-3 w-3 shrink-0" aria-hidden />
              {t('settings.ai.noApiKey')}
            </span>
          )
        ) : (
          <span
            className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500"
            title={t('settings.ai.apiKeyNotRequired')}
          >
            {t('settings.ai.noKeyRequired')}
          </span>
        )}
      </span>
    );
  }

  if (row.kind === 'model' && row.model) {
    const model = row.model;
    const enabledHint = t('settings.ai.modelEnabledHint');
    const disabledHint = t('settings.ai.modelDisabledHint');
    const isDefault = model.id === defaultModelId || model.isDefault;

    return (
      <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
        {model.enabled ? (
          <span
            className="inline-flex shrink-0 items-center text-emerald-600"
            title={enabledHint}
            aria-label={enabledHint}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : (
          <span
            className="inline-flex shrink-0 items-center text-rose-500"
            title={disabledHint}
            aria-label={disabledHint}
          >
            <Ban className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        <span className="truncate font-mono text-slate-700">{model.modelId}</span>
        {isDefault ? (
          <span
            className={cn(
              AI_MODELS_STATUS_BADGE_CLASS,
              'border-amber-200 text-amber-700',
            )}
            title={t('settings.ai.defaultChatModel')}
          >
            <Sparkles className="h-2.5 w-2.5 shrink-0" aria-hidden />
            {t('settings.ai.defaultBadge')}
          </span>
        ) : (
          renderSetAsDefaultButton(row, defaultModelId, actions, t)
        )}
      </span>
    );
  }

  return <span className="text-slate-300">-</span>;
};
