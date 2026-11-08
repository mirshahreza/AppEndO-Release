import React from 'react';
import {
  CheckCircle2,
  Loader2,
  Rocket,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  AppButton,
  AppToast,
  FeatureToggleField,
  FormField,
  FormSection,
  StepWizardShell,
  UiCheckboxChoice,
  UiInput,
  UiOptionCardGroup,
  UiPasswordInput,
  UiTooltip,
  type UiOptionCardIcon,
} from '../../shared/ui';
import { NODE_CAPABILITY_ORDER } from '../../shared/nodeCapabilities';
import { APP_SURFACE_BOX_TONE_CLASS, type AppSurfaceBoxTone } from '../../shared/ui/surfaceClasses';
import { smtpEncryptionLabel } from '../../shared/api/contracts/settings/smtpEncryption';
import { INSTALL_COMPLETE_REDIRECT_PATH } from '../../shared/api/contracts/install/types';
import type { ControlPlaneProviderId } from '../../shared/api/contracts/install/controlPlaneProviders';
import { isSqlServerNamedInstanceHost } from '../../shared/lib/sqlServerAddress';
import { useCultureT } from '../../core/culture/CultureContext';
import { installKey } from '../../core/culture/translations/cultureKeyHelpers';
import { useInstallWizard } from './hooks/useInstallWizard';
import { InstallAdminStepFields } from './InstallAdminStepFields';
import { InstallEmailStepFields } from './InstallEmailStepFields';
import { InstallDatabaseProviderIcon } from './components/InstallDatabaseProviderIcon';
import {
  InstallFormField,
} from './components/InstallFormField';
import { InstallProgressDialog } from './InstallProgressDialog';
import { InstallWizardPageShell } from './InstallWizardPageShell';
import { getInstallAdminExistingAccountMessage } from './installWizardI18n';
import {
  INSTALL_CACHE_MODE_VISUAL,
  INSTALL_CAPABILITY_VISUAL,
  INSTALL_TOPOLOGY_MODE_VISUAL,
  type InstallTopologyMode,
} from './installWizardSteps';
import { installWizardFieldProps } from './installWizardFieldErrors';

const INSTALL_DATABASE_PROVIDER_ICONS: Record<ControlPlaneProviderId, UiOptionCardIcon> = {
  postgresql: ({ className }) => <InstallDatabaseProviderIcon provider="postgresql" className={className} />,
  mysql: ({ className }) => <InstallDatabaseProviderIcon provider="mysql" className={className} />,
  sqlserver: ({ className }) => <InstallDatabaseProviderIcon provider="sqlserver" className={className} />,
  sqlite: ({ className }) => <InstallDatabaseProviderIcon provider="sqlite" className={className} />,
};

const SELECTED_CACHE_RING: Record<AppSurfaceBoxTone, string> = {
  slate: 'ring-slate-200',
  violet: 'ring-violet-200',
  cyan: 'ring-cyan-200',
  indigo: 'ring-indigo-200',
  emerald: 'ring-emerald-200',
  amber: 'ring-amber-200',
  rose: 'ring-rose-200',
};

