import React from 'react';
import { Plus, Save, X } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  FormSection,
  UiCheckboxChoice,
  UiInput,
  UiPasswordInput,
  UiSelect,
} from '../../../shared/ui';
import type { RdpHubSecurityMode } from '../../../shared/api/contracts/rdp-hub/types';
import type { RdpHubConnectionFormState, RdpHubPageState } from '../hooks/useRdpHubPage';

export const RdpHubConnectionFormModal: React.FC<{ page: RdpHubPageState }> = ({ page }) => {
  const t = useCultureT();
  const isEdit = Boolean(page.settingsTarget);
  if (!page.isCreateOpen && !isEdit) {
    return null;
  }

  const form = page.form;
  const setForm = (patch: Partial<RdpHubConnectionFormState>) => {
    page.setForm((prev) => ({ ...prev, ...patch }));
  };

  const canSubmit = Boolean(
    form.name.trim()
    && form.host.trim()
    && form.username.trim()
    && (isEdit || form.password),
  );

  return (
    <CreateEditModalShell
      size="md"
      title={isEdit ? t('rdpHub.edit.title') : t('rdpHub.create.title')}
      onClose={page.closeForm}
      onBackdropClick={page.closeForm}
      footer={(
        <>
          <AppButton intent="cancel" onClick={page.closeForm}>
            <X className="h-3.5 w-3.5" />
            {t('actions.cancel')}
          </AppButton>
          <AppButton
            intent="primary"
            onClick={() => void (isEdit ? page.saveSettings() : page.saveCreate())}
            disabled={!canSubmit || page.isSaving}
          >
            {isEdit ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {isEdit ? t('actions.save') : t('rdpHub.create.submit')}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-1">
      <FormSection title="Connection" ink="accent" hint="Host, port, and Windows login used to open this remote desktop.">
        <FormField label={t('rdpHub.fields.name')} required hint="Operator-facing label for this RDP connection in the hub list.">
          <UiInput
            size="sm"
            aiAssist={false}
            value={form.name}
            onChange={(event) => setForm({ name: event.target.value })}
            ariaLabel={t('rdpHub.fields.name')}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label={t('rdpHub.fields.host')} required className="sm:col-span-2" hint="Hostname or IP of the Windows desktop.">
            <UiInput
              size="sm"
              aiAssist={false}
              autoDir={false}
              className="font-mono"
              value={form.host}
              onChange={(event) => setForm({ host: event.target.value })}
              ariaLabel={t('rdpHub.fields.host')}
            />
          </FormField>
          <FormField label={t('rdpHub.fields.port')} required hint="RDP TCP port. Default is 3389.">
            <UiInput
              size="sm"
              aiAssist={false}
              type="number"
              min={1}
              max={65535}
              value={form.port}
              onChange={(event) => setForm({ port: event.target.value })}
              ariaLabel={t('rdpHub.fields.port')}
            />
          </FormField>
        </div>
        <FormField label={t('rdpHub.fields.username')} required hint="Windows account used to start the desktop session.">
          <UiInput
            size="sm"
            aiAssist={false}
            autoDir={false}
            className="font-mono"
            value={form.username}
            onChange={(event) => setForm({ username: event.target.value })}
            ariaLabel={t('rdpHub.fields.username')}
          />
        </FormField>
        <FormField label={t('rdpHub.fields.domain')} hint={t('rdpHub.fields.domainHint')}>
          <UiInput
            size="sm"
            aiAssist={false}
            autoDir={false}
            className="font-mono"
            value={form.domain}
            onChange={(event) => setForm({ domain: event.target.value })}
            ariaLabel={t('rdpHub.fields.domain')}
          />
        </FormField>
      </FormSection>

      <FormSection title="Authentication" ink="contrast" divided hint="Password and security mode encrypted at rest for this hub.">
        <FormField
          label={t('rdpHub.fields.password')}
          required={!isEdit}
          hint={isEdit ? t('rdpHub.keepSecret') : undefined}
        >
          <UiPasswordInput
            size="sm"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm({ password: event.target.value })}
            ariaLabel={t('rdpHub.fields.password')}
          />
        </FormField>
        <FormField label={t('rdpHub.fields.security')} required>
          <UiSelect
            size="sm"
            value={form.security}
            onChange={(event) => setForm({ security: event.target.value as RdpHubSecurityMode })}
            ariaLabel={t('rdpHub.fields.security')}
          >
            <option value="nla">{t('rdpHub.security.nla')}</option>
            <option value="tls">{t('rdpHub.security.tls')}</option>
            <option value="any">{t('rdpHub.security.any')}</option>
            <option value="rdp">{t('rdpHub.security.rdp')}</option>
          </UiSelect>
        </FormField>
        <UiCheckboxChoice
          checked={form.ignoreCert}
          onChange={(checked) => setForm({ ignoreCert: checked })}
        >
          {t('rdpHub.fields.ignoreCert')}
        </UiCheckboxChoice>
      </FormSection>
      </div>
    </CreateEditModalShell>
  );
};
