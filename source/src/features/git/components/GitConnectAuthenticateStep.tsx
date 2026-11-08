import React, { useState } from 'react';
import { Check, ExternalLink, Github } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { AppButton, UiInput } from '../../../shared/ui';
import { REDACTED_GIT_TOKEN } from '../../../shared/api/contracts/git/constants';
import type { GitGithubOAuthAvailability } from '../../../shared/api/contracts/git/oauth';
import type { GitConnectAuthMethod } from '../gitConnectWizard';
import type { GitSettingsFormState } from '../gitSettingsForm';
import { GitConnectLocalOnlyButton } from './GitConnectLocalOnlyButton';

type GitConnectAuthenticateStepProps = {
  authMethod: GitConnectAuthMethod;
  form: GitSettingsFormState;
  oauthAvailability: GitGithubOAuthAvailability | undefined;
  isGithubOAuthPending: boolean;
  isSavingGithubOAuthConfig?: boolean;
  onFormChange: (next: GitSettingsFormState) => void;
  onGithubOAuthStart: () => void;
  onSaveGithubOAuthConfig?: (clientId: string, clientSecret: string) => Promise<void>;
  onLocalOnly?: () => void;
  onGitSignOut?: () => void;
  isSigningOutGit?: boolean;
};

export const GitConnectAuthenticateStep: React.FC<GitConnectAuthenticateStepProps> = ({
  authMethod,
  form,
  oauthAvailability,
  isGithubOAuthPending,
  isSavingGithubOAuthConfig = false,
  onFormChange,
  onGithubOAuthStart,
  onSaveGithubOAuthConfig,
  onLocalOnly,
  onGitSignOut,
  isSigningOutGit = false,
}) => {
  const t = useCultureT();
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [oauthConfigError, setOauthConfigError] = useState<string | null>(null);

  const hasGithubToken = Boolean(
    form.authToken.trim()
    && form.authToken !== REDACTED_GIT_TOKEN,
  );

  const handleSaveOAuthConfig = async () => {
    if (!onSaveGithubOAuthConfig) {
      return;
    }

    const clientId = oauthClientId.trim();
    const clientSecret = oauthClientSecret.trim();
    if (!clientId || !clientSecret) {
      setOauthConfigError(t('git.auth.oauthCredentialsRequired'));
      return;
    }

    setOauthConfigError(null);
    try {
      await onSaveGithubOAuthConfig(clientId, clientSecret);
      setOauthClientSecret('');
    } catch {
      // Parent surfaces the error banner.
    }
  };

  if (authMethod === 'github_oauth') {
    if (!oauthAvailability?.available) {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">{t('git.auth.oauthSetupTitle')}</p>
            <p className="mt-2 text-xs leading-relaxed text-amber-800">
              {t('git.auth.oauthSetupBody')}
            </p>
          </div>

          {oauthAvailability?.redirectUri ? (
            <div className="flex flex-col gap-[2px]">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ps-[4px]">
                {t('git.auth.oauthCallbackUrl')}
              </label>
              <UiInput
                value={oauthAvailability.redirectUri}
                readOnly
                ariaLabel={t('git.auth.oauthCallbackUrlAria')}
                size="sm"
              />
              <p className="mt-1 text-xs text-slate-500 ps-[4px]">
                {t('git.auth.oauthCallbackHint')}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-[2px] md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ps-[4px]">{t('git.auth.clientId')}</label>
              <UiInput
                value={oauthClientId}
                onChange={(event) => setOauthClientId(event.target.value)}
                placeholder="Ov23li…"
                ariaLabel={t('git.auth.clientIdAria')}
                size="sm"
              />
            </div>

            <div className="flex flex-col gap-[2px] md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ps-[4px]">{t('git.auth.clientSecret')}</label>
              <UiInput
                type="password"
                value={oauthClientSecret}
                onChange={(event) => setOauthClientSecret(event.target.value)}
                placeholder={t('git.auth.clientSecretPlaceholder')}
                ariaLabel={t('git.auth.clientSecretAria')}
                size="sm"
              />
            </div>
          </div>

          {oauthConfigError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {oauthConfigError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <AppButton
              type="button"
              intent="primary"
              size="sm"
              disabled={isSavingGithubOAuthConfig}
              onClick={() => { void handleSaveOAuthConfig(); }}
            >
              {isSavingGithubOAuthConfig ? t('git.auth.savingOAuth') : t('git.auth.saveOAuthCredentials')}
            </AppButton>
            <AppButton
              type="button"
              intent="secondary"
              size="sm"
              onClick={() => window.open('https://github.com/settings/developers', '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('git.auth.openGithubDeveloperSettings')}
            </AppButton>
          </div>
          {onLocalOnly ? <GitConnectLocalOnlyButton onClick={onLocalOnly} /> : null}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {t('git.auth.authorizeIntro')}
        </p>

        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          onClick={onGithubOAuthStart}
          disabled={isGithubOAuthPending}
          className="w-full justify-center"
        >
          <Github className="w-3.5 h-3.5" />
          {isGithubOAuthPending ? t('git.auth.waitingForGithub') : t('git.auth.signInWithGithub')}
        </AppButton>

        {hasGithubToken ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <Check className="size-4 shrink-0" aria-hidden />
              {form.authUsername.trim()
                ? t('git.auth.signedInAs', { username: form.authUsername.trim() })
                : t('git.auth.signedIn')}
            </div>
            {onGitSignOut ? (
              <AppButton
                type="button"
                intent="cancel"
                size="sm"
                disabled={isSigningOutGit}
                onClick={onGitSignOut}
              >
                {isSigningOutGit ? t('git.auth.signingOut') : t('git.auth.signOutGithub')}
              </AppButton>
            ) : null}
          </div>
        ) : null}

        {!hasGithubToken && onLocalOnly ? (
          <GitConnectLocalOnlyButton onClick={onLocalOnly} />
        ) : null}
        {oauthAvailability?.available ? (
          <p className="text-xs text-slate-500">
            {t('git.auth.differentAccountHint')}{' '}
            <a
              href="https://github.com/settings/applications"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              {t('git.auth.githubAuthorizedApps')}
            </a>
            .
          </p>
        ) : null}
      </div>
    );
  }

  if (authMethod === 'https_pat') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-[2px]">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ps-[4px]">{t('git.auth.httpsUsername')}</label>
            <UiInput
              value={form.authUsername}
              onChange={(event) => onFormChange({ ...form, authUsername: event.target.value })}
              placeholder="x-access-token"
              ariaLabel={t('git.auth.httpsUsernameAria')}
              size="sm"
            />
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ps-[4px]">{t('git.auth.tokenEnvKey')}</label>
            <UiInput
              value={form.authTokenEnvKey}
              onChange={(event) => onFormChange({ ...form, authTokenEnvKey: event.target.value })}
              placeholder="GIT_TOKEN"
              ariaLabel={t('git.auth.tokenEnvKeyAria')}
              size="sm"
            />
          </div>

          <div className="flex flex-col gap-[2px] md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ps-[4px]">{t('git.auth.personalAccessToken')}</label>
            <UiInput
              type="password"
              value={form.authToken}
              onChange={(event) => onFormChange({ ...form, authToken: event.target.value })}
              placeholder="ghp_…"
              ariaLabel={t('git.auth.personalAccessTokenAria')}
              size="sm"
              className="max-w-md"
            />
            <p className="mt-1 text-xs text-slate-500 ps-[4px]">
              {t('git.auth.tokenOrEnvHint')}
            </p>
          </div>
        </div>
        {onLocalOnly ? <GitConnectLocalOnlyButton onClick={onLocalOnly} /> : null}
      </div>
    );
  }

  if (authMethod === 'ssh_key_path') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {t('git.auth.sshKeyIntro')}
        </p>
        <div className="flex flex-col gap-[2px]">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ps-[4px]">{t('git.auth.sshKeyPath')}</label>
          <UiInput
            value={form.authSshKeyPath}
            onChange={(event) => onFormChange({ ...form, authSshKeyPath: event.target.value })}
            placeholder="/home/deploy/.ssh/id_ed25519"
            ariaLabel={t('git.auth.sshKeyPathAria')}
            size="sm"
          />
        </div>
        {onLocalOnly ? <GitConnectLocalOnlyButton onClick={onLocalOnly} /> : null}
      </div>
    );
  }

  return null;
};