export const InstallWizardPage: React.FC = () => {
  const t = useCultureT();
  const wizard = useInstallWizard();
  const installProgressActive = wizard.installProgress != null;

  const progressDialog = (
    <InstallProgressDialog
      progress={wizard.installProgress}
      onClose={wizard.dismissInstallProgress}
      onGoHome={wizard.goHomeAfterInstall}
    />
  );

  if (wizard.statusQuery.isLoading && !installProgressActive) {
    return (
      <InstallWizardPageShell showLogo={false}>
        {progressDialog}
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </InstallWizardPageShell>
    );
  }

  const installCompleted = wizard.statusQuery.data?.install.completed;

  if (installCompleted && !installProgressActive) {
    return (
      <InstallWizardPageShell>
        {progressDialog}
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          <div className="text-lg font-semibold text-slate-800">{t(installKey('alreadyComplete'))}</div>
          <AppButton intent="primary" onClick={() => window.location.assign(INSTALL_COMPLETE_REDIRECT_PATH)}>
            {t(installKey('openStudio'))}
          </AppButton>
        </div>
      </InstallWizardPageShell>
    );
  }

  const renderStepBody = () => {
    switch (wizard.currentStepId) {
      case 'welcome':
        return (
          <div className="space-y-4 text-sm text-slate-600">
            <p className="leading-relaxed">
              {t(installKey('welcome.introPrefix'))}{' '}
              <span className="font-medium text-indigo-700">{t(installKey('welcome.term.node'))}</span>:{' '}
              <span className="font-medium text-amber-700">{t(installKey('welcome.term.cache'))}</span>,{' '}
              <span className="font-medium text-emerald-700">{t(installKey('welcome.term.capabilities'))}</span>,{' '}
              <span className="font-medium text-cyan-700">{t(installKey('welcome.term.database'))}</span>,{' '}
              <span className="font-medium text-violet-700">{t(installKey('welcome.term.admin'))}</span>, and{' '}
              <span className="font-medium text-rose-700">{t(installKey('welcome.term.email'))}</span>.
            </p>
            <ul className="list-disc ps-5 space-y-2">
              <li>
                {t(installKey('welcome.bullet1Prefix'))}{' '}
                <span className="font-medium text-cyan-700">{t(installKey('welcome.bullet1Term'))}</span>{' '}
                {t(installKey('welcome.bullet1Suffix'))}
              </li>
              <li>
                {t(installKey('welcome.bullet2Part1'))}{' '}
                <span className="font-medium text-slate-700">{t(installKey('welcome.bullet2Emphasis'))}</span>{' '}
                {t(installKey('welcome.bullet2Part2'))}{' '}
                <span className="font-medium text-cyan-700">{t(installKey('welcome.bullet2Db'))}</span>{' '}
                {t(installKey('welcome.bullet2And'))}{' '}
                <span className="font-medium text-amber-700">{t(installKey('welcome.bullet2Redis'))}</span>
              </li>
              <li>
                {t(installKey('welcome.bullet3Part1'))}{' '}
                <span className="font-medium text-cyan-700">{t(installKey('welcome.bullet3Service'))}</span>{' '}
                {t(installKey('welcome.bullet3Part2'))}{' '}
                <span className="font-medium text-indigo-700">{t(installKey('welcome.bullet3Proxy'))}</span>
              </li>
            </ul>
          </div>
        );
      case 'database': {
        const isSqlite = wizard.databaseForm.provider === 'sqlite';
        const isSqlServer = wizard.databaseForm.provider === 'sqlserver';
        const isSqlServerNamedInstance = isSqlServer && isSqlServerNamedInstanceHost(wizard.databaseForm.host);
        const dbErrors = wizard.databaseFieldErrors;
        const selectedProviderDescription = wizard.controlPlaneProviderOptions.find(
          (item) => item.id === wizard.databaseForm.provider,
        )?.description;
        return (
          <div className="flex flex-col gap-1">
            <FormSection title={t(installKey('database.section.provider'))} ink="accent">
              <FormField
                label={t(installKey('database.controlPlaneDatabase'))}
                labelExtra={selectedProviderDescription ? (
                  <span className="min-w-0 truncate text-xs font-normal text-slate-500">
                    — {selectedProviderDescription}
                  </span>
                ) : null}
              >
                <UiOptionCardGroup
                  value={wizard.databaseForm.provider}
                  onChange={(value) => wizard.setDatabaseProvider(value as ControlPlaneProviderId)}
                  ariaLabel={t(installKey('database.providerAria'))}
                  columns={4}
                  density="compact"
                  accentClassName="border-cyan-300 bg-cyan-50/50"
                  accentIconClassName="text-cyan-700"
                  options={wizard.controlPlaneProviderOptions.map((option) => ({
                    value: option.id,
                    title: option.label,
                    icon: INSTALL_DATABASE_PROVIDER_ICONS[option.id],
                  }))}
                />
              </FormField>
            </FormSection>
            <FormSection title={t(installKey('database.section.schemaSetup'))} ink="complement" divided>
              <div className="grid grid-cols-2 gap-3">
                <FeatureToggleField
                  id="install-override-existing"
                  checked={wizard.overrideExistingObjects}
                  onChange={(checked) => wizard.setOverrideExisting(checked)}
                  title={t(installKey('database.overrideExisting'))}
                  description={t(installKey('database.overrideExistingHint'))}
                  descriptionClassName={wizard.overrideExistingObjects ? 'font-bold text-rose-600' : undefined}
                />
                <FeatureToggleField
                  id="install-seed-sample-data"
                  checked={wizard.seedSampleData}
                  onChange={(checked) => wizard.setSeedSampleData(checked)}
                  title={t(installKey('database.seedSampleData'))}
                  description={t(installKey('database.seedSampleDataHint'))}
                />
              </div>
            </FormSection>
            <FormSection
              title={t(installKey('database.section.connection'))}
              ink="contrast"
              divided
              headerExtra={(
                <AppButton
                  intent="secondary"
                  onClick={() => void wizard.testDatabaseConnection()}
                  disabled={wizard.isBusy}
                >
                  {wizard.isTestingDatabase ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t(installKey('database.testing'))}
                    </>
                  ) : (
                    t(installKey('database.testConnection'))
                  )}
                </AppButton>
              )}
            >
              <div className="flex flex-col gap-3">
                {isSqlite ? (
                  <>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900">
                      {t(installKey('database.sqliteWarning'))}
                    </div>
                    <FormField label={t(installKey('database.sqlitePath'))} required {...installWizardFieldProps(dbErrors.database)}>
                      <UiInput
                        value={wizard.databaseForm.database}
                        onChange={(e) => wizard.setDatabaseForm((prev) => ({ ...prev, database: e.target.value }))}
                        ariaLabel={t(installKey('database.sqlitePathAria'))}
                        placeholder={t(installKey('database.sqlitePathPlaceholder'))}
                      />
                    </FormField>
                    <p className="ps-[4px] text-xs text-slate-500 leading-relaxed">
                      {t(installKey('database.sqlitePathHint'))}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)] gap-3">
                        <FormField label={t(installKey('database.host'))} required {...installWizardFieldProps(dbErrors.host)}>
                          <UiInput
                            value={wizard.databaseForm.host}
                            onChange={(e) => wizard.setDatabaseHost(e.target.value)}
                            ariaLabel={t(installKey('database.hostAria'))}
                          />
                        </FormField>
                        <FormField
                          label={t(installKey('database.port'))}
                          required={!isSqlServerNamedInstance}
                          {...installWizardFieldProps(dbErrors.port)}
                        >
                          <UiInput
                            type="number"
                            value={isSqlServerNamedInstance ? '' : wizard.databaseForm.port}
                            onChange={(e) => wizard.setDatabaseForm((prev) => ({ ...prev, port: Number(e.target.value || 0) }))}
                            ariaLabel={t(installKey('database.portAria'))}
                            disabled={isSqlServerNamedInstance}
                          />
                        </FormField>
                        <FormField label={t(installKey('database.database'))} required {...installWizardFieldProps(dbErrors.database)}>
                          <UiInput
                            value={wizard.databaseForm.database}
                            onChange={(e) => wizard.setDatabaseForm((prev) => ({ ...prev, database: e.target.value }))}
                            ariaLabel={t(installKey('database.databaseAria'))}
                          />
                        </FormField>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label={t(installKey('database.username'))} required {...installWizardFieldProps(dbErrors.username)}>
                          <UiInput
                            value={wizard.databaseForm.username}
                            onChange={(e) => wizard.setDatabaseForm((prev) => ({ ...prev, username: e.target.value }))}
                            ariaLabel={t(installKey('database.usernameAria'))}
                          />
                        </FormField>
                        <FormField label={t(installKey('database.password'))}>
                          <UiPasswordInput
                            value={wizard.databaseForm.password}
                            onChange={(e) => wizard.setDatabaseForm((prev) => ({ ...prev, password: e.target.value }))}
                            ariaLabel={t(installKey('database.passwordAria'))}
                          />
                        </FormField>
                      </div>
                    </div>
                    {isSqlServer ? (
                      <div className="flex flex-wrap items-center gap-4">
                        <UiCheckboxChoice
                          id="install-db-encrypt"
                          checked={wizard.databaseForm.encrypt !== false}
                          onChange={(checked) => wizard.setDatabaseForm((prev) => ({ ...prev, encrypt: checked }))}
                          className="!w-auto"
                        >
                          {t(installKey('database.encryptConnection'))}
                        </UiCheckboxChoice>
                        <UiCheckboxChoice
                          id="install-db-trust-cert"
                          checked={wizard.databaseForm.trustServerCertificate !== false}
                          onChange={(checked) => wizard.setDatabaseForm((prev) => ({ ...prev, trustServerCertificate: checked }))}
                          className="!w-auto"
                        >
                          {t(installKey('database.trustServerCertificate'))}
                        </UiCheckboxChoice>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </FormSection>
          </div>
        );
      }
      case 'cache': {
        const cacheErrors = wizard.cacheFieldErrors;
        return (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed ps-[4px]">
              {t(installKey('cache.intro'))}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {wizard.cacheModeOptions.map((option) => {
                const selected = wizard.cacheDriver === option.id;
                const visual = INSTALL_CACHE_MODE_VISUAL[option.id];
                const tokens = APP_SURFACE_BOX_TONE_CLASS[visual.tone];
                const OptionIcon = visual.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => wizard.setCacheDriver(option.id)}
                    className={cn(
                      'flex h-full min-h-0 w-full min-w-0 flex-col rounded-lg border px-3 py-3 text-left transition-colors',
                      selected
                        ? cn(tokens.shell, tokens.strip, 'ring-1 ring-inset', SELECTED_CACHE_RING[visual.tone])
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80',
                    )}
                  >
                    <div className="mb-2 flex h-14 shrink-0 items-center gap-3">
                      <span
                        className={cn(
                          'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
                          selected ? 'bg-white/80' : tokens.strip,
                        )}
                      >
                        <OptionIcon className={cn('h-6 w-6', tokens.title)} aria-hidden />
                      </span>
                      <div
                        className={cn(
                          'min-w-0 whitespace-nowrap text-4xl font-bold leading-none tracking-tight',
                          selected ? tokens.title : 'text-slate-800',
                        )}
                      >
                        {option.title}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col space-y-1 text-slate-500">
                      {option.descriptionLines.map((line) => (
                        <p key={line} className="ps-[4px] text-[11px] leading-snug">
                          {line}
                        </p>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            {wizard.cacheDriver === 'redis' ? (
              <FormSection
                title={t(installKey('cache.redisConnection'))}
                ink="contrast"
                headerExtra={(
                  <AppButton
                    intent="secondary"
                    onClick={() => void wizard.testRedisConnection()}
                    disabled={wizard.isBusy}
                  >
                    {wizard.isTestingRedis ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {t(installKey('database.testing'))}
                      </>
                    ) : (
                      t(installKey('database.testConnection'))
                    )}
                  </AppButton>
                )}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_250px] gap-3 items-start">
                  <FormField label={t(installKey('database.host'))} required {...installWizardFieldProps(cacheErrors.host)}>
                    <UiInput
                      value={wizard.redisForm.host}
                      onChange={(e) => wizard.setRedisForm((prev) => ({ ...prev, host: e.target.value }))}
                      ariaLabel={t(installKey('database.hostAria'))}
                    />
                  </FormField>
                  <FormField label={t(installKey('database.port'))} required {...installWizardFieldProps(cacheErrors.port)}>
                    <UiInput
                      type="number"
                      value={wizard.redisForm.port}
                      onChange={(e) => wizard.setRedisForm((prev) => ({ ...prev, port: Number(e.target.value || 0) }))}
                      ariaLabel={t(installKey('database.portAria'))}
                    />
                  </FormField>
                  <FormField label={t(installKey('cache.dbIndex'))}>
                    <UiInput
                      type="number"
                      value={wizard.redisForm.dbIndex ?? 0}
                      onChange={(e) => wizard.setRedisForm((prev) => ({ ...prev, dbIndex: Number(e.target.value || 0) }))}
                      ariaLabel={t(installKey('cache.dbIndexAria'))}
                    />
                  </FormField>
                  <FormField label={t(installKey('cache.passwordOptional'))} className="min-w-0">
                    <div className="w-[250px] max-w-full">
                      <UiPasswordInput
                        value={wizard.redisForm.password ?? ''}
                        onChange={(e) => wizard.setRedisForm((prev) => ({ ...prev, password: e.target.value }))}
                        ariaLabel={t(installKey('cache.passwordAria'))}
                      />
                    </div>
                  </FormField>
                </div>
              </FormSection>
            ) : null}
          </div>
        );
      }
      case 'email':
        return (
          <InstallEmailStepFields
            emailForm={wizard.emailForm}
            emailFieldErrors={wizard.emailFieldErrors}
            installServerWarning={wizard.installServerWarning}
            isBusy={wizard.isBusy}
            isTestingEmail={wizard.isTestingEmail}
            onTestEmailConnection={wizard.testEmailConnection}
            onFromEmailChange={wizard.setEmailFromEmail}
            onFromNameChange={wizard.setEmailFromName}
            onSmtpHostChange={wizard.setEmailSmtpHost}
            onEmailFormChange={wizard.setEmailForm}
            onSmtpUserChange={wizard.setEmailSmtpUser}
          />
        );
      case 'admin':
        return (
          <InstallAdminStepFields
            fieldsDisabled={!wizard.adminStepEnabled}
            fieldErrors={wizard.adminFieldErrors}
            values={{
              username: wizard.adminUsername,
              email: wizard.adminEmail,
              password: wizard.adminPassword,
              confirmPassword: wizard.adminConfirmPassword,
              firstName: wizard.adminFirstName,
              lastName: wizard.adminLastName,
              phone: wizard.adminPhone,
              profileImageBody: wizard.adminProfileImageBody,
              profileImageBodyXs: wizard.adminProfileImageBodyXs,
              profileImageMime: wizard.adminProfileImageMime,
            }}
            onUsernameChange={wizard.setAdminUsername}
            onEmailChange={wizard.setAdminEmail}
            onPasswordChange={wizard.setAdminPassword}
            onConfirmPasswordChange={wizard.setAdminConfirmPassword}
            onFirstNameChange={wizard.setAdminFirstName}
            onLastNameChange={wizard.setAdminLastName}
            onPhoneChange={wizard.setAdminPhone}
            onProfileImageChange={wizard.setAdminProfileImage}
            onImageReadError={wizard.handleAdminImageReadError}
          />
        );
      case 'capabilities':
        return (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500 leading-snug ps-[4px]">
              {t(installKey('capabilities.intro'))}
            </p>
            <UiOptionCardGroup
              value={wizard.topologyMode}
              onChange={(value) => wizard.setTopologyMode(value as InstallTopologyMode)}
              ariaLabel={t(installKey('summary.topology'))}
              columns={2}
              density="compact"
              accentClassName="border-emerald-300 bg-emerald-50/50"
              accentIconClassName="text-emerald-700"
              options={wizard.topologyModeOptions.map((option) => ({
                value: option.id,
                title: option.title,
                description: option.description,
                icon: INSTALL_TOPOLOGY_MODE_VISUAL[option.id].icon,
              }))}
            />
            <div className="grid grid-cols-3 gap-2">
              {wizard.capabilityOptions.map((option) => {
                const checked = wizard.capabilities.includes(option.id);
                const visual = INSTALL_CAPABILITY_VISUAL[option.id];
                const tokens = APP_SURFACE_BOX_TONE_CLASS[visual.tone];
                const OptionIcon = visual.icon;
                const capabilityLocked = wizard.isSingleNodeTopology;
                return (
                  <div
                    key={option.id}
                    className={cn(
                      'min-w-0 rounded-lg border px-2.5 py-2 transition-colors',
                      capabilityLocked
                        ? 'border-slate-200 bg-slate-50/70'
                        : checked
                          ? cn(tokens.shell, tokens.strip, 'ring-1 ring-inset')
                          : 'border-slate-200 bg-white',
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          className={cn(
                            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                            capabilityLocked
                              ? 'bg-slate-100'
                              : checked
                                ? 'bg-white/80'
                                : tokens.strip,
                          )}
                        >
                          <OptionIcon
                            className={cn(
                              'h-3.5 w-3.5',
                              capabilityLocked ? 'text-slate-400' : tokens.title,
                            )}
                            aria-hidden
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <UiCheckboxChoice
                            id={`install-capability-${option.id}`}
                            checked={checked}
                            disabled={capabilityLocked}
                            onChange={(nextChecked) => wizard.toggleCapability(option.id, nextChecked)}
                          >
                            <span
                              className={cn(
                                'text-xs font-semibold leading-tight',
                                capabilityLocked
                                  ? 'text-slate-500'
                                  : checked
                                    ? tokens.title
                                    : 'text-slate-800',
                              )}
                            >
                              {option.title}
                              {option.singleton ? (
                                <span
                                  className={cn(
                                    'ms-1 block text-[9px] font-semibold uppercase tracking-wide',
                                    capabilityLocked ? 'text-slate-400' : 'text-amber-700',
                                  )}
                                >
                                  {t(installKey('capabilities.onePerDeployment'))}
                                </span>
                              ) : null}
                            </span>
                          </UiCheckboxChoice>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'space-y-1 ps-[4px]',
                          capabilityLocked ? 'text-slate-400' : 'text-slate-500',
                        )}
                      >
                        {option.descriptionLines.map((line) => (
                          <p key={line} className="text-[11px] leading-snug">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <InstallFormField label={t(installKey('capabilities.nodeName'))} required {...installWizardFieldProps(wizard.capabilitiesFieldErrors.nodeName)}>
              <UiInput
                value={wizard.nodeName}
                onChange={(e) => wizard.setNodeName(e.target.value)}
                ariaLabel={t(installKey('capabilities.nodeNameAria'))}
              />
            </InstallFormField>
          </div>
        );
      case 'summary': {
        const topologyModeLabel = wizard.topologyModeOptions.find((o) => o.id === wizard.topologyMode)?.title ?? wizard.topologyMode;
        const capabilityLabels = NODE_CAPABILITY_ORDER
          .filter((id) => wizard.capabilities.includes(id))
          .map((id) => wizard.capabilityOptions.find((o) => o.id === id)?.title ?? id)
          .join(', ');
        const cacheModeLabel = wizard.cacheModeOptions.find((o) => o.id === wizard.cacheDriver)?.title ?? wizard.cacheDriver;
        const emailSummaryUntested = !wizard.emailConnectionTested;

        return (
          <div className="grid grid-cols-2 gap-2">
              <CompactSummaryCard title={t(installKey('summary.topology'))} tone="emerald" rows={[
                { label: t(installKey('summary.mode')), value: topologyModeLabel },
                { label: t(installKey('summary.node')), value: wizard.nodeName },
                { label: t(installKey('summary.caps')), value: capabilityLabels },
              ]}
              />
              <CompactSummaryCard title={t(installKey('summary.database'))} tone="cyan" rows={
                wizard.databaseForm.provider === 'sqlite'
                  ? [
                    { label: t(installKey('summary.db')), value: wizard.databaseForm.database },
                    { label: t(installKey('summary.schema')), value: wizard.overrideExistingObjects ? t(installKey('summary.schemaReplace')) : t(installKey('summary.schemaKeep')) },
                    { label: t(installKey('summary.samples')), value: wizard.seedSampleData ? t(installKey('summary.yes')) : t(installKey('summary.no')) },
                  ]
                  : [
                    { label: t(installKey('summary.host')), value: `${wizard.databaseForm.host}:${wizard.databaseForm.port}` },
                    { label: t(installKey('summary.db')), value: wizard.databaseForm.database },
                    { label: t(installKey('summary.user')), value: wizard.databaseForm.username },
                    { label: t(installKey('summary.schema')), value: wizard.overrideExistingObjects ? t(installKey('summary.schemaReplace')) : t(installKey('summary.schemaKeep')) },
                    { label: t(installKey('summary.samples')), value: wizard.seedSampleData ? t(installKey('summary.yes')) : t(installKey('summary.no')) },
                  ]
              }
              />
              <CompactSummaryCard
                title={t(installKey('summary.cache'))}
                tone="amber"
                rows={
                  wizard.cacheDriver === 'redis'
                    ? [
                      { label: t(installKey('summary.driver')), value: cacheModeLabel },
                      { label: t(installKey('summary.host')), value: `${wizard.redisForm.host}:${wizard.redisForm.port}` },
                      { label: t(installKey('summary.db')), value: String(wizard.redisForm.dbIndex ?? 0) },
                    ]
                    : [{ label: t(installKey('summary.driver')), value: cacheModeLabel }]
                }
              />
              <CompactSummaryCard
                title={t(installKey('summary.admin'))}
                tone="violet"
                rows={
                  wizard.adminStepEnabled
                    ? [
                      { label: t(installKey('admin.username')), value: wizard.adminUsername },
                      { label: t(installKey('admin.email')), value: wizard.adminEmail },
                      ...(wizard.adminFirstName.trim() ? [{ label: t(installKey('summary.first')), value: wizard.adminFirstName.trim() }] : []),
                      ...(wizard.adminLastName.trim() ? [{ label: t(installKey('summary.last')), value: wizard.adminLastName.trim() }] : []),
                      ...(wizard.adminPhone.trim() ? [{ label: t(installKey('summary.phone')), value: wizard.adminPhone.trim() }] : []),
                      ...(wizard.adminProfileImageBody ? [{ label: t(installKey('summary.photo')), value: t(installKey('summary.yes')) }] : []),
                    ]
                    : [{ label: t(installKey('summary.account')), value: getInstallAdminExistingAccountMessage(t) }]
                }
              />
              <CompactSummaryCard title={t(installKey('summary.email'))} tone="rose" warning={emailSummaryUntested} warningTooltip={t(installKey('summary.emailWarning'))} rows={[
                { label: t(installKey('summary.smtp')), value: `${wizard.emailForm.smtpHost}:${wizard.emailForm.smtpPort}` },
                { label: t(installKey('summary.user')), value: wizard.emailForm.smtpUser },
                { label: t(installKey('summary.from')), value: wizard.emailForm.smtpFromEmail },
                { label: t(installKey('summary.enc')), value: smtpEncryptionLabel(wizard.emailForm.smtpSecure) },
                { label: t(installKey('summary.smtpTest')), value: wizard.emailConnectionTested ? t(installKey('summary.verified')) : t(installKey('summary.notTested')) },
              ]}
              />
            </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <InstallWizardPageShell>
      {progressDialog}
      {wizard.toast ? <AppToast type={wizard.toast.type} text={wizard.toast.text} /> : null}
      {wizard.installServerWarning ? (
        <div className="mb-3 w-full max-w-3xl rounded-none border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:mb-4 md:rounded-xl">
          {wizard.installServerWarning}
        </div>
      ) : null}
      <div className="install-wizard-elevated flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col md:h-auto md:flex-none">
        <StepWizardShell
          embedded
          size="3xl"
          title={t(installKey('title'))}
          titleIcon={Rocket}
          subtitle={t(installKey('subtitle'))}
          steps={wizard.wizardSteps}
          step={wizard.stepIndex}
          onStepChange={wizard.setStepIndex}
          onClose={() => undefined}
          showCloseButton={false}
          shellOrbitBorder
          shellOrbitCometCount={4}
          shellOrbitTailLength={80}
          shellOrbitBorderWidth={0.7}
          shellOrbitGlowBlur={3}
          canMovePrev={wizard.stepIndex > 0 && !wizard.isBusy}
          canMoveNext={!wizard.isLastStep && !wizard.isBusy && wizard.canProceedFromCurrentStep}
          canActivateStep={wizard.canActivateStep}
          onNext={() => wizard.handleNext()}
          finalStepAction={wizard.isLastStep ? {
            label: wizard.isBusy ? t(installKey('installing')) : t(installKey('completeInstall')),
            icon: wizard.isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />,
            onClick: () => void wizard.finishInstall(),
            disabled: wizard.isBusy,
          } : undefined}
          shellClassName="flex-1 h-full min-h-0 max-h-none rounded-none md:h-[calc(52rem-130px)] md:max-h-[min(calc(52rem-130px),calc(100dvh-5rem))] md:flex-none md:rounded-xl lg:max-h-[calc(52rem-130px)]"
          bodyInnerClassName="min-h-0"
          stepIndicatorsClassName="overflow-x-auto"
          stepDescriptionClassName="bg-lime-50/35"
          onBackdropClick={() => undefined}
        >
          {renderStepBody()}
        </StepWizardShell>
      </div>
    </InstallWizardPageShell>
  );
};

const TONE_ACCENT_BAR: Record<AppSurfaceBoxTone, string> = {
  slate: 'bg-slate-400',
  violet: 'bg-violet-400',
  cyan: 'bg-cyan-500',
  indigo: 'bg-indigo-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
};

const CompactSummaryCard: React.FC<{
  title: string;
  tone: AppSurfaceBoxTone;
  rows: Array<{ label: string; value: React.ReactNode }>;
  className?: string;
  warning?: boolean;
  warningTooltip?: string;
}> = ({ title, tone, rows, className, warning = false, warningTooltip }) => {
  const tokens = APP_SURFACE_BOX_TONE_CLASS[tone];
  const card = (
    <div
      className={cn(
        'rounded-lg border px-2.5 py-2',
        warning ? 'border-amber-200 bg-amber-50/90' : 'border-slate-100 bg-slate-50/50',
        className,
      )}
    >
      <div className={cn(
        'mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide',
        warning ? 'text-amber-900' : tokens.title,
      )}
      >
        <span className={cn('h-2.5 w-0.5 shrink-0 rounded-full', warning ? 'bg-amber-400' : TONE_ACCENT_BAR[tone])} aria-hidden />
        {title}
      </div>
      <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs leading-tight">
        {rows.map((row) => (
          <React.Fragment key={row.label}>
            <span className={cn('whitespace-nowrap font-semibold', warning ? 'text-amber-700/80' : 'text-slate-400')}>{row.label}</span>
            <span
              className={cn('min-w-0 truncate', warning ? 'text-amber-950' : 'text-slate-700')}
              title={typeof row.value === 'string' ? row.value : undefined}
            >
              {row.value}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  if (warning && warningTooltip) {
    return (
      <UiTooltip
        className="block w-full cursor-help text-left outline-none"
        contentClassName="z-[9999] max-w-[16rem] border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950 shadow-md"
        content={warningTooltip}
      >
        {card}
      </UiTooltip>
    );
  }

  return card;
};
