import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { BASE_INFO_ROOT_FEEDBACK_SUBJECT } from '../../../../shared/api/contracts/feedback/constants';
import { apiGet } from '../../../../shared/api/client';
import { AppButton, QueryErrorPanel, UiInput, UiSelect } from '../../../../shared/ui';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS,
  SETTINGS_SURFACE_STACK_CLASS,
  SettingsDisabledFieldset,
  SettingsField,
  SettingsFormGroup,
  SettingsToggleField,
} from '../form/SettingsFormPrimitives';
import { getSettingsTypography } from '../../settingsSectionTypography';
import type { FeedbackSettingsSectionModel } from './useFeedbackSettingsSection';

type FeedbackSettingsSectionProps = {
  page: FeedbackSettingsSectionModel;
};

type BaseInfoOption = {
  id: string;
  label: string;
};

type ApiListResponse = {
  success: boolean;
  items?: Array<{ id?: string; label?: string; title?: string }>;
};

const fieldClass = 'flex flex-col gap-[2px]';

const fetchBaseInfoOptions = async (root: string): Promise<BaseInfoOption[]> => {
  const { data, response } = await apiGet<ApiListResponse>(
    `/api/base-info/options?root=${encodeURIComponent(root)}&lang=en`,
  );
  if (!response.ok || !data.success) {
    throw new Error('Failed to load base info options.');
  }
  return (data.items ?? []).map((item) => ({
    id: String(item.id ?? ''),
    label: String(item.label || item.title || item.id || ''),
  })).filter((item) => item.id);
};

