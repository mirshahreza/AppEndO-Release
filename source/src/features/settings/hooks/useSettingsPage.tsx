import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import {
  useAppSettingsQuery,
  useSaveAppSettingsMutation,
} from '../../../shared/api/queries/settings';
import { DEFAULT_SETTINGS } from '../constants';
import type { AppSettings, SaveStatus, SectionId } from '../types';
import { useProfileFieldSettingsDraft } from './useProfileFieldSettingsDraft';
import { useSessionContextSettingsDraft } from './useSessionContextSettingsDraft';
import { useAiModelsSection } from '../components/aiModels/useAiModelsSection';
import { useMcpServersSection } from '../components/mcpServers/useMcpServersSection';
import { useIdentityProvidersSection } from '../components/identityProviders/useIdentityProvidersSection';
import { useCulturesSection } from '../components/cultures/useCulturesSection';
import { useWebFontsSection } from '../components/webFonts/useWebFontsSection';
import { useCacheSettingsSection } from '../components/cache/useCacheSettingsSection';
import { useFeedbackSettingsSection } from '../components/feedback/useFeedbackSettingsSection';
import { useRouteLoadingSettingsSection } from '../components/routeLoading/useRouteLoadingSettingsSection';
import { useEuaAssistSection } from '../components/euaAssist/useEuaAssistSection';
import {
  buildSettingsSectionRelativePath,
  DEFAULT_SETTINGS_SECTION,
  parseSettingsSectionSlug,
  resolveSettingsRouteSuffix,
  resolveSettingsSectionFromPathSuffix,
} from '../settingsRoute';

