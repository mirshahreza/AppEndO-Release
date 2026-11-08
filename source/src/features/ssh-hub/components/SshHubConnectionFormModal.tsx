import React from 'react';
import { Plus, Save, X } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  FormSection,
  UiInput,
  UiPasswordInput,
  UiSelect,
  UiTextarea,
} from '../../../shared/ui';
import type { SshHubAuthMethod } from '../../../shared/api/contracts/ssh-hub/types';
import type { SshHubConnectionFormState, SshHubPageState } from '../hooks/useSshHubPage';

export const SshHubConnectionFormModal: React.FC<{ page: SshHubPageState }> = ({ page }) => {
  const t = useCultureT();
  const isEdit = Boolean(page.settingsTarget);
  if (!page.isCreateOpen && !isEdit) {
    return null;
  }

  const form = page.form;
  const setForm = (patch: Partial<SshHubConnectionFormState>) => {
    page.setForm((prev) => ({ ...prev, ...patch }));
  };

  const canSubmit = Boolean(
    form.name.trim()
    && form.host.trim()
    && form.username.trim()
    && (isEdit || (form.authMethod === 'password' ? form.password : form.privateKey.trim())),
  );

  return (
    <CreateEditModalShell
      size="md"
      title={isEdit ? t('sshHub.edit.title') : t('sshHub.create.title')}
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
            {isEdit ? t('actions.save') : t('sshHub.create.submit')}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-1">
      <FormSection title="Connection" ink="accent" hint="Host, port, and login used to open this remote shell.">
        <FormField label={t('sshHub.fields.name')} required hint="Operator-facing label for this SSH connection in the hub list.">
          <UiInput
            size="sm"
            aiAssist={false}
            value={form.name}
            onChange={(event) => setForm({ name: event.target.value })}
            ariaLabel={t('sshHub.fields.name')}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label={t('sshHub.fields.host')} required className="sm:col-span-2" hint="Hostname or IP of the SSH server.">
            <UiInput
              size="sm"
              aiAssist={false}
              autoDir={false}
              className="font-mono"
              value={form.host}
              onChange={(event) => setForm({ host: event.target.value })}
              ariaLabel={t('sshHub.fields.host')}
            />
          </FormField>
          <FormField label={t('sshHub.fields.port')} required hint="SSH TCP port. Default is 22.">
            <UiInput
              size="sm"
              aiAssist={false}
              type="number"
              min={1}
              max={65535}
              value={form.port}
              onChange={(event) => setForm({ port: event.target.value })}
              ariaLabel={t('sshHub.fields.port')}
            />
          </FormField>
        </div>
        <FormField label={t('sshHub.fields.username')} required hint="Linux or network login used to start the session.">
          <UiInput
            size="sm"
            aiAssist={false}
            autoDir={false}
            className="font-mono"
            value={form.username}
            onChange={(event) => setForm({ username: event.target.value })}
            ariaLabel={t('sshHub.fields.username')}
          />
        </FormField>
        <FormField
          label={t('sshHub.fields.initialPath')}
          hint="Leave blank to open the account home folder. After login the shell changes to this directory."
        >
          <UiInput
            size="sm"
            aiAssist={false}
            autoDir={false}
            className="font-mono"
            value={form.initialPath}
            onChange={(event) => setForm({ initialPath: event.target.value })}
            ariaLabel={t('sshHub.fields.initialPath')}
            placeholder="/var/www"
          />
        </FormField>
      </FormSection>

      <FormSection title="Authentication" ink="contrast" divided hint="Password or private-key material encrypted at rest for this hub.">
        <FormField label={t('sshHub.fields.authMethod')} required hint="Choose password login or an SSH private key.">
          <UiSelect
            size="sm"
            value={form.authMethod}
            onChange={(event) => setForm({ authMethod: event.target.value as SshHubAuthMethod })}
            ariaLabel={t('sshHub.fields.authMethod')}
          >
            <option value="password">{t('sshHub.auth.password')}</option>
            <option value="privateKey">{t('sshHub.auth.privateKey')}</option>
          </UiSelect>
        </FormField>
        {form.authMethod === 'password' ? (
          <FormField
            label={t('sshHub.fields.password')}
            required={!isEdit}
            hint={isEdit ? t('sshHub.keepSecret') : undefined}
          >
            <UiPasswordInput
              size="sm"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm({ password: event.target.value })}
              ariaLabel={t('sshHub.fields.password')}
            />
          </FormField>
        ) : (
          <>
            <FormField
              label={t('sshHub.fields.privateKey')}
              required={!isEdit}
              hint={isEdit ? t('sshHub.keepSecret') : undefined}
            >
              <UiTextarea
                size="sm"
                aiAssist={false}
                autoDir={false}
                className="min-h-32 font-mono text-[11px]"
                value={form.privateKey}
                onChange={(event) => setForm({ privateKey: event.target.value })}
                ariaLabel={t('sshHub.fields.privateKey')}
              />
            </FormField>
            <FormField
              label={t('sshHub.fields.passphrase')}
              hint={isEdit ? t('sshHub.keepSecret') : undefined}
            >
              <UiPasswordInput
                size="sm"
                autoComplete="new-password"
                value={form.passphrase}
                onChange={(event) => setForm({ passphrase: event.target.value })}
                ariaLabel={t('sshHub.fields.passphrase')}
              />
            </FormField>
          </>
        )}
      </FormSection>
      </div>
    </CreateEditModalShell>
  );
};
