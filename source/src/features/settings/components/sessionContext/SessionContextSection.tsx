import React from 'react';
import { Check, Lock } from 'lucide-react';
import { AppToast, BuiltInBadge, QueryErrorPanel, UiCheckbox } from '../../../../shared/ui';
import { formatQueryError } from '../../../../shared/api/client';
import { cn } from '../../../../lib/utils';
import type { SessionContextSettingsDraftModel } from '../../hooks/useSessionContextSettingsDraft';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import { getSettingsTypography } from '../../settingsSectionTypography';
import { SettingsFormGroup } from '../form/SettingsFormPrimitives';

type SessionContextSectionProps = {
  page: SessionContextSettingsDraftModel;
};

/** Locked channel status — a bare check, not a checkbox control. */
const LockedChannelMark: React.FC<{ on: boolean; label: string }> = ({ on, label }) => (
  <span
    className="inline-flex h-5 w-5 items-center justify-center"
    title={on ? `${label}: always on` : `${label}: off`}
    aria-label={on ? `${label} on (locked)` : `${label} off (locked)`}
  >
    {on ? <Check className="h-3.5 w-3.5 text-emerald-700" strokeWidth={2.5} aria-hidden /> : null}
  </span>
);

export const SessionContextSection: React.FC<SessionContextSectionProps> = ({ page }) => {
  const t = useSettingsFormT();
  const typo = getSettingsTypography('session-context');
  const {
    settingsQuery,
    draftGroups,
    saveError,
    toast,
    updateEntry,
  } = page;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-slate-50 font-sans">
      {toast ? <AppToast type={toast.type} text={toast.text} /> : null}

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {settingsQuery.isLoading ? (
          <div className={cn('flex h-40 items-center justify-center', typo.loadingText)}>
            {t('settings.forms.sessionContext.loading')}
          </div>
        ) : settingsQuery.isError ? (
          <QueryErrorPanel
            message={t('settings.forms.sessionContext.loadError')}
            detail={formatQueryError(settingsQuery.error, t('settings.forms.sessionContext.loadError'))}
            onRetry={() => void settingsQuery.refetch()}
          />
        ) : (
          <>
            <p className={cn(typo.groupDesc, 'mb-4 max-w-3xl')}>
              {t('settings.forms.sessionContext.intro')}
            </p>

            {saveError ? (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {saveError}
              </div>
            ) : null}

            {draftGroups.map((group, groupIndex) => (
              <SettingsFormGroup
                key={group.id}
                title={group.title}
                sectionId="session-context"
                description={group.description}
                divided={groupIndex > 0}
              >
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">{t('settings.forms.sessionContext.columnSource')}</th>
                        <th className="w-[120px] px-3 py-2.5 text-center">
                          {t('settings.forms.sessionContext.columnServer')}
                        </th>
                        <th className="w-[120px] px-3 py-2.5 text-center">
                          {t('settings.forms.sessionContext.columnClient')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                            {t('settings.forms.sessionContext.emptyGroup')}
                          </td>
                        </tr>
                      ) : group.entries.map((entry) => (
                        <tr key={entry.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                          <td className="px-3 py-2.5 align-top">
                            <div className="flex items-start gap-2">
                              {entry.locked ? (
                                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                              ) : null}
                              <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span className={typo.gridPrimary}>{entry.label}</span>
                                  <span className={typo.gridMono}>{entry.contextKey}</span>
                                  {entry.locked ? (
                                    <BuiltInBadge />
                                  ) : null}
                                </div>
                                {entry.description ? (
                                  <div className={cn(typo.gridSecondary, 'mt-1')}>{entry.description}</div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center align-middle">
                            <div className="inline-flex justify-center">
                              {entry.locked ? (
                                <LockedChannelMark on={entry.server} label="Server" />
                              ) : (
                                <UiCheckbox
                                  checked={entry.server}
                                  size="sm"
                                  onChange={(event) => updateEntry(entry.id, { server: event.target.checked })}
                                />
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center align-middle">
                            <div className="inline-flex justify-center">
                              {entry.locked ? (
                                <LockedChannelMark on={entry.client} label="Client" />
                              ) : (
                                <UiCheckbox
                                  checked={entry.client}
                                  size="sm"
                                  onChange={(event) => updateEntry(entry.id, { client: event.target.checked })}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SettingsFormGroup>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