export function useSettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mountId, toMountPath } = usePlatformMount();
  const application = useOptionalPortal();
  const routeParamSuffix = useParams()['*'];
  const applicationSuffix = application?.pageRemainderPath.replace(/^\/+/, '') || undefined;
  const pathSuffix = resolveSettingsRouteSuffix(applicationSuffix ?? routeParamSuffix);
  const activeSection = resolveSettingsSectionFromPathSuffix(pathSuffix);
  const settingsQuery = useAppSettingsQuery();
  const saveMutation = useSaveAppSettingsMutation();
  const profileFields = useProfileFieldSettingsDraft({ enabled: activeSection === 'profile-fields' });
  const sessionContext = useSessionContextSettingsDraft({ enabled: activeSection === 'session-context' });
  const aiModels = useAiModelsSection({ enabled: activeSection === 'ai-models' });
  const euaAssist = useEuaAssistSection({ enabled: activeSection === 'eua-assist' });
  const mcpServers = useMcpServersSection({ enabled: activeSection === 'mcp-servers' });
  const identityProviders = useIdentityProvidersSection({ enabled: activeSection === 'identity-providers' });
  const cultures = useCulturesSection({ enabled: activeSection === 'cultures' });
  const webFonts = useWebFontsSection({ enabled: activeSection === 'web-fonts' || activeSection === 'cultures' });
  const cacheSettings = useCacheSettingsSection({ enabled: activeSection === 'cache' });
  const feedbackSettings = useFeedbackSettingsSection({ enabled: activeSection === 'feedback' });
  const routeLoadingSettings = useRouteLoadingSettingsSection({ enabled: activeSection === 'route-loading' });

  useEffect(() => {
    const slug = pathSuffix?.split('/').filter(Boolean)[0]?.trim();
    if (slug && parseSettingsSectionSlug(slug)) {
      return;
    }

    navigate(toMountPath(buildSettingsSectionRelativePath(DEFAULT_SETTINGS_SECTION, mountId)), { replace: true });
  }, [mountId, navigate, pathSuffix, toMountPath]);

  useEffect(() => {
    const canonicalPath = toMountPath(buildSettingsSectionRelativePath(activeSection, mountId));
    if (location.pathname === canonicalPath) {
      return;
    }

    const resolvedSection = resolveSettingsSectionFromPathSuffix(pathSuffix);
    if (resolvedSection !== activeSection) {
      return;
    }

    if (location.pathname.endsWith(`/settings/${activeSection}`)) {
      navigate(canonicalPath, { replace: true });
    }
  }, [activeSection, location.pathname, mountId, navigate, pathSuffix, toMountPath]);

  const setActiveSection = useCallback((sectionId: SectionId) => {
    navigate(toMountPath(buildSettingsSectionRelativePath(sectionId, mountId)));
  }, [mountId, navigate, toMountPath]);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const isLoading = settingsQuery.isLoading;

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSettings(settingsQuery.data);
    setDraftSettings(settingsQuery.data);
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!settingsQuery.isError) return;
    console.error('Failed to load settings:', settingsQuery.error);
  }, [settingsQuery.error, settingsQuery.isError]);

  const isAppSettingsDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(draftSettings),
    [draftSettings, settings],
  );

  const isDirty = activeSection === 'profile-fields'
    ? profileFields.isDirty
    : activeSection === 'session-context'
      ? sessionContext.isDirty
    : activeSection === 'ai-models'
      ? aiModels.isDirty
      : activeSection === 'eua-assist'
        ? euaAssist.isDirty
        : activeSection === 'cache'
      ? cacheSettings.isDirty
      : activeSection === 'feedback'
        ? feedbackSettings.isDirty
      : activeSection === 'route-loading'
        ? routeLoadingSettings.isDirty
      : activeSection === 'cultures'
        ? cultures.isDirty
        : isAppSettingsDirty;

  const isSaving = activeSection === 'profile-fields'
    ? profileFields.isSaving
    : activeSection === 'session-context'
      ? sessionContext.isSaving
    : activeSection === 'eua-assist'
      ? euaAssist.isSaving
      : activeSection === 'cache'
      ? cacheSettings.isSaving
      : activeSection === 'feedback'
        ? feedbackSettings.isSaving
      : activeSection === 'route-loading'
        ? routeLoadingSettings.isSaving
      : activeSection === 'cultures'
        ? cultures.isSaving
        : saveStatus === 'saving';

  const handleSave = useCallback(async () => {
    if (activeSection === 'profile-fields') {
      setSaveStatus('saving');
      try {
        const saved = await profileFields.handleSave();
        setSaveStatus(saved ? 'saved' : 'error');
        if (saved) {
          window.setTimeout(() => setSaveStatus('idle'), 2000);
        }
      } catch (err) {
        console.error('Failed to save profile field settings:', err);
        setSaveStatus('error');
      }
      return;
    }

    if (activeSection === 'session-context') {
      setSaveStatus('saving');
      try {
        const saved = await sessionContext.handleSave();
        setSaveStatus(saved ? 'saved' : 'error');
        if (saved) {
          window.setTimeout(() => setSaveStatus('idle'), 2000);
        }
      } catch (err) {
        console.error('Failed to save session context settings:', err);
        setSaveStatus('error');
      }
      return;
    }

    if (activeSection === 'cache') {
      setSaveStatus('saving');
      try {
        const saved = await cacheSettings.handleSave();
        setSaveStatus(saved ? 'saved' : 'error');
        if (saved) {
          window.setTimeout(() => setSaveStatus('idle'), 2000);
        }
      } catch (err) {
        console.error('Failed to save cache settings:', err);
        setSaveStatus('error');
      }
      return;
    }

    if (activeSection === 'feedback') {
      setSaveStatus('saving');
      try {
        const saved = await feedbackSettings.handleSave();
        setSaveStatus(saved ? 'saved' : 'error');
        if (saved) {
          window.setTimeout(() => setSaveStatus('idle'), 2000);
        }
      } catch (err) {
        console.error('Failed to save feedback settings:', err);
        setSaveStatus('error');
      }
      return;
    }

    if (activeSection === 'route-loading') {
      setSaveStatus('saving');
      try {
        const saved = await routeLoadingSettings.handleSave();
        setSaveStatus(saved ? 'saved' : 'error');
        if (saved) {
          window.setTimeout(() => setSaveStatus('idle'), 2000);
        }
      } catch (err) {
        console.error('Failed to save route loading settings:', err);
        setSaveStatus('error');
      }
      return;
    }

    if (activeSection === 'cultures') {
      setSaveStatus('saving');
      try {
        const saved = await cultures.save();
        setSaveStatus(saved ? 'saved' : 'error');
        if (saved) {
          window.setTimeout(() => setSaveStatus('idle'), 2000);
        }
      } catch (err) {
        console.error('Failed to save culture settings:', err);
        setSaveStatus('error');
      }
      return;
    }

    setSaveStatus('saving');
    try {
      const saved = await saveMutation.mutateAsync(draftSettings);
      setSettings(saved);
      setDraftSettings(saved);
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSaveStatus('error');
    }
  }, [activeSection, aiModels, cacheSettings, cultures, draftSettings, feedbackSettings, profileFields, routeLoadingSettings, saveMutation, sessionContext]);

  const discardDraft = useCallback(() => {
    setDraftSettings(settings);
  }, [settings]);

  return {
    activeSection,
    setActiveSection,
    draftSettings,
    setDraftSettings,
    profileFields,
    sessionContext,
    aiModels,
    euaAssist,
    mcpServers,
    identityProviders,
    cultures,
    webFonts,
    cacheSettings,
    feedbackSettings,
    routeLoadingSettings,
    isLoading,
    saveStatus,
    handleSave,
    discardDraft,
    isDirty,
    isSaving,
  };
}

export type SettingsPageModel = ReturnType<typeof useSettingsPage>;
