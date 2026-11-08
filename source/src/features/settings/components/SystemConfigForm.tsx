import React, { Suspense, lazy } from 'react';
import { useCultureT } from '../../../core/culture/CultureContext';
import type { SettingsPageModel } from '../hooks/useSettingsPage';
import { AuthSettingsFields } from './form/AuthSettingsFields';
import { ServerFunctionsSettingsFields } from './form/ServerFunctionsSettingsFields';
import { EmailSettingsFields } from './form/EmailSettingsFields';
import { LogsSettingsFields } from './form/LogsSettingsFields';
import { SettingsFormShell } from './form/SettingsFormPrimitives';
import { SettingsStickySaveBar } from './SettingsStickySaveBar';
import { AppRouteLoading } from '../../../components/AppRouteLoading';

const SettingsAttributesSection = lazy(async () => {
  const module = await import('./settingsAttributes/SettingsAttributesSection');
  return { default: module.SettingsAttributesSection };
});
const ProfileFieldsSection = lazy(async () => {
  const module = await import('./profileFields/ProfileFieldsSection');
  return { default: module.ProfileFieldsSection };
});
const SessionContextSection = lazy(async () => {
  const module = await import('./sessionContext/SessionContextSection');
  return { default: module.SessionContextSection };
});
const AiModelsSection = lazy(async () => {
  const module = await import('./aiModels/AiModelsSection');
  return { default: module.AiModelsSection };
});
const EuaAssistSection = lazy(async () => {
  const module = await import('./euaAssist/EuaAssistSection');
  return { default: module.EuaAssistSection };
});
const McpServersSection = lazy(async () => {
  const module = await import('./mcpServers/McpServersSection');
  return { default: module.McpServersSection };
});
const IdentityProvidersSection = lazy(async () => {
  const module = await import('./identityProviders/IdentityProvidersSection');
  return { default: module.IdentityProvidersSection };
});
const CulturesSection = lazy(async () => {
  const module = await import('./cultures/CulturesSection');
  return { default: module.CulturesSection };
});
const WebFontsSection = lazy(async () => {
  const module = await import('./webFonts/WebFontsSection');
  return { default: module.WebFontsSection };
});
const CacheSettingsSection = lazy(async () => {
  const module = await import('./cache/CacheSettingsSection');
  return { default: module.CacheSettingsSection };
});
const PwaSettingsSection = lazy(async () => {
  const module = await import('./PwaSettingsSection');
  return { default: module.PwaSettingsSection };
});
const NodeSettingsSection = lazy(async () => {
  const module = await import('./NodeSettingsSection');
  return { default: module.NodeSettingsSection };
});
const JwtSecretsSettingsSection = lazy(async () => {
  const module = await import('./JwtSecretsSettingsSection');
  return { default: module.JwtSecretsSettingsSection };
});
const FeedbackSettingsSection = lazy(async () => {
  const module = await import('./feedback/FeedbackSettingsSection');
  return { default: module.FeedbackSettingsSection };
});
const RouteLoadingSettingsSection = lazy(async () => {
  const module = await import('./routeLoading/RouteLoadingSettingsSection');
  return { default: module.RouteLoadingSettingsSection };
});
const PlatformTransferSettingsSection = lazy(async () => {
  const module = await import('./platformTransfer/PlatformTransferSettingsSection');
  return { default: module.PlatformTransferSettingsSection };
});

type SystemConfigFormProps = {
  page: SettingsPageModel;
};

const formPanelClass = 'flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50';

const SectionSuspense: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<AppRouteLoading />}>
    {children}
  </Suspense>
);

