import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { AppToastType } from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import type {
  InstallDatabasePayload,
  InstallEmailPayload,
  InstallRedisPayload,
} from '../../../shared/api/contracts/install/types';
import { INSTALL_WIZARD_API_VERSION, INSTALL_COMPLETE_REDIRECT_PATH } from '../../../shared/api/contracts/install/types';
import { DEFAULT_SETTINGS } from '../../../shared/api/contracts/settings/constants';
import type { CacheDriver } from '../../../shared/api/contracts/cache/types';
import type { NodeCapability } from '../../../shared/nodeCapabilities';
import {
  installQueryKeys,
  useInstallCompleteMutation,
  useInstallConfigureAdminMutation,
  useInstallInitDatabaseMutation,
  useInstallSaveCapabilitiesMutation,
  useInstallSaveCacheMutation,
  useInstallSaveDatabaseMutation,
  useInstallSaveEmailMutation,
  useInstallSkipEmailMutation,
  useInstallStatusQuery,
  useInstallTestDatabaseMutation,
  useInstallTestEmailMutation,
  useInstallTestRedisMutation,
} from '../../../shared/api/queries/install';
import { refetchPlatformBootQueries } from '../../../shared/api/queries/platform';
import { queryClient } from '../../../shared/api/queryClient';
import { formatQueryError } from '../../../shared/api/client';
import {
  DEFAULT_INSTALL_CAPABILITIES,
  inferTopologyMode,
  SINGLE_NODE_TOPOLOGY_NAME,
  suggestNodeNameFromCapabilities,
  type InstallTopologyMode,
  type InstallWizardStepId,
} from '../installWizardSteps';
import { installKey } from '../../../core/culture/translations/cultureKeyHelpers';
import {
  getInstallCapabilityOptions,
  getInstallCacheModeOptions,
  getInstallTopologyModeOptions,
  getInstallWizardStepMeta,
  installText,
} from '../installWizardI18n';
import { validateInstallWizardStep, validateEmailStep, defaultDatabasePortForProvider } from '../installWizardValidation';
import {
  getAdminFieldErrors,
  getCacheFieldErrors,
  getCapabilitiesFieldErrors,
  getDatabaseFieldErrors,
  getEmailFieldErrors,
} from '../installWizardFieldErrors';
import {
  isInstallAdminStepEnabled,
  VISIBLE_INSTALL_WIZARD_STEP_IDS,
} from '../installWizardStepOrder';
import {
  clearInstallWizardSession,
  readInitialInstallWizardState,
} from '../installWizardSession';
import {
  CONTROL_PLANE_PROVIDER_OPTIONS,
  defaultControlPlaneInstallFields,
  defaultDatabaseNameForProvider,
  defaultDatabaseUsernameForProvider,
  type ControlPlaneProviderId,
} from '../../../shared/api/contracts/install/controlPlaneProviders';
import type { InstallProgressState, InstallProgressStepStatus } from '../InstallProgressDialog';
import { createInstallExecutionStepsWithSkips, resolveInstallExecutionSkipFlags } from '../installExecutionSteps';
import { isSqlServerNamedInstanceHost } from '../../../shared/lib/sqlServerAddress';

const initialWizardState = readInitialInstallWizardState();

const defaultRedis = (): InstallRedisPayload => ({
  host: '127.0.0.1',
  port: 6379,
  password: '',
  dbIndex: 0,
});

const defaultDatabase = (): InstallDatabasePayload => ({
  ...defaultControlPlaneInstallFields(),
  overrideExistingObjects: false,
  seedSampleData: false,
});

const defaultEmail = (): InstallEmailPayload => ({
  smtpHost: '',
  smtpPort: DEFAULT_SETTINGS.smtpPort,
  smtpUser: '',
  smtpPass: '',
  smtpFromEmail: '',
  smtpFromName: '',
  smtpSecure: false,
});

const deriveFromNameFromEmail = (email: string): string => {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  return atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed;
};

const deriveSmtpHostFromEmail = (email: string): string => {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex < 0) {
    return '';
  }
  const domainPart = trimmed.slice(atIndex + 1);
  return domainPart ? `smtp.${domainPart}` : 'smtp.';
};

