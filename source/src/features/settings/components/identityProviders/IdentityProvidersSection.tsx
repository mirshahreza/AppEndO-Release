import React from 'react';
import { Check, KeyRound, Settings2, X } from 'lucide-react';
import { formatQueryError } from '../../../../shared/api/client';
import { AppButton, AppToast, QueryErrorPanel } from '../../../../shared/ui';
import { cn } from '../../../../lib/utils';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import { getSettingsTypography } from '../../settingsSectionTypography';
import {
  SettingsCard,
  SettingsCardFieldRow,
  SettingsCardGrid,
} from '../form/SettingsFormPrimitives';
import { IdentityProviderFormModal } from './IdentityProviderFormModal';
import type { IdentityProvidersSectionModel } from './useIdentityProvidersSection';

type Props = {
  page: IdentityProvidersSectionModel;
};

export const IdentityProvidersSection: React.FC<Props> = ({ page }) => {
  const t = useSettingsFormT();
  const typo = getSettingsTypography('identity-providers');
  const loadError = page.providersQuery.isError ? page.providersQuery.error : null;

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-slate-50 font-sans">
      <div className="min-h-0 flex-1 overflow-auto">
        {page.providersQuery.isLoading ? (
          <div className={cn('flex h-40 items-center justify-center', typo.loadingText)}>
            {t('settings.forms.identity.loading')}
          </div>
        ) : loadError ? (
          <QueryErrorPanel
            message={t('settings.forms.identity.loadError')}
            detail={formatQueryError(loadError, t('settings.forms.identity.loadErrorDetail'))}
            onRetry={() => { void page.providersQuery.refetch(); }}
          />
        ) : (
          <SettingsCardGrid columns={2}>
            {page.rows.map((row) => {
              const configured = Boolean(row.config);
              const enabled = row.config?.enabled ?? false;

              return (
                <SettingsCard key={row.kind}>
                  <div className="flex items-start gap-2">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className={typo.gridPrimary}>{row.label}</div>
                      <div className={cn(typo.gridSecondary, 'mt-0.5')}>{row.description}</div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-col gap-1.5">
                    <SettingsCardFieldRow label={t('settings.ui.status')}>
                      {configured ? (
                        <span className="font-semibold text-emerald-700">{t('settings.ui.configured')}</span>
                      ) : (
                        <span>{t('settings.ui.notConfigured')}</span>
                      )}
                    </SettingsCardFieldRow>

                    <SettingsCardFieldRow label={t('settings.ui.enabled')}>
                      {!configured ? (
                        <span className="text-slate-300">-</span>
                      ) : enabled ? (
                        <Check className="h-3.5 w-3.5 text-emerald-700" aria-label={t('settings.ui.enabled')} />
                      ) : (
                        <X className="h-3.5 w-3.5 text-rose-700" aria-label={t('settings.ui.disabled')} />
                      )}
                    </SettingsCardFieldRow>
                  </div>

                  <div className="mt-auto pt-2">
                    <AppButton
                      intent="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => page.openConfigModal(row)}
                    >
                      <Settings2 className="h-4 w-4" />
                      {t('settings.ui.config')}
                    </AppButton>
                  </div>
                </SettingsCard>
              );
            })}
          </SettingsCardGrid>
        )}
      </div>

      <IdentityProviderFormModal
        open={page.formOpen}
        mode={page.formMode}
        form={page.form}
        formError={page.formError}
        isSaving={page.isSaving}
        isTesting={page.isTesting}
        onClose={page.closeFormModal}
        onChange={page.setForm}
        onSave={() => { void page.saveForm(); }}
        onTest={() => { void page.testConnection(); }}
      />

      {page.toast ? <AppToast type={page.toast.type} text={page.toast.text} /> : null}
    </div>
  );
};
