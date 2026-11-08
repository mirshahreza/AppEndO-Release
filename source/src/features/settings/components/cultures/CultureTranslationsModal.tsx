import React from 'react';
import { Loader2, Save } from 'lucide-react';
import { useCultureT } from '../../../../core/culture/CultureContext';
import {
  AppButton,
  AppToast,
  CreateEditModalShell,
  GridPagingFooter,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  QueryErrorPanel,
  ToolbarSearchInput,
  UiInput,
  APP_TABLE_GRID_HEADER_CELL_CLASS,
  APP_TABLE_GRID_ROW_CLASS,
  APP_TABLE_GRID_SCROLL_CLASS,
  APP_TABLE_GRID_STATE_PANEL_CLASS,
  APP_TABLE_GRID_TABLE_CLASS,
  APP_TABLE_GRID_TBODY_CLASS,
  APP_TABLE_GRID_THEAD_CLASS,
} from '../../../../shared/ui';
import { formatQueryError } from '../../../../shared/api/client';
import { cn } from '../../../../lib/utils';
import type { CultureTranslationsModalModel } from './useCultureTranslationsModal';
import { EXPLICIT_LTR_TEXT_CHROME_CLASS } from '../../../../shared/lib/appTableGridColumnTextDirection';
import { cultureTranslationColumnDir } from './cultureTranslationsUtils';
import { resolveCultureDisplayLabel } from './constants';

type CultureTranslationsModalProps = {
  page: CultureTranslationsModalModel;
};

const CULTURE_COLUMN_CELL_CLASS = 'px-3 py-2 text-start align-top';
const REFERENCE_COLUMN_CLASS = cn('px-3 py-2 align-top', EXPLICIT_LTR_TEXT_CHROME_CLASS);
const REFERENCE_HEADER_CLASS = cn(APP_TABLE_GRID_HEADER_CELL_CLASS, EXPLICIT_LTR_TEXT_CHROME_CLASS);