export const FeedbackSettingsSection: React.FC<FeedbackSettingsSectionProps> = ({ page }) => {
  const t = useSettingsFormT();
  const typo = getSettingsTypography('feedback');
  const config = page.draftConfig;

  const subjectOptionsQuery = useQuery({
    queryKey: ['feedback-settings-base-info-subjects', BASE_INFO_ROOT_FEEDBACK_SUBJECT],
    queryFn: () => fetchBaseInfoOptions(BASE_INFO_ROOT_FEEDBACK_SUBJECT),
    enabled: Boolean(config),
  });

  if (page.isLoading) {
    return <div className={typo.loadingText}>{t('settings.forms.feedback.loading')}</div>;
  }

  if (page.isError && page.loadError) {
    return (
      <QueryErrorPanel
        message={t('settings.forms.feedback.loadError')}
        detail={page.loadError}
        onRetry={() => void page.retryLoad()}
      />
    );
  }

  if (!config) {
    return null;
  }

  const updatePolicy = (patch: Partial<typeof config.policy>) => {
    page.updateDraft((current) => ({
      ...current,
      policy: { ...current.policy, ...patch },
    }));
  };

  const subjectOptions = subjectOptionsQuery.data ?? [];

  return (
    <div className={SETTINGS_SURFACE_STACK_CLASS}>
      <SettingsFormGroup title={t('settings.forms.feedback.policyTitle')} sectionId="feedback">
        <SettingsToggleField
          id="feedback-enabled"
          checked={config.policy.enabled}
          onChange={(checked) => updatePolicy({ enabled: checked })}
          title={t('settings.forms.feedback.enabled')}
          description={t('settings.forms.feedback.enabledInfo')}
        />
      </SettingsFormGroup>

      {page.formError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{page.formError}</div>
      ) : null}

      <SettingsFormGroup title={t('settings.forms.feedback.collectionTitle')} sectionId="feedback" divided>
        <SettingsDisabledFieldset disabled={!config.policy.enabled}>
          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <SettingsToggleField
              id="feedback-allow-auth"
              checked={config.policy.allowAuthenticated}
              onChange={(checked) => updatePolicy({ allowAuthenticated: checked })}
              title={t('settings.forms.feedback.allowAuthenticated')}
            />
            <SettingsToggleField
              id="feedback-allow-anon"
              checked={config.policy.allowAnonymous}
              onChange={(checked) => updatePolicy({ allowAnonymous: checked })}
              title={t('settings.forms.feedback.allowAnonymous')}
            />
            <SettingsToggleField
              id="feedback-require-subject"
              checked={config.policy.requireSubject}
              onChange={(checked) => updatePolicy({ requireSubject: checked })}
              title={t('settings.forms.feedback.requireSubject')}
            />
            <SettingsToggleField
              id="feedback-attachments"
              checked={config.policy.allowAttachments}
              onChange={(checked) => updatePolicy({ allowAttachments: checked })}
              title={t('settings.forms.feedback.allowAttachments')}
            />
            <SettingsToggleField
              id="feedback-dashboard"
              checked={config.policy.showOnDashboard}
              onChange={(checked) => updatePolicy({ showOnDashboard: checked })}
              title={t('settings.forms.feedback.showOnDashboard')}
            />
            <SettingsToggleField
              id="feedback-replies"
              checked={config.policy.allowSubmitterReplies}
              onChange={(checked) => updatePolicy({ allowSubmitterReplies: checked })}
              title={t('settings.forms.feedback.allowSubmitterReplies')}
            />
          </div>

          <SettingsField label={t('settings.forms.feedback.widgetPlacement')} labelBand={false}>
            <UiSelect
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              value={config.policy.widgetPlacement}
              onChange={(event) => updatePolicy({ widgetPlacement: event.target.value as typeof config.policy.widgetPlacement })}
            >
              <option value="fab">{t('settings.forms.feedback.placementFab')}</option>
              <option value="header-menu">{t('settings.forms.feedback.placementHeader')}</option>
              <option value="footer-link">{t('settings.forms.feedback.placementFooter')}</option>
            </UiSelect>
          </SettingsField>
        </SettingsDisabledFieldset>
      </SettingsFormGroup>

      <SettingsFormGroup title={t('settings.forms.feedback.routingTitle')} sectionId="feedback" divided>
        <SettingsDisabledFieldset disabled={!config.policy.enabled}>
          <div className="mb-3 flex justify-end">
            <AppButton
              type="button"
              intent="utility"
              size="sm"
              onClick={() => {
                page.updateDraft((current) => ({
                  ...current,
                  routingRules: [
                    ...current.routingRules,
                    {
                      id: `rule-${Date.now()}`,
                      priority: (current.routingRules.at(-1)?.priority ?? 0) + 10,
                      subjectId: null,
                      portalSlug: null,
                      target: { kind: 'UNASSIGNED' },
                      notifyTarget: false,
                    },
                  ],
                }));
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('settings.forms.feedback.addRoutingRule')}
            </AppButton>
          </div>
          <div className="space-y-3">
            {config.routingRules.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-slate-200 p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className={fieldClass}>
                    <label className="ps-[4px] text-sm font-medium normal-case tracking-normal text-slate-700">{t('settings.forms.feedback.rulePriority')}</label>
                    <UiInput
                      size="sm"
                      className={SETTINGS_CONTROL_CLASS}
                      type="number"
                      value={String(rule.priority)}
                      onChange={(event) => {
                        page.updateDraft((current) => ({
                          ...current,
                          routingRules: current.routingRules.map((entry) => (
                            entry.id === rule.id
                              ? { ...entry, priority: Number(event.target.value) || 0 }
                              : entry
                          )),
                        }));
                      }}
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className="ps-[4px] text-sm font-medium normal-case tracking-normal text-slate-700">{t('settings.forms.feedback.ruleSubject')}</label>
                    <UiSelect
                      size="sm"
                      className={SETTINGS_CONTROL_CLASS}
                      value={rule.subjectId ?? ''}
                      onChange={(event) => {
                        const nextSubjectId = event.target.value || null;
                        page.updateDraft((current) => ({
                          ...current,
                          routingRules: current.routingRules.map((entry) => (
                            entry.id === rule.id
                              ? { ...entry, subjectId: nextSubjectId }
                              : entry
                          )),
                        }));
                      }}
                    >
                      <option value="">{t('settings.forms.feedback.ruleAny')}</option>
                      {subjectOptions.map((subject) => (
                        <option key={subject.id} value={subject.id}>{subject.label}</option>
                      ))}
                    </UiSelect>
                  </div>
                  <div className={fieldClass}>
                    <label className="ps-[4px] text-sm font-medium normal-case tracking-normal text-slate-700">{t('settings.forms.feedback.ruleTargetKind')}</label>
                    <UiSelect
                      size="sm"
                      className={SETTINGS_CONTROL_CLASS}
                      value={rule.target.kind}
                      onChange={(event) => {
                        const kind = event.target.value as 'USER' | 'ROLE' | 'UNASSIGNED';
                        page.updateDraft((current) => ({
                          ...current,
                          routingRules: current.routingRules.map((entry) => (
                            entry.id === rule.id
                              ? {
                                ...entry,
                                target: kind === 'USER'
                                  ? { kind: 'USER', userId: 1 }
                                  : kind === 'ROLE'
                                    ? { kind: 'ROLE', roleName: 'ADMIN' }
                                    : { kind: 'UNASSIGNED' },
                              }
                              : entry
                          )),
                        }));
                      }}
                    >
                      <option value="UNASSIGNED">{t('settings.forms.feedback.targetUnassigned')}</option>
                      <option value="ROLE">{t('settings.forms.feedback.targetRole')}</option>
                      <option value="USER">{t('settings.forms.feedback.targetUser')}</option>
                    </UiSelect>
                  </div>
                  <div className={fieldClass}>
                    <label className="ps-[4px] text-sm font-medium normal-case tracking-normal text-slate-700">{t('settings.forms.feedback.ruleTargetValue')}</label>
                    {rule.target.kind === 'ROLE' ? (
                      <UiInput
                        size="sm"
                        className={SETTINGS_CONTROL_CLASS}
                        value={rule.target.roleName}
                        onChange={(event) => {
                          page.updateDraft((current) => ({
                            ...current,
                            routingRules: current.routingRules.map((entry) => (
                              entry.id === rule.id
                                ? { ...entry, target: { kind: 'ROLE', roleName: event.target.value } }
                                : entry
                            )),
                          }));
                        }}
                      />
                    ) : rule.target.kind === 'USER' ? (
                      <UiInput
                        size="sm"
                        className={SETTINGS_CONTROL_CLASS}
                        type="number"
                        value={String(rule.target.userId)}
                        onChange={(event) => {
                          page.updateDraft((current) => ({
                            ...current,
                            routingRules: current.routingRules.map((entry) => (
                              entry.id === rule.id
                                ? { ...entry, target: { kind: 'USER', userId: Number(event.target.value) || 0 } }
                                : entry
                            )),
                          }));
                        }}
                      />
                    ) : (
                      <UiInput size="sm" className={SETTINGS_CONTROL_CLASS} value="—" disabled />
                    )}
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  <AppButton
                    type="button"
                    intent="danger"
                    size="sm"
                    onClick={() => {
                      page.updateDraft((current) => ({
                        ...current,
                        routingRules: current.routingRules.filter((entry) => entry.id !== rule.id),
                      }));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('settings.ui.delete')}
                  </AppButton>
                </div>
              </div>
            ))}
          </div>
        </SettingsDisabledFieldset>
      </SettingsFormGroup>

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <AppButton type="button" intent="primary" disabled={!page.isDirty || page.isSaving} onClick={() => void page.handleSave()}>
          <Save className="h-3.5 w-3.5" />
          {page.isSaving ? t('settings.ui.saving') : t('actions.saveChanges')}
        </AppButton>
      </div>
    </div>
  );
};