export const SystemConfigForm: React.FC<SystemConfigFormProps> = ({ page }) => {
  const t = useCultureT();

  if (page.activeSection === 'user-attributes') {
    return (
      <div className={formPanelClass}>
        <SectionSuspense>
          <SettingsAttributesSection scope="USER" title={t('settings.attributes.userTitle')} />
        </SectionSuspense>
      </div>
    );
  }

  if (page.activeSection === 'role-attributes') {
    return (
      <div className={formPanelClass}>
        <SectionSuspense>
          <SettingsAttributesSection scope="ROLE" title={t('settings.attributes.roleTitle')} />
        </SectionSuspense>
      </div>
    );
  }

  if (page.activeSection === 'session-context') {
    return (
      <div className={formPanelClass}>
        <SectionSuspense>
          <SessionContextSection page={page.sessionContext} />
        </SectionSuspense>
      </div>
    );
  }

  if (page.activeSection === 'profile-fields') {
    return (
      <div className={formPanelClass}>
        <SectionSuspense>
          <ProfileFieldsSection page={page} />
        </SectionSuspense>
      </div>
    );
  }

  if (page.activeSection === 'ai-models') {
    return (
      <div className={formPanelClass}>
        <SectionSuspense>
          <AiModelsSection page={page.aiModels} />
        </SectionSuspense>
      </div>
    );
  }

  if (page.activeSection === 'mcp-servers') {
    return (
      <div className={formPanelClass}>
        <SectionSuspense>
          <McpServersSection page={page.mcpServers} />
        </SectionSuspense>
      </div>
    );
  }

  if (page.activeSection === 'eua-assist') {
    return (
      <div className={formPanelClass}>
        <SectionSuspense>
          <EuaAssistSection section={page.euaAssist} />
        </SectionSuspense>
      </div>
    );
  }

  if (page.activeSection === 'identity-providers') {
    return (
      <div className={formPanelClass}>
        <SectionSuspense>
          <IdentityProvidersSection page={page.identityProviders} />
        </SectionSuspense>
      </div>
    );
  }

  if (page.activeSection === 'cultures') {
    return (
      <div className={formPanelClass}>
        <SectionSuspense>
          <CulturesSection page={page.cultures} />
        </SectionSuspense>
      </div>
    );
  }

  if (page.activeSection === 'web-fonts') {
    return (
      <div className={formPanelClass}>
        <SectionSuspense>
          <WebFontsSection page={page.webFonts} />
        </SectionSuspense>
      </div>
    );
  }

  if (page.activeSection === 'cache') {
    return (
      <SettingsFormShell>
        <SectionSuspense>
          <CacheSettingsSection page={page.cacheSettings} />
        </SectionSuspense>
      </SettingsFormShell>
    );
  }

  if (page.activeSection === 'feedback') {
    return (
      <SettingsFormShell>
        <SectionSuspense>
          <FeedbackSettingsSection page={page.feedbackSettings} />
        </SectionSuspense>
      </SettingsFormShell>
    );
  }

  if (page.activeSection === 'route-loading') {
    return (
      <SettingsFormShell>
        <SectionSuspense>
          <RouteLoadingSettingsSection page={page.routeLoadingSettings} />
        </SectionSuspense>
      </SettingsFormShell>
    );
  }

  if (page.activeSection === 'server-functions') {
    return (
      <SettingsFormShell>
        <ServerFunctionsSettingsFields page={page} />
      </SettingsFormShell>
    );
  }

  if (page.activeSection === 'logs') {
    return (
      <div className={formPanelClass}>
        <SettingsFormShell>
          <LogsSettingsFields page={page} />
        </SettingsFormShell>
        <SettingsStickySaveBar page={page} />
      </div>
    );
  }

  if (page.activeSection === 'auth') {
    return (
      <SettingsFormShell>
        <AuthSettingsFields page={page} />
      </SettingsFormShell>
    );
  }

  if (page.activeSection === 'jwt-secrets') {
    return (
      <SettingsFormShell>
        <SectionSuspense>
          <JwtSecretsSettingsSection />
        </SectionSuspense>
      </SettingsFormShell>
    );
  }

  if (page.activeSection === 'platform-transfer') {
    return (
      <div className={formPanelClass}>
        <SectionSuspense>
          <PlatformTransferSettingsSection />
        </SectionSuspense>
      </div>
    );
  }

  if (page.activeSection === 'email') {
    return (
      <SettingsFormShell>
        <EmailSettingsFields page={page} />
      </SettingsFormShell>
    );
  }

  if (page.activeSection === 'node-identity' || page.activeSection === 'node-runtime') {
    return (
      <SettingsFormShell>
        <SectionSuspense>
          <NodeSettingsSection variant={page.activeSection} />
        </SectionSuspense>
      </SettingsFormShell>
    );
  }

  if (page.activeSection === 'pwa') {
    return (
      <SettingsFormShell>
        <SectionSuspense>
          <PwaSettingsSection page={page} />
        </SectionSuspense>
      </SettingsFormShell>
    );
  }

  return null;
};