export function useInstallWizard() {
  const t = useCultureT();
  const statusQuery = useInstallStatusQuery();

  const [stepIndex, setStepIndex] = useState(initialWizardState.stepIndex);
  const [furthestStepIndex, setFurthestStepIndex] = useState(initialWizardState.furthestStepIndex);
  const [databaseForm, setDatabaseForm] = useState<InstallDatabasePayload>(defaultDatabase());
  const [overrideExistingObjects, setOverrideExistingObjects] = useState(false);
  const [seedSampleData, setSeedSampleDataState] = useState(false);
  const [adminUsername, setAdminUsername] = useState('Admin');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('Sys');
  const [adminLastName, setAdminLastName] = useState('Admin');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminProfileImageBody, setAdminProfileImageBody] = useState<string | null>(null);
  const [adminProfileImageBodyXs, setAdminProfileImageBodyXs] = useState<string | null>(null);
  const [adminProfileImageMime, setAdminProfileImageMime] = useState<string | null>(null);
  const adminUsernameManuallyEditedRef = useRef(false);
  const adminEmailManuallyEditedRef = useRef(false);
  const emailSmtpFromEmailManuallyEditedRef = useRef(false);
  const emailFromNameManuallyEditedRef = useRef(false);
  const emailSmtpUserManuallyEditedRef = useRef(false);
  const emailSmtpHostManuallyEditedRef = useRef(false);
  const databaseFormManuallyEditedRef = useRef(false);
  const [capabilities, setCapabilities] = useState<NodeCapability[]>(DEFAULT_INSTALL_CAPABILITIES);
  const [topologyMode, setTopologyModeState] = useState<InstallTopologyMode>('single-node');
  const [nodeName, setNodeNameState] = useState(SINGLE_NODE_TOPOLOGY_NAME);
  const nodeNameManuallyEditedRef = useRef(false);
  const [cacheDriver, setCacheDriver] = useState<CacheDriver>('memory');
  const [redisForm, setRedisForm] = useState<InstallRedisPayload>(defaultRedis);
  const [emailForm, setEmailForm] = useState<InstallEmailPayload>(defaultEmail);
  const [emailPasswordSaved, setEmailPasswordSaved] = useState(false);
  const [emailConnectionTested, setEmailConnectionTested] = useState(false);
  const [installServerWarning, setInstallServerWarning] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: AppToastType; text: string } | null>(null);
  const [installProgress, setInstallProgress] = useState<InstallProgressState | null>(
    initialWizardState.installProgress,
  );

  const testDatabase = useInstallTestDatabaseMutation();
  const saveDatabase = useInstallSaveDatabaseMutation();
  const initDatabase = useInstallInitDatabaseMutation();
  const configureAdmin = useInstallConfigureAdminMutation();
  const saveCapabilities = useInstallSaveCapabilitiesMutation();
  const testRedis = useInstallTestRedisMutation();
  const saveCache = useInstallSaveCacheMutation();
  const testEmail = useInstallTestEmailMutation();
  const saveEmail = useInstallSaveEmailMutation();
  const skipEmail = useInstallSkipEmailMutation();
  const completeInstall = useInstallCompleteMutation();

  const showToast = useCallback((type: AppToastType, text: string) => {
    setToast({ type, text });
  }, []);

  const syncAdminFieldsFromEmailStep = useCallback(() => {
    if (!adminEmailManuallyEditedRef.current) {
      const fromEmail = String(emailForm.smtpFromEmail ?? '').trim().toLowerCase();
      if (fromEmail) {
        setAdminEmail(fromEmail);
      }
    }
  }, [emailForm.smtpFromEmail]);

  const setAdminEmailValue = useCallback((value: string) => {
    adminEmailManuallyEditedRef.current = true;
    setAdminEmail(value);
  }, []);

  const setAdminUsernameValue = useCallback((value: string) => {
    adminUsernameManuallyEditedRef.current = true;
    setAdminUsername(value);
  }, []);

  const setEmailFromEmail = useCallback((value: string) => {
    emailSmtpFromEmailManuallyEditedRef.current = true;
    setEmailForm((prev) => ({
      ...prev,
      smtpFromEmail: value,
      smtpFromName: emailFromNameManuallyEditedRef.current
        ? prev.smtpFromName
        : deriveFromNameFromEmail(value),
      smtpUser: emailSmtpUserManuallyEditedRef.current
        ? prev.smtpUser
        : deriveFromNameFromEmail(value),
      smtpHost: emailSmtpHostManuallyEditedRef.current
        ? prev.smtpHost
        : deriveSmtpHostFromEmail(value),
    }));
  }, []);

  const prefillEmailFromAdmin = useCallback(() => {
    if (emailSmtpFromEmailManuallyEditedRef.current) {
      return;
    }
    const fromEmail = adminEmail.trim().toLowerCase();
    if (!fromEmail) {
      return;
    }
    setEmailForm((prev) => ({
      ...prev,
      smtpFromEmail: fromEmail,
      smtpFromName: emailFromNameManuallyEditedRef.current
        ? prev.smtpFromName
        : deriveFromNameFromEmail(fromEmail),
      smtpUser: emailSmtpUserManuallyEditedRef.current
        ? prev.smtpUser
        : deriveFromNameFromEmail(fromEmail),
      smtpHost: emailSmtpHostManuallyEditedRef.current
        ? prev.smtpHost
        : deriveSmtpHostFromEmail(fromEmail),
    }));
  }, [adminEmail]);

  const setEmailFromName = useCallback((value: string) => {
    emailFromNameManuallyEditedRef.current = true;
    setEmailForm((prev) => ({ ...prev, smtpFromName: value }));
  }, []);

  const setEmailSmtpUser = useCallback((value: string) => {
    emailSmtpUserManuallyEditedRef.current = true;
    setEmailForm((prev) => ({ ...prev, smtpUser: value }));
  }, []);

  const setEmailSmtpHost = useCallback((value: string) => {
    emailSmtpHostManuallyEditedRef.current = true;
    setEmailForm((prev) => ({ ...prev, smtpHost: value }));
  }, []);

  useEffect(() => {
    setEmailConnectionTested(false);
  }, [
    emailForm.smtpHost,
    emailForm.smtpPort,
    emailForm.smtpUser,
    emailForm.smtpPass,
    emailForm.smtpSecure,
  ]);

  const setDatabaseProvider = useCallback((provider: ControlPlaneProviderId) => {
    databaseFormManuallyEditedRef.current = true;
    setDatabaseForm((prev) => {
      const port = defaultDatabasePortForProvider(provider);
      const switchingProvider = prev.provider !== provider;
      const username = switchingProvider
        ? defaultDatabaseUsernameForProvider(provider)
        : prev.username;
      const database = switchingProvider
        ? defaultDatabaseNameForProvider(provider)
        : prev.database;
      if (provider === 'sqlite') {
        return {
          ...prev,
          provider,
          host: 'localhost',
          port: 0,
          database,
          username: '',
          password: '',
        };
      }
      if (provider === 'mysql') {
        return {
          ...prev,
          provider,
          host: prev.host || 'localhost',
          port: prev.provider === 'mysql' ? prev.port : port,
          database,
          username,
        };
      }
      if (provider === 'sqlserver') {
        const host = prev.host || 'localhost';
        const namedInstance = isSqlServerNamedInstanceHost(host);
        const resolvedPort = namedInstance
          ? 0
          : prev.provider === 'sqlserver'
            ? prev.port
            : port;
        return {
          ...prev,
          provider,
          host,
          port: resolvedPort,
          database,
          username,
        };
      }
      return {
        ...prev,
        provider,
        host: prev.host || 'localhost',
        port: prev.provider === 'postgresql' ? prev.port : port,
        database,
        username,
      };
    });
  }, []);

  const setDatabaseHost = useCallback((host: string) => {
    databaseFormManuallyEditedRef.current = true;
    setDatabaseForm((prev) => {
      if (prev.provider !== 'sqlserver') {
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
            ? defaultDatabasePortForProvider('sqlserver')
            : prev.port,
      };
    });
  }, []);

  const setDatabaseFormValue = useCallback((
    value: InstallDatabasePayload | ((prev: InstallDatabasePayload) => InstallDatabasePayload),
  ) => {
    databaseFormManuallyEditedRef.current = true;
    setDatabaseForm(value);
  }, []);

  useEffect(() => {
    const savedCapabilities = statusQuery.data?.install.capabilities;
    const savedName = statusQuery.data?.install.nodeName;
    const resolvedCapabilities = savedCapabilities?.length
      ? savedCapabilities
      : DEFAULT_INSTALL_CAPABILITIES;

    if (savedCapabilities?.length) {
      setCapabilities(savedCapabilities);
    }

    if (savedName) {
      const mode = inferTopologyMode(resolvedCapabilities, savedName);
      setTopologyModeState(mode);
      setNodeNameState(savedName);
      if (mode === 'single-node') {
        setCapabilities([...DEFAULT_INSTALL_CAPABILITIES]);
        setNodeNameState(SINGLE_NODE_TOPOLOGY_NAME);
        nodeNameManuallyEditedRef.current = false;
      } else {
        const suggestion = suggestNodeNameFromCapabilities(resolvedCapabilities);
        nodeNameManuallyEditedRef.current = savedName.trim() !== suggestion;
      }
    }
    const savedOverride = statusQuery.data?.install.overrideExistingObjects;
    if (savedOverride !== undefined) {
      setOverrideExistingObjects(savedOverride);
      setDatabaseForm((prev) => ({ ...prev, overrideExistingObjects: savedOverride }));
    }
    const savedSeedSampleData = statusQuery.data?.install.seedSampleData;
    if (savedSeedSampleData !== undefined) {
      setSeedSampleDataState(savedSeedSampleData);
      setDatabaseForm((prev) => ({ ...prev, seedSampleData: savedSeedSampleData }));
    }
  }, [statusQuery.data?.install]);

  useEffect(() => {
    const draft = statusQuery.data?.defaultCache;
    if (!draft) return;
    setCacheDriver(draft.driver);
    if (draft.redis) {
      setRedisForm((prev) => ({
        ...prev,
        host: draft.redis!.host,
        port: draft.redis!.port,
        dbIndex: draft.redis!.dbIndex,
        password: draft.redis!.hasPassword ? prev.password : '',
      }));
    }
  }, [statusQuery.data?.defaultCache]);

  useEffect(() => {
    syncAdminFieldsFromEmailStep();
  }, [syncAdminFieldsFromEmailStep]);

  useEffect(() => {
    const apiVersion = statusQuery.data?.apiVersion;
    if (!statusQuery.data || apiVersion === INSTALL_WIZARD_API_VERSION) {
      setInstallServerWarning(null);
      return;
    }
    setInstallServerWarning(
      t(installKey('devServerWarning')),
    );
  }, [statusQuery.data, t]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (statusQuery.data?.install.completed) {
      clearInstallWizardSession();
    }
  }, [statusQuery.data?.install.completed]);

  const adminStepEnabled = isInstallAdminStepEnabled(overrideExistingObjects, databaseForm.provider);

  const wizardSteps = useMemo(
    () => VISIBLE_INSTALL_WIZARD_STEP_IDS.map((id) => getInstallWizardStepMeta(id, t)),
    [t],
  );
  const capabilityOptions = useMemo(() => getInstallCapabilityOptions(t), [t]);
  const topologyModeOptions = useMemo(() => getInstallTopologyModeOptions(t), [t]);
  const cacheModeOptions = useMemo(() => getInstallCacheModeOptions(t), [t]);
  const currentStepId = VISIBLE_INSTALL_WIZARD_STEP_IDS[stepIndex] ?? 'welcome';
  const isLastStep = stepIndex >= VISIBLE_INSTALL_WIZARD_STEP_IDS.length - 1;

  useEffect(() => {
    if (currentStepId !== 'email') {
      return;
    }
    prefillEmailFromAdmin();
  }, [currentStepId, prefillEmailFromAdmin]);

  const currentStepValidation = useMemo(
    () => validateInstallWizardStep(currentStepId, {
      databaseForm,
      adminEmail,
      adminUsername,
      adminPassword,
      adminConfirmPassword,
      capabilities,
      nodeName,
      cacheDriver,
      redisForm,
      emailForm,
      emailPasswordSaved,
      adminStepEnabled,
    }, t),
    [
      adminConfirmPassword,
      adminEmail,
      adminUsername,
      adminPassword,
      adminStepEnabled,
      capabilities,
      cacheDriver,
      currentStepId,
      databaseForm,
      emailForm,
      emailPasswordSaved,
      nodeName,
      redisForm,
      t,
    ],
  );

  const databaseFieldErrors = useMemo(
    () => getDatabaseFieldErrors(databaseForm),
    [databaseForm],
  );

  const cacheFieldErrors = useMemo(
    () => getCacheFieldErrors({ driver: cacheDriver, redisForm }),
    [cacheDriver, redisForm],
  );

  const emailFieldErrors = useMemo(
    () => getEmailFieldErrors({
      form: emailForm,
      passwordSaved: emailPasswordSaved,
    }),
    [emailForm, emailPasswordSaved],
  );

  const adminFieldErrors = useMemo(
    () => getAdminFieldErrors({
      username: adminUsername,
      email: adminEmail,
      password: adminPassword,
      confirmPassword: adminConfirmPassword,
    }),
    [adminConfirmPassword, adminEmail, adminPassword, adminUsername],
  );

  const capabilitiesFieldErrors = useMemo(
    () => getCapabilitiesFieldErrors({
      nodeName,
      isSingleNodeTopology: topologyMode === 'single-node',
    }),
    [nodeName, topologyMode],
  );

  const canProceedFromCurrentStep = currentStepValidation.valid;

  const canActivateStep = useCallback(
    (index: number) => index <= furthestStepIndex,
    [furthestStepIndex],
  );

  const invalidateInstall = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: installQueryKeys.all });
  }, []);

  const buildDatabaseTestPayload = useCallback(() => ({
    ...databaseForm,
    overrideExistingObjects,
    seedSampleData,
  }), [databaseForm, overrideExistingObjects, seedSampleData]);

  const verifyDatabaseConnection = useCallback(async (options?: { showSuccessToast?: boolean }): Promise<boolean> => {
    try {
      const test = await testDatabase.mutateAsync(buildDatabaseTestPayload());
      if (test.status !== 'connected') {
        showToast('error', test.message || installText('toast.databaseFailed', t));
        return false;
      }
      if (options?.showSuccessToast) {
        showToast('success', test.message || installText('toast.databaseSucceeded', t));
      }
      return true;
    } catch (error) {
      showToast('error', formatQueryError(error, installText('toast.databaseFailed', t)));
      return false;
    }
  }, [buildDatabaseTestPayload, showToast, t, testDatabase]);

  const testDatabaseConnection = useCallback(async () => {
    await verifyDatabaseConnection({ showSuccessToast: true });
  }, [verifyDatabaseConnection]);

  const testRedisConnection = useCallback(async () => {
    try {
      const result = await testRedis.mutateAsync(redisForm);
      if (!result.result?.success) {
        showToast('error', result.result?.message || installText('toast.redisFailed', t));
        return;
      }
      showToast('success', result.result.message || installText('toast.redisConnected', t));
    } catch (error) {
      showToast('error', formatQueryError(error, installText('toast.redisFailed', t)));
    }
  }, [redisForm, showToast, t, testRedis]);

  const testEmailConnection = useCallback(async () => {
    const validation = validateEmailStep({
      ...emailForm,
      passwordSaved: emailPasswordSaved,
    }, t);
    if (!validation.valid) {
      showToast('error', validation.message || installText('toast.emailFieldsRequired', t));
      return;
    }

    try {
      const result = await testEmail.mutateAsync(emailForm);
      if (!result.result?.success) {
        showToast('error', result.result?.message || installText('toast.smtpFailed', t));
        return;
      }
      setEmailConnectionTested(true);
      showToast('success', result.result.message || installText('toast.smtpVerified', t));
    } catch (error) {
      showToast('error', formatQueryError(error, installText('toast.smtpFailed', t)));
    }
  }, [emailForm, emailPasswordSaved, showToast, t, testEmail]);

  const applySingleNodeTopology = useCallback(() => {
    setCapabilities([...DEFAULT_INSTALL_CAPABILITIES]);
    setNodeNameState(SINGLE_NODE_TOPOLOGY_NAME);
    nodeNameManuallyEditedRef.current = false;
  }, []);

  const setTopologyMode = useCallback((mode: InstallTopologyMode) => {
    setTopologyModeState(mode);
    if (mode === 'single-node') {
      applySingleNodeTopology();
      return;
    }
    nodeNameManuallyEditedRef.current = false;
    setCapabilities((prev) => {
      const next = prev.length > 0 ? prev : [...DEFAULT_INSTALL_CAPABILITIES];
      setNodeNameState(suggestNodeNameFromCapabilities(next));
      return next;
    });
  }, [applySingleNodeTopology]);

  const setNodeName = useCallback((value: string) => {
    nodeNameManuallyEditedRef.current = true;
    setNodeNameState(value);
  }, []);

  const toggleCapability = useCallback((capability: NodeCapability, checked: boolean) => {
    if (topologyMode === 'single-node') {
      return;
    }
    setCapabilities((prev) => {
      const next = checked
        ? (prev.includes(capability) ? prev : [...prev, capability])
        : prev.filter((item) => item !== capability);
      if (!nodeNameManuallyEditedRef.current) {
        setNodeNameState(suggestNodeNameFromCapabilities(next));
      }
      return next;
    });
  }, [topologyMode]);

  const handleNext = useCallback(async (): Promise<boolean> => {
    const validation = validateInstallWizardStep(currentStepId, {
      databaseForm,
      adminEmail,
      adminUsername,
      adminPassword,
      adminConfirmPassword,
      capabilities,
      nodeName,
      cacheDriver,
      redisForm,
      emailForm,
      emailPasswordSaved,
      adminStepEnabled,
    }, t);
    if (!validation.valid) {
      showToast('error', validation.message || installText('toast.fieldsRequired', t));
      return false;
    }

    if (currentStepId === 'database') {
      const connected = await verifyDatabaseConnection();
      if (!connected) {
        return false;
      }
    }

    if (currentStepId === 'admin') {
      prefillEmailFromAdmin();
    }

    setFurthestStepIndex((prev) => Math.max(prev, stepIndex + 1));
    return true;
  }, [
    adminConfirmPassword,
    adminEmail,
    adminUsername,
    adminPassword,
    adminStepEnabled,
    capabilities,
    cacheDriver,
    currentStepId,
    databaseForm,
    emailForm,
    emailPasswordSaved,
    nodeName,
    prefillEmailFromAdmin,
    redisForm,
    showToast,
    stepIndex,
    t,
    verifyDatabaseConnection,
  ]);

  const setInstallStepStatus = useCallback((stepId: string, status: InstallProgressStepStatus) => {
    setInstallProgress((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        steps: prev.steps.map((step) => (
          step.id === stepId ? { ...step, status } : step
        )),
      };
    });
  }, []);

  const finishInstall = useCallback(async () => {
    const validationInput = {
      databaseForm,
      adminEmail,
      adminUsername,
      adminPassword,
      adminConfirmPassword,
      capabilities,
      nodeName,
      cacheDriver,
      redisForm,
      emailForm,
      emailPasswordSaved,
      adminStepEnabled,
    };
    const requiredSteps: InstallWizardStepId[] = ['capabilities', 'database', 'cache'];
    if (adminStepEnabled) {
      requiredSteps.push('admin');
    }
    for (const stepId of requiredSteps) {
      const validation = validateInstallWizardStep(stepId, validationInput, t);
      if (!validation.valid) {
        showToast('error', validation.message || installText('toast.installFieldsRequired', t));
        return;
      }
    }

    const statusResult = await statusQuery.refetch();
    const skip = resolveInstallExecutionSkipFlags(statusResult.data);
    const steps = createInstallExecutionStepsWithSkips(skip);
    setInstallProgress({
      open: true,
      steps,
      finished: false,
    });

    const markStep = (stepId: string, status: InstallProgressStepStatus) => {
      setInstallStepStatus(stepId, status);
    };

    try {
      const installWarnings: string[] = [];

      if (skip.capabilities) {
        markStep('capabilities', 'done');
      } else {
        markStep('capabilities', 'running');
        await saveCapabilities.mutateAsync({
          capabilities,
          nodeName: nodeName.trim(),
        });
        markStep('capabilities', 'done');
      }

      const dbPayload = { ...databaseForm, overrideExistingObjects, seedSampleData };

      if (skip.database) {
        markStep('database', 'done');
      } else {
        markStep('database', 'running');
        const test = await testDatabase.mutateAsync(dbPayload);
        if (test.status !== 'connected') {
          throw new Error(test.message || installText('toast.databaseFailed', t));
        }
        await saveDatabase.mutateAsync(dbPayload);
        markStep('database', 'done');
      }

      if (skip.schema) {
        markStep('schema', 'done');
      } else {
        markStep('schema', 'running');
        await initDatabase.mutateAsync();
        markStep('schema', 'done');
      }

      if (skip.cache) {
        markStep('cache', 'done');
      } else {
        markStep('cache', 'running');
        await saveCache.mutateAsync({
          driver: cacheDriver,
          redis: cacheDriver === 'redis' ? redisForm : undefined,
        });
        markStep('cache', 'done');
      }

      if (skip.email) {
        markStep('email', 'done');
      } else {
        markStep('email', 'running');
        try {
          await saveEmail.mutateAsync({ ...emailForm, skipVerification: true });
          markStep('email', 'done');
        } catch (error) {
          const message = formatQueryError(error, 'Could not save outbound email settings.');
          installWarnings.push(
            `${message} Configure outbound email later in Settings.`,
          );
          try {
            await skipEmail.mutateAsync();
          } catch {
            // Install can complete without outbound email.
          }
          markStep('email', 'warning');
        }
      }

      if (!adminStepEnabled) {
        markStep('admin', 'done');
      } else {
        markStep('admin', 'running');
        await configureAdmin.mutateAsync({
          username: adminUsername.trim().toLowerCase(),
          email: adminEmail.trim(),
          password: adminPassword,
          confirmPassword: adminConfirmPassword,
          firstName: adminFirstName.trim() || undefined,
          lastName: adminLastName.trim() || undefined,
          phone: adminPhone.trim() || undefined,
          profileImageBody: adminProfileImageBody,
          profileImageBodyXs: adminProfileImageBodyXs,
          profileImageMime: adminProfileImageMime,
        });
        markStep('admin', 'done');
      }

      markStep('complete', 'running');
      const result = await completeInstall.mutateAsync();
      markStep('complete', 'done');

      setInstallProgress((prev) => (
        prev
          ? {
            ...prev,
            finished: true,
            warnings: installWarnings.length > 0 ? installWarnings : undefined,
          }
          : prev
      ));
      if (installWarnings.length > 0) {
        showToast('warning', installWarnings[0]);
      } else {
        showToast('success', result.message || installText('toast.installComplete', t));
      }
    } catch (error) {
      const message = formatQueryError(error, 'Failed to complete install.');
      setInstallProgress((prev) => {
        if (!prev) {
          return prev;
        }
        const runningStepId = prev.steps.find((step) => step.status === 'running')?.id;
        return {
          ...prev,
          error: message,
          steps: prev.steps.map((step) => {
            if (step.id === runningStepId) {
              return { ...step, status: 'error' as const };
            }
            return step;
          }),
        };
      });
    }
  }, [
    adminConfirmPassword,
    adminEmail,
    adminFirstName,
    adminLastName,
    adminPassword,
    adminPhone,
    adminProfileImageBody,
    adminProfileImageBodyXs,
    adminProfileImageMime,
    adminStepEnabled,
    adminUsername,
    cacheDriver,
    capabilities,
    completeInstall,
    configureAdmin,
    databaseForm,
    emailForm,
    initDatabase,
    nodeName,
    overrideExistingObjects,
    redisForm,
    saveCache,
    saveCapabilities,
    saveDatabase,
    saveEmail,
    seedSampleData,
    setInstallStepStatus,
    showToast,
    skipEmail,
    statusQuery,
    t,
    testDatabase,
  ]);

  const handleAdminImageReadError = useCallback(() => {
    showToast('error', installText('toast.imageReadError', t));
  }, [showToast, t]);

  const setAdminProfileImage = useCallback((patch: {
    profileImageBody: string | null;
    profileImageBodyXs: string | null;
    profileImageMime: string | null;
  }) => {
    setAdminProfileImageBody(patch.profileImageBody);
    setAdminProfileImageBodyXs(patch.profileImageBodyXs);
    setAdminProfileImageMime(patch.profileImageMime);
  }, []);

  const dismissInstallProgress = useCallback(() => {
    setInstallProgress(null);
  }, []);

  const goHomeAfterInstall = useCallback(() => {
    void (async () => {
      clearInstallWizardSession();
      await invalidateInstall();
      await refetchPlatformBootQueries(queryClient);
      window.location.assign(INSTALL_COMPLETE_REDIRECT_PATH);
    })();
  }, [invalidateInstall]);

  const setOverrideExisting = useCallback((checked: boolean) => {
    setOverrideExistingObjects(checked);
    setDatabaseForm((prev) => ({ ...prev, overrideExistingObjects: checked }));
  }, []);

  const isBusy = (
    Boolean(installProgress?.open && !installProgress.finished && !installProgress.error)
    || testDatabase.isPending
    || initDatabase.isPending
    || saveDatabase.isPending
    || configureAdmin.isPending
    || saveCapabilities.isPending
    || testRedis.isPending
    || saveCache.isPending
    || testEmail.isPending
    || saveEmail.isPending
    || skipEmail.isPending
    || completeInstall.isPending
  );

  return {
    statusQuery,
    wizardSteps,
    stepIndex,
    setStepIndex,
    currentStepId,
    isLastStep,
    databaseForm,
    overrideExistingObjects,
    adminStepEnabled,
    seedSampleData,
    setSeedSampleData: (checked: boolean) => {
      setSeedSampleDataState(checked);
      setDatabaseForm((prev) => ({ ...prev, seedSampleData: checked }));
    },
    setOverrideExisting,
    setDatabaseForm: setDatabaseFormValue,
    setDatabaseHost,
    setDatabaseProvider,
    controlPlaneProviderOptions: CONTROL_PLANE_PROVIDER_OPTIONS,
    adminUsername,
    setAdminUsername: setAdminUsernameValue,
    adminEmail,
    setAdminEmail: setAdminEmailValue,
    adminPassword,
    setAdminPassword,
    adminConfirmPassword,
    setAdminConfirmPassword,
    adminFirstName,
    setAdminFirstName,
    adminLastName,
    setAdminLastName,
    adminPhone,
    setAdminPhone,
    adminProfileImageBody,
    adminProfileImageBodyXs,
    adminProfileImageMime,
    setAdminProfileImage,
    handleAdminImageReadError,
    capabilities,
    toggleCapability,
    topologyMode,
    setTopologyMode,
    isSingleNodeTopology: topologyMode === 'single-node',
    nodeName,
    setNodeName,
    cacheDriver,
    setCacheDriver,
    redisForm,
    setRedisForm,
    emailForm,
    setEmailForm,
    setEmailFromEmail,
    setEmailFromName,
    setEmailSmtpUser,
    setEmailSmtpHost,
    emailPasswordSaved,
    emailConnectionTested,
    databaseFieldErrors,
    cacheFieldErrors,
    emailFieldErrors,
    adminFieldErrors,
    capabilitiesFieldErrors,
    installServerWarning,
    installProgress,
    dismissInstallProgress,
    goHomeAfterInstall,
    finishInstall,
    handleNext,
    testDatabaseConnection,
    testRedisConnection,
    testEmailConnection,
    toast,
    canProceedFromCurrentStep,
    canActivateStep,
    isTestingDatabase: testDatabase.isPending,
    isTestingRedis: testRedis.isPending,
    isTestingEmail: testEmail.isPending,
    isBusy,
    capabilityOptions,
    topologyModeOptions,
    cacheModeOptions,
  };
}

export { CheckCircle2 };
