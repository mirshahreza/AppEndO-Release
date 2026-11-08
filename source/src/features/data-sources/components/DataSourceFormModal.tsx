import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Plus, Save, Wifi, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  AppToast,
  CreateEditModalShell,
  DIALOG_TOAST_Z_CLASS,
  FormField,
  FormSection,
  UiCheckboxChoice,
  UiInput,
  UiPasswordInput,
} from '../../../shared/ui';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { DataSourceType, type DataSourceFormState } from '../../../shared/api/contracts/data-sources/types';
import { isAnalyticsDataSourceType } from '../../../shared/api/contracts/data-sources/analyticsOptions';
import { isSqlServerNamedInstanceHost } from '../../../shared/lib/sqlServerAddress';
import type { DataSourcesPageModel } from '../hooks/useDataSourcesPage';

type DataSourceFormModalProps = {
  page: Pick<
    DataSourcesPageModel,
    | 'isDialogOpen'
    | 'closeDialog'
    | 'editingId'
    | 'form'
    | 'setForm'
    | 'isSqlite'
    | 'isSqlServer'
    | 'showHost'
    | 'showPort'
    | 'showUsername'
    | 'showPassword'
    | 'showDatabase'
    | 'testingDraft'
    | 'submitting'
    | 'testDraftConnectivity'
    | 'saveDataSource'
    | 'formFeedback'
  >;
};

const FORM_FIELD_CLASS = 'min-w-0 w-full';
/** Tall enough for SQL Server (3-col grid + credentials + checkboxes); keeps dialog height stable across types. */
const CONNECTION_FIELDS_MIN_HEIGHT_CLASS = 'min-h-[14rem]';

