import React from 'react';
import { Languages, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useCultureT } from '../../../../core/culture/CultureContext';
import { formatQueryError } from '../../../../shared/api/client';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import {
  AppButton,
  AppToast,
  BuiltInBadge,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  QueryErrorPanel,
  ToolbarActionGroupWithRefresh,
  ListPageToolbarFrame,
} from '../../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../../shared/ui/list-page/listPageToolbarChrome';
import { useListPageToolbarScroll } from '../../../../shared/lib/useListPageToolbarScroll';
import { cn } from '../../../../lib/utils';
import { CultureDeleteModal } from './CultureDeleteModal';
import { CultureFormModal } from './CultureFormModal';
import { CultureTranslationsModal } from './CultureTranslationsModal';
import { formatCalendarLabel, resolveCultureDisplayLabel } from './constants';
import { formatTechnicalDirectionLabel, TECHNICAL_LTR_CLASS } from '../../../../core/culture/technicalCultureLabels';
import { getSettingsTypography } from '../../settingsSectionTypography';
import {
  SettingsCard,
  SettingsCardFieldRow,
  SettingsCardGrid,
} from '../form/SettingsFormPrimitives';
import type { CulturesSectionModel } from './useCulturesSection';

type CulturesSectionProps = {
  page: CulturesSectionModel;
};

export const CulturesSection: React.FC<CulturesSectionProps> = ({ page }) => {
  const t = useCultureT();
  const tf = useSettingsFormT();
  const { listToolbarCollapsed, handleGridScroll } = useListPageToolbarScroll();
  const loadError = page.culturesQuery.isError ? page.culturesQuery.error : null;
  const typo = getSettingsTypography('cultures');

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-slate-50 font-sans">
      <ListPageToolbarFrame>

        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <AppButton intent="secondary" size="sm" onClick={page.translationsModal.openAll}>
            <Languages className="h-3.5 w-3.5" aria-hidden="true" />
            {t('settings.cultures.translations')}
          </AppButton>
          <ToolbarActionGroupWithRefresh
            onRefresh={() => { void page.culturesQuery.refetch(); }}
            isRefreshing={page.culturesQuery.isFetching && !page.culturesQuery.isLoading}
            actions={[
              {
                id: 'create-culture',
                label: t('settings.cultures.create'),
                icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'create',
                primary: true,
                onClick: page.openCreateModal,
              },
            ]}
          />
        </div>
      </ListPageToolbarFrame>

      {page.formError ? (
        <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {page.formError}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto" onScroll={handleGridScroll}>
        {page.culturesQuery.isLoading ? (
          <div className={cn('flex h-40 items-center justify-center', typo.loadingText)}>
            {t('settings.cultures.loadingCultures')}
          </div>
        ) : loadError ? (
          <QueryErrorPanel
            message={t('settings.cultures.failedLoad')}
            detail={formatQueryError(loadError, 'Could not load culture settings.')}
            onRetry={() => { void page.retryLoad(); }}
          />
        ) : (
          <SettingsCardGrid>
            {page.rows.map((pack) => {
              const isDefault = page.isDefaultPack(pack.id);
              const isBuiltin = pack.source === 'builtin';
              const displayLabel = resolveCultureDisplayLabel(pack);

              return (
                <SettingsCard key={pack.id} className="group relative">
                  <div className="flex min-w-0 items-baseline justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className={cn(typo.gridPrimary, TECHNICAL_LTR_CLASS)}>{displayLabel}</span>
                    </div>
                    <div className="relative flex h-8 shrink-0 items-center justify-end">
                      {isBuiltin ? (
                        <BuiltInBadge />
                      ) : (
                        <div className="flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <AppButton
                            intent="destructive-soft"
                            size="icon-md"
                            disabled={isDefault}
                            onClick={() => page.setDeleteTarget(pack)}
                            title={isDefault
                              ? t('settings.cultures.cannotDeleteDefault')
                              : tf('settings.cultures.deleteNamed', { name: displayLabel })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </AppButton>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-col gap-1">
                    <SettingsCardFieldRow label={t('settings.cultures.calendar')}>
                      <span className={TECHNICAL_LTR_CLASS}>{formatCalendarLabel(pack.calendar)}</span>
                    </SettingsCardFieldRow>
                    <SettingsCardFieldRow label={t('settings.cultures.direction')} valueClassName={TECHNICAL_LTR_CLASS}>
                      {formatTechnicalDirectionLabel(pack.direction)}
                    </SettingsCardFieldRow>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                    <div className="flex items-center gap-1">
                      <AppButton
                        intent="secondary"
                        size="icon-md"
                        disabled={isDefault}
                        onClick={() => page.openEditModal(pack)}
                        title={isDefault
                          ? t('settings.cultures.cannotEditDefault')
                          : tf('settings.cultures.editNamed', { name: displayLabel })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </AppButton>
                      <AppButton
                        intent="secondary"
                        size="sm"
                        onClick={() => page.translationsModal.openForCulture(pack.id)}
                      >
                        <Languages className="h-3.5 w-3.5" />
                        {t('settings.cultures.translations')}
                      </AppButton>
                    </div>
                    <AppButton
                      intent={isDefault ? 'confirm' : 'secondary'}
                      size="sm"
                      onClick={() => page.setDefaultCulture(pack.id)}
                      title={isDefault
                        ? t('settings.cultures.defaultCulture')
                        : tf('settings.cultures.setNamedDefault', { name: displayLabel })}
                    >
                      <Star className={cn('h-4 w-4', isDefault && 'fill-current')} />
                      {isDefault ? t('settings.cultures.default') : t('settings.cultures.setDefault')}
                    </AppButton>
                  </div>
                </SettingsCard>
              );
            })}
          </SettingsCardGrid>
        )}
      </div>

      <CultureFormModal
        open={page.formOpen}
        mode={page.formMode}
        form={page.form}
        formError={page.formModalError}
        existingPackIds={page.draft.packs.map((pack) => pack.id)}
        onClose={page.closeFormModal}
        onChange={page.setForm}
        onApply={page.applyFormToDraft}
      />

      <CultureDeleteModal
        target={page.deleteTarget}
        onClose={() => page.setDeleteTarget(null)}
        onConfirm={() => { void page.confirmDelete(); }}
      />

      <CultureTranslationsModal page={page.translationsModal} />

      {page.toast ? <AppToast type={page.toast.type} text={page.toast.text} /> : null}
    </div>
  );
};