export const CultureTranslationsModal: React.FC<CultureTranslationsModalProps> = ({ page }) => {
  const t = useCultureT();

  if (!page.open) {
    return null;
  }

  const cultures = page.activeCultureColumns;
  const translationData = page.resolvedTranslationsData;
  const masterBundle = translationData?.masterBundle ?? {};
  const loadError = page.translationsQuery.isError ? page.translationsQuery.error : null;
  const isSingleCultureRtl = page.activeModalDirection === 'rtl';
  const totalKeyCount = page.presentation.totalCount;

  return (
    <>
      <CreateEditModalShell
        size="maximized"
        gradient={false}
        title={(
          <span
            dir={page.activeModalDirection}
            className={cn('block w-full', isSingleCultureRtl && 'text-end')}
          >
            {page.activeTitle}
          </span>
        )}
        onClose={page.close}
        onBackdropClick={page.close}
        shellClassName="flex flex-col overflow-hidden"
        bodyOuterClassName="-mb-[15px] flex min-h-0 flex-1 flex-col !overflow-hidden"
        bodyClassName="flex h-full min-h-0 flex-1 flex-col overflow-hidden !p-0"
        subtitle={(
          <div
            className="flex w-full min-w-0 flex-row items-center justify-between gap-3"
            style={{ direction: 'ltr' }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ToolbarSearchInput
                value={page.search}
                onChange={page.setSearch}
                placeholder={t('settings.cultures.searchKeys')}
                ariaLabel={t('grid.search')}
              />
              <p className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-600">
                {t('settings.cultures.keysCount').replace('{count}', String(totalKeyCount))}
                {page.mode === 'all' ? ` · ${cultures.length} cultures` : null}
              </p>
            </div>
            <div className={cn(PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS, '!w-auto')}>
              <AppButton
                intent="primary"
                size="sm"
                disabled={!page.isDirty || page.isSaving}
                onClick={() => { void page.save(); }}
              >
                {page.isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {page.isSaving ? t('actions.saving') : t('settings.cultures.saveTranslations')}
              </AppButton>
            </div>
          </div>
        )}
      >
        {page.formError ? (
          <div className="shrink-0 border-b border-rose-100 bg-rose-50 px-[15px] py-2 text-xs text-rose-700">
            {page.formError}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn(APP_TABLE_GRID_SCROLL_CLASS, 'min-h-0 flex-1')}
            onScroll={page.presentation.handleScrollEnd}
          >
            {page.translationsQuery.isLoading ? (
              <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>
                {t('settings.cultures.translationsLoading')}
              </div>
            ) : loadError ? (
              <QueryErrorPanel
                message={t('settings.cultures.translationsFailed')}
                detail={formatQueryError(loadError, 'Could not load culture translations.')}
                onRetry={() => { void page.translationsQuery.refetch(); }}
              />
            ) : cultures.length === 0 ? (
              <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>
                {t('settings.cultures.translationsFailed')}
              </div>
            ) : totalKeyCount === 0 ? (
              <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>
                {t('grid.hint.empty')}
              </div>
            ) : (
              <table dir="ltr" className={cn(APP_TABLE_GRID_TABLE_CLASS, 'text-xs')}>
                <thead className={APP_TABLE_GRID_THEAD_CLASS}>
                  <tr>
                    <th dir="ltr" className={REFERENCE_HEADER_CLASS}>Key</th>
                    <th dir="ltr" className={REFERENCE_HEADER_CLASS}>Native</th>
                    {cultures.map((culture) => {
                      const columnDir = cultureTranslationColumnDir(culture);
                      return (
                        <th
                          key={culture.id}
                          dir={columnDir}
                          className={cn(
                            APP_TABLE_GRID_HEADER_CELL_CLASS,
                            CULTURE_COLUMN_CELL_CLASS,
                            'min-w-[12rem] !text-start',
                          )}
                        >
                          {resolveCultureDisplayLabel(culture)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className={APP_TABLE_GRID_TBODY_CLASS}>
                  {page.visibleKeys.map((key) => (
                    <tr key={key} className={APP_TABLE_GRID_ROW_CLASS}>
                      <td dir="ltr" className={cn(REFERENCE_COLUMN_CLASS, 'min-w-[12rem]')}>
                        <UiInput
                          value={key}
                          isDisabled
                          size="sm"
                          className="w-full font-mono text-[11px]"
                          aria-label={`Translation key ${key}`}
                        />
                      </td>
                      <td dir="ltr" className={cn(REFERENCE_COLUMN_CLASS, 'min-w-[12rem]')}>
                        <UiInput
                          value={masterBundle[key] ?? key}
                          isDisabled
                          size="sm"
                          className="w-full"
                          aria-label={`Native value for ${key}`}
                        />
                      </td>
                      {cultures.map((culture) => {
                        const value = page.draft[culture.id]?.[key] ?? '';
                        const defaultValue = translationData?.defaultBundles[culture.translationBundleId]?.[key]
                          ?? translationData?.defaultBundles[culture.id]?.[key]
                          ?? '';
                        const isOverridden = value.trim() !== (defaultValue ?? '').trim();
                        const columnDir = cultureTranslationColumnDir(culture);

                        return (
                          <td
                            key={`${culture.id}-${key}`}
                            dir={columnDir}
                            className={cn(CULTURE_COLUMN_CELL_CLASS, 'min-w-[12rem]')}
                          >
                            <div dir={columnDir} className="w-full [&_input]:text-start">
                              <UiInput
                                value={value}
                                onChange={(event) => page.updateTranslation(key, culture.id, event.target.value)}
                                size="sm"
                                className={cn(
                                  'w-full',
                                  isOverridden && 'border-cyan-300',
                                )}
                                aria-label={`${resolveCultureDisplayLabel(culture)} translation for ${key}`}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!page.translationsQuery.isLoading && !loadError && cultures.length > 0 ? (
            <div className="shrink-0">
              <GridPagingFooter
                totalCount={totalKeyCount}
                safePage={page.presentation.safePage}
                pageSize={page.pageSize}
                onPageSizeChange={page.setPageSize}
                sortBy={page.sortBy}
                sortOptions={page.sortOptions}
                onSortByChange={page.setSortBy}
                sortDirection={page.sortDirection}
                onToggleSortDirection={page.toggleSortDirection}
                totalPages={page.presentation.totalPages}
                pageNumbers={page.presentation.pageNumbers}
                onPageChange={page.presentation.setPage}
                listMode={page.listMode}
                onListModeChange={page.setListMode}
                visibleInfiniteCount={page.presentation.visibleInfiniteCount}
                edgeAlignInDialog={false}
              />
            </div>
          ) : null}
        </div>
      </CreateEditModalShell>

      {page.toast ? <AppToast type={page.toast.type} text={page.toast.text} /> : null}
    </>
  );
};