export const DataSourceFormModal: React.FC<DataSourceFormModalProps> = ({ page }) => {
  if (!page.isDialogOpen) {
    return null;
  }

  const isSqlServerNamedInstance = page.isSqlServer && isSqlServerNamedInstanceHost(page.form.host);

  const setHost = (host: string) => {
    page.setForm((prev: DataSourceFormState) => {
      if (prev.type !== DataSourceType.SQL_SERVER) {
        return { ...prev, host };
      }

      const namedInstance = isSqlServerNamedInstanceHost(host);
      const wasNamedInstance = isSqlServerNamedInstanceHost(prev.host);

      return {
        ...prev,
        host,
        port: namedInstance
          ? 0
          : wasNamedInstance && prev.port === 0
            ? 1433
            : prev.port,
      };
    });
  };

  const renderConnectionFields = () => {
    if (page.isSqlite) {
      return (
        <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900">
            SQLite stores data in a local file. Use an absolute or workspace-relative path.
          </div>
          <FormField
            label="Database file path"
            required
            className={FORM_FIELD_CLASS}
            hint="Absolute or workspace-relative path to the SQLite file on the host. Example: data/app.sqlite"
          >
            <UiInput
              size="sm"
              autoDir={false}
              value={page.form.database}
              onChange={(e) => page.setForm((prev: DataSourceFormState) => ({ ...prev, database: e.target.value }))}
              placeholder="database.sqlite"
              ariaLabel="SQLite database path"
            />
          </FormField>
        </>
      );
    }

    const connectionGridClass = isSqlServerNamedInstance
      ? 'grid-cols-2'
      : 'grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)]';

    return (
      <>
        <div className={cn('grid w-full items-start gap-3', connectionGridClass)}>
          {page.showHost ? (
            <FormField label="Host" required className={FORM_FIELD_CLASS} hint="Hostname, IP, or SQL Server named instance (host\\instance).">
              <UiInput
                size="sm"
                autoDir={false}
                value={page.form.host}
                onChange={(e) => setHost(e.target.value)}
                ariaLabel="Host"
              />
            </FormField>
          ) : null}
          {page.showPort && !isSqlServerNamedInstance ? (
            <FormField label="Port" required className={FORM_FIELD_CLASS} hint="TCP port for this engine. Named SQL Server instances leave this empty.">
              <UiInput
                size="sm"
                type="number"
                value={page.form.port}
                onChange={(e) => page.setForm((prev: DataSourceFormState) => ({ ...prev, port: Number(e.target.value || 0) }))}
                ariaLabel="Port"
              />
            </FormField>
          ) : null}
          {page.showDatabase ? (
            <FormField label="Database" required className={FORM_FIELD_CLASS} hint="Catalog or schema name this connection should use.">
              <UiInput
                size="sm"
                autoDir={false}
                value={page.form.database}
                onChange={(e) => page.setForm((prev: DataSourceFormState) => ({ ...prev, database: e.target.value }))}
                ariaLabel="Database"
              />
            </FormField>
          ) : null}
          {page.showUsername ? (
            <FormField label="Username" required className={FORM_FIELD_CLASS} hint="Login used by EdgeDbRouter for server-side queries.">
              <UiInput
                size="sm"
                autoDir={false}
                value={page.form.username}
                onChange={(e) => page.setForm((prev: DataSourceFormState) => ({ ...prev, username: e.target.value }))}
                ariaLabel="Username"
              />
            </FormField>
          ) : null}
          {page.showPassword ? (
            <FormField
              label="Password"
              hint="Stored for server-side access. Leave blank when editing to keep the current secret."
              className={cn(
                FORM_FIELD_CLASS,
                !isSqlServerNamedInstance && page.showUsername ? 'col-span-2' : undefined,
              )}
            >
              <UiPasswordInput
                size="sm"
                value={page.form.password}
                onChange={(e) => page.setForm((prev: DataSourceFormState) => ({ ...prev, password: e.target.value }))}
                ariaLabel="Password"
              />
            </FormField>
          ) : null}
        </div>
        {page.isSqlServer ? (
          <div className="flex w-full flex-wrap items-center gap-4">
            <UiCheckboxChoice
              id="datasource-encrypt"
              checked={page.form.encrypt !== false}
              onChange={(checked) => page.setForm((prev: DataSourceFormState) => ({ ...prev, encrypt: checked }))}
            >
              Encrypt connection
            </UiCheckboxChoice>
            <UiCheckboxChoice
              id="datasource-trust-cert"
              checked={page.form.trustServerCertificate !== false}
              onChange={(checked) => page.setForm((prev: DataSourceFormState) => ({ ...prev, trustServerCertificate: checked }))}
            >
              Trust server certificate
            </UiCheckboxChoice>
          </div>
        ) : null}
      </>
    );
  };

  return (
    <>
      {page.formFeedback
        ? createPortal(
          <AppToast
            type={page.formFeedback.type}
            text={page.formFeedback.message}
            className={DIALOG_TOAST_Z_CLASS}
          />,
          document.body,
        )
        : null}
      <CreateEditModalShell
        size="lg"
        title={page.editingId ? 'Edit Data Source' : `New ${page.form.type} Data Source`}
        onClose={page.closeDialog}
        onBackdropClick={page.closeDialog}
        bodyClassName="min-h-0 w-full"
        footer={(
          <div className="flex w-full min-w-0 items-center justify-between gap-2">
            <AppButton
              type="button"
              intent="secondary"
              onClick={() => void page.testDraftConnectivity()}
              disabled={page.testingDraft || page.submitting}
              {...pageGuideLocalProps('Test connection', 'Validate the draft host, port, and credentials before saving.', 16)}
            >
              {page.testingDraft ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Testing…
                </>
              ) : (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  Test connection
                </>
              )}
            </AppButton>
            <div className="flex shrink-0 items-center gap-2">
              <AppButton type="button" intent="cancel" onClick={page.closeDialog}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </AppButton>
              <AppButton type="button" intent="primary" disabled={page.submitting} onClick={() => void page.saveDataSource()}>
                {page.editingId ? (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Create
                  </>
                )}
              </AppButton>
            </div>
          </div>
        )}
      >
        <div className="flex w-full flex-col gap-1">
          <FormSection
            title="Source"
            hint="Identity of this data source in lists and Data Studio."
            ink="accent"
          >
            <FormField label="Name" className={FORM_FIELD_CLASS} hint="Operator-facing label for this connection in Data Studio and hubs.">
              <UiInput
                size="sm"
                autoDir
                value={page.form.name}
                onChange={(e) => page.setForm((prev: DataSourceFormState) => ({ ...prev, name: e.target.value }))}
                placeholder="Source name"
                ariaLabel="Data source name"
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Connection"
            hint="Engine address and credentials EdgeDbRouter uses for this data source."
            ink="contrast"
            divided
          >
            <div className={cn('flex w-full flex-col gap-3', CONNECTION_FIELDS_MIN_HEIGHT_CLASS)}>
              {renderConnectionFields()}
            </div>
          </FormSection>

          {isAnalyticsDataSourceType(page.form.type) ? (
            <FormSection
              title="Analytics options"
              hint="Provider extras (catalog/cube, collection, index, field whitelist) stored as JSON. Secrets stay in the credential vault."
              ink="accent"
              divided
            >
              <FormField
                label="Options JSON"
                className={FORM_FIELD_CLASS}
                hint={
                  page.form.type === DataSourceType.OLAP_BRIDGE
                    ? 'catalog, cube, language (MDX or DAX), optional fields whitelist.'
                    : page.form.type === DataSourceType.MONGODB_ANALYTICS
                      ? 'collection and optional fields whitelist.'
                      : 'index and optional fields whitelist.'
                }
              >
                <UiInput
                  size="sm"
                  autoDir={false}
                  value={page.form.optionsJson}
                  onChange={(e) => page.setForm((prev: DataSourceFormState) => ({ ...prev, optionsJson: e.target.value }))}
                  placeholder='{"catalog":"Adventure Works","cube":"Sales"}'
                  ariaLabel="Analytics options JSON"
                />
              </FormField>
            </FormSection>
          ) : null}
        </div>
      </CreateEditModalShell>
    </>
  );
};
