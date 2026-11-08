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
import type { FileHubAuthMethod, FileHubProtocol } from '../../../shared/api/contracts/file-hub/types';
import { FILE_HUB_DEFAULT_PORTS, protocolAllowsPrivateKey } from '../../../shared/api/contracts/file-hub/validation';
import type { FileHubConnectionFormState, FileHubPageState } from '../hooks/useFileHubPage';

export const FileHubConnectionFormModal: React.FC<{ page: FileHubPageState }> = ({ page }) => {
  const t = useCultureT();
  const isEdit = Boolean(page.settingsTarget);
  if (!page.isCreateOpen && !isEdit) {
    return null;
  }

  const form = page.form;
  const setForm = (patch: Partial<FileHubConnectionFormState>) => {
    page.setForm((prev) => ({ ...prev, ...patch }));
  };
  const keyAuth = protocolAllowsPrivateKey(form.protocol) && form.authMethod === 'privateKey';
  const canSubmit = Boolean(
    form.name.trim()
    && form.host.trim()
    && form.username.trim()
    && (isEdit || (keyAuth ? form.privateKey.trim() : form.password)),
  );

  return (
    <CreateEditModalShell
      size="md"
      title={isEdit ? t('fileHub.edit.title') : t('fileHub.create.title')}
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
            {isEdit ? t('actions.save') : t('fileHub.create.submit')}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-1">
      {page.formError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {page.formError}
        </div>
      ) : null}
      <FormSection title="Connection" ink="accent" hint="Host, port, protocol, and login used to browse this remote file system.">
        <FormField label={t('fileHub.fields.name')} required>
          <UiInput
            size="sm"
            aiAssist={false}
            value={form.name}
            onChange={(event) => setForm({ name: event.target.value })}
            ariaLabel={t('fileHub.fields.name')}
          />
        </FormField>
        <FormField label={t('fileHub.fields.protocol')} required>
          <UiSelect
            size="sm"
            value={form.protocol}
            onChange={(event) => {
              const protocol = event.target.value as FileHubProtocol;
              const currentDefault = FILE_HUB_DEFAULT_PORTS[form.protocol];
              const nextPort = Number(form.port) === currentDefault
                ? String(FILE_HUB_DEFAULT_PORTS[protocol])
                : form.port;
              setForm({
                protocol,
                port: nextPort,
                authMethod: protocolAllowsPrivateKey(protocol) ? form.authMethod : 'password',
              });
            }}
            ariaLabel={t('fileHub.fields.protocol')}
          >
            <option value="sftp">{t('fileHub.protocol.sftp')}</option>
            <option value="ftp">{t('fileHub.protocol.ftp')}</option>
            <option value="ftps">{t('fileHub.protocol.ftps')}</option>
          </UiSelect>
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label={t('fileHub.fields.host')} required className="sm:col-span-2">
            <UiInput
              size="sm"
              aiAssist={false}
              autoDir={false}
              className="font-mono"
              value={form.host}
              onChange={(event) => setForm({ host: event.target.value })}
              ariaLabel={t('fileHub.fields.host')}
            />
          </FormField>
          <FormField label={t('fileHub.fields.port')} required>
            <UiInput
              size="sm"
              aiAssist={false}
              type="number"
              min={1}
              max={65535}
              value={form.port}
              onChange={(event) => setForm({ port: event.target.value })}
              ariaLabel={t('fileHub.fields.port')}
            />
          </FormField>
        </div>
        <FormField label={t('fileHub.fields.username')} required>
          <UiInput
            size="sm"
            aiAssist={false}
            autoDir={false}
            className="font-mono"
            value={form.username}
            onChange={(event) => setForm({ username: event.target.value })}
            ariaLabel={t('fileHub.fields.username')}
          />
        </FormField>
        <FormField label={t('fileHub.fields.initialPath')} hint="Leave blank to open the account home folder. After login the browser opens this directory.">
          <UiInput
            size="sm"
            aiAssist={false}
            autoDir={false}
            className="font-mono"
            value={form.initialPath}
            onChange={(event) => setForm({ initialPath: event.target.value })}
            ariaLabel={t('fileHub.fields.initialPath')}
            placeholder="/var/www"
          />
        </FormField>
      </FormSection>

      <FormSection title="Authentication" ink="contrast" divided hint="Password or private-key material encrypted at rest for this hub.">
        {protocolAllowsPrivateKey(form.protocol) ? (
          <FormField label={t('fileHub.fields.authMethod')} required>
            <UiSelect
              size="sm"
              value={form.authMethod}
              onChange={(event) => setForm({ authMethod: event.target.value as FileHubAuthMethod })}
              ariaLabel={t('fileHub.fields.authMethod')}
            >
              <option value="password">{t('fileHub.auth.password')}</option>
              <option value="privateKey">{t('fileHub.auth.privateKey')}</option>
            </UiSelect>
          </FormField>
        ) : null}
        {keyAuth ? (
          <>
            <FormField
              label={t('fileHub.fields.privateKey')}
              required={!isEdit}
              hint={isEdit ? t('fileHub.keepSecret') : undefined}
            >
              <UiTextarea
                size="sm"
                aiAssist={false}
                autoDir={false}
                className="min-h-32 font-mono text-[11px]"
                value={form.privateKey}
                onChange={(event) => setForm({ privateKey: event.target.value })}
                ariaLabel={t('fileHub.fields.privateKey')}
              />
            </FormField>
            <FormField label={t('fileHub.fields.passphrase')} hint={isEdit ? t('fileHub.keepSecret') : undefined}>
              <UiPasswordInput
                size="sm"
                autoComplete="new-password"
                value={form.passphrase}
                onChange={(event) => setForm({ passphrase: event.target.value })}
                ariaLabel={t('fileHub.fields.passphrase')}
              />
            </FormField>
          </>
        ) : (
          <FormField
            label={t('fileHub.fields.password')}
            required={!isEdit}
            hint={isEdit ? t('fileHub.keepSecret') : undefined}
          >
            <UiPasswordInput
              size="sm"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm({ password: event.target.value })}
              ariaLabel={t('fileHub.fields.password')}
            />
          </FormField>
        )}
      </FormSection>
      </div>
    </CreateEditModalShell>
  );
};
