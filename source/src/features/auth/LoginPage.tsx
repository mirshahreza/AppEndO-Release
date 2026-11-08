import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, Mail, ArrowRight, Info, CircleHelp } from 'lucide-react';
import { motion } from 'motion/react';
import { AboutAppModal } from '../../components/AboutAppModal';
import { AppEndLogo } from '../../components/AppEndLogo';
import { useOptionalPlatformConfig } from '../../app/platform/PlatformConfigProvider';
import { resolveAuthLoginPortalBrand } from './authLoginPortalBrand';
import { storeBrowserLoginCredentials } from './storeBrowserLoginCredentials';
import { UiInput, UiPasswordInput } from '../../shared/ui/HeroFieldControls';
import { useAuthPublicConfig } from '../../shared/lib/authPublicConfig';
import { AppToast } from '../../shared/ui/AppToast';
import { AtmosphereBackdrop } from '../../shared/ui/AtmosphereBackdrop';
import { CircuitTraceField } from '../../shared/ui/CircuitTraceField';
import { TechConstellation } from '../../shared/ui/TechConstellation';
import { useAuth } from '../../contexts/AuthContext';
import { useOptionalCulture, useOptionalCultureT } from '../../core/culture/CultureContext';
import { cn } from '../../lib/utils';
import { authPublicKey } from '../../core/culture/translations/cultureKeyHelpers';

const OAUTH_ERROR_KEY_BY_CODE: Record<string, string> = {
  oauth_denied: authPublicKey('oauth.denied'),
  oauth_state: authPublicKey('oauth.stateMismatch'),
  oauth_provider: authPublicKey('oauth.providerError'),
  oauth_no_account: authPublicKey('oauth.noAccount'),
  oauth_link_denied: authPublicKey('oauth.linkDenied'),
};

type LoginFieldErrors = {
  identifier?: string;
  password?: string;
  otp?: string;
};

type LoginBrandPanelProps = {
  eyebrow: string;
  wordmark: string;
  headline: string;
  subheadline: string;
  onLogoClick: () => void;
  logoSrc?: string;
  logoAlt?: string;
  usePortalLogo?: boolean;
};

const LoginBrandPanel: React.FC<LoginBrandPanelProps> = ({
  eyebrow,
  wordmark,
  headline,
  subheadline,
  onLogoClick,
  logoSrc,
  logoAlt,
  usePortalLogo = false,
}) => (
  <div className="login-brand-panel relative flex min-h-screen flex-col justify-center px-10 py-12 xl:px-16">
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.18, ease: 'easeOut' }}
      className="relative z-10 flex max-w-xl flex-col items-start pointer-events-auto"
    >
      <button
        type="button"
        onClick={onLogoClick}
        aria-label={logoAlt?.trim() || wordmark}
        className="inline-flex flex-col items-center border-none bg-transparent p-0 cursor-pointer"
      >
        <AppEndLogo
          mark={!usePortalLogo}
          src={usePortalLogo ? logoSrc : undefined}
          alt={logoAlt}
          className={usePortalLogo ? 'h-16 max-w-[240px] drop-shadow-none' : 'h-16 drop-shadow-none'}
        />
        {usePortalLogo ? null : (
          <span className="mt-3 text-center text-[1.75rem] font-semibold tracking-tight text-slate-800">
            {wordmark}
          </span>
        )}
      </button>
      <span className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {eyebrow}
      </span>
      <p className="mt-8 text-4xl font-extrabold tracking-tight text-slate-900 xl:text-[2.75rem] xl:leading-[1.12]">
        {headline}
      </p>
      <p className="mt-5 max-w-lg text-base font-medium leading-relaxed text-slate-500 xl:text-lg">
        {subheadline}
      </p>
    </motion.div>
  </div>
);

export const Login = () => {
  const t = useOptionalCultureT();
  const isRtl = useOptionalCulture()?.direction === 'rtl';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpChallengeId, setOtpChallengeId] = useState<number | null>(null);
  const [otpHint, setOtpHint] = useState('');
  const { config: authConfig, isLoading: isAuthConfigLoading, registrationEnabled } = useAuthPublicConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const platformConfig = useOptionalPlatformConfig();
  const returnTo = searchParams.get('return')?.trim() || '/';
  const postLoginDestination =
    returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  const loginPortalBrand = useMemo(
    () => resolveAuthLoginPortalBrand(postLoginDestination, platformConfig?.config),
    [platformConfig?.config, postLoginDestination],
  );
  const oauthProviders = authConfig?.identityProviders ?? [];

  useEffect(() => {
    const oauthError = searchParams.get('error')?.trim();
    if (oauthError) {
      const key = OAUTH_ERROR_KEY_BY_CODE[oauthError];
      setError(key ? t(key) : t(authPublicKey('externalSignInFailed')));
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (!error) {
      return;
    }
    const timer = window.setTimeout(() => setError(''), 4200);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    navigate(postLoginDestination, { replace: true });
  }, [isAuthenticated, navigate, postLoginDestination]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: LoginFieldErrors = {};
    if (!otpChallengeId) {
      if (!identifier.trim()) {
        nextErrors.identifier = t(authPublicKey('usernameRequired'));
      }
      if (!password) {
        nextErrors.password = t(authPublicKey('passwordRequired'));
      }
    } else if (!otpCode.trim()) {
      nextErrors.otp = t(authPublicKey('otpRequired'));
    }

    if (nextErrors.identifier || nextErrors.password || nextErrors.otp) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setIsLoading(true);
    setError('');

    const result = otpChallengeId
      ? await login(identifier, password, { challengeId: otpChallengeId, otpCode })
      : await login(identifier, password);

    if (result.requiresOtp && result.challengeId) {
      setOtpChallengeId(result.challengeId);
      setOtpHint(result.maskedTarget || result.message || t(authPublicKey('otpDefaultHint')));
      setIsLoading(false);
      return;
    }

    if (result.success) {
      void storeBrowserLoginCredentials(identifier, password);
      navigate(postLoginDestination);
      return;
    }

    setError(result.error || t(authPublicKey('invalidCredentials')));
    setIsLoading(false);
  };

  const portalWordmark = loginPortalBrand.windowTitle?.trim()
    || loginPortalBrand.title?.trim()
    || t(authPublicKey('login.wordmark'));

  const brandProps: LoginBrandPanelProps = {
    eyebrow: t(authPublicKey('login.eyebrow')),
    wordmark: loginPortalBrand.usesPortalLogo ? portalWordmark : t(authPublicKey('login.wordmark')),
    headline: t(authPublicKey('login.headline')),
    subheadline: t(authPublicKey('login.subheadline')),
    onLogoClick: () => setIsAboutModalOpen(true),
    logoSrc: loginPortalBrand.logoUrl,
    logoAlt: portalWordmark,
    usePortalLogo: loginPortalBrand.usesPortalLogo,
  };

  return (
    <div className="login-split relative flex min-h-screen flex-col auth-rich-wash lg:grid lg:h-screen lg:grid-cols-[minmax(0,7fr)_minmax(680px,3fr)]">
      <motion.div
        className="login-brand-decor pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        aria-hidden
      >
        <AtmosphereBackdrop className="install-wizard-backdrop--auth" />
        <CircuitTraceField />
        <TechConstellation className="hidden lg:block" visible />
      </motion.div>

      <aside className="relative z-10 hidden min-h-screen pointer-events-none lg:block">
        <LoginBrandPanel {...brandProps} />
      </aside>

      <main className="login-form-pane relative z-10 flex min-h-screen flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8 md:items-end md:pe-[280px] lg:ps-10 lg:py-12">
        <motion.div
          initial={{ opacity: 0, x: 36 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0.18, delay: 0.32 }}
          className="flex w-full min-w-[300px] max-w-[400px] flex-col items-center z-10 md:min-w-[400px]"
        >
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <button
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              aria-label={brandProps.logoAlt || brandProps.wordmark}
              className="flex flex-col items-center border-none bg-transparent p-0 cursor-pointer"
            >
              <AppEndLogo
                mark={!brandProps.usePortalLogo}
                src={brandProps.usePortalLogo ? brandProps.logoSrc : undefined}
                alt={brandProps.logoAlt}
                className={
                  brandProps.usePortalLogo
                    ? 'h-11 max-w-[200px] drop-shadow-none'
                    : 'h-11 drop-shadow-none'
                }
              />
              {brandProps.usePortalLogo ? null : (
                <span className="mt-2 text-lg font-semibold tracking-tight text-slate-800">
                  {brandProps.wordmark}
                </span>
              )}
            </button>
          </div>

          <div className="login-form-card w-full min-w-[300px] rounded-xl border border-slate-200/70 bg-white p-7 sm:p-8 md:min-w-[400px]">
            <div className="mb-7">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {t(authPublicKey('signIn'))}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {t(authPublicKey('login.formSubtitle'))}
              </p>
            </div>

            <form
              id="login-form"
              method="post"
              action="/login"
              onSubmit={handleSubmit}
              className="login-form space-y-4"
              autoComplete="on"
              noValidate
            >
              <div hidden={Boolean(otpChallengeId)}>
                <div className="login-field">
                  <label
                    htmlFor="login-identifier"
                    className="mb-[2px] block ps-[4px] text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                  >
                    {t(authPublicKey('username'))}
                  </label>
                  <UiInput
                    id="login-identifier"
                    name="username"
                    type="text"
                    size="md"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (fieldErrors.identifier) {
                        setFieldErrors((current) => ({ ...current, identifier: undefined }));
                      }
                    }}
                    autoComplete="username"
                    autoDir={false}
                    className="font-medium"
                    placeholder={t(authPublicKey('usernamePlaceholder'))}
                    disabled={isLoading}
                    aiAssist={false}
                    isInvalid={Boolean(fieldErrors.identifier)}
                    errorMessage={fieldErrors.identifier}
                    feedbackPlacement="below"
                    startContent={<Mail className="h-4 w-4 text-slate-400" />}
                    startContentClassName="px-3"
                  />
                </div>

                <div className="login-field mt-4">
                  <label
                    htmlFor="login-password"
                    className="mb-[2px] block ps-[4px] text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                  >
                    {t(authPublicKey('password'))}
                  </label>
                  <UiPasswordInput
                    id="login-password"
                    name="password"
                    size="md"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((current) => ({ ...current, password: undefined }));
                      }
                    }}
                    autoComplete="current-password"
                    className="font-medium"
                    placeholder={t(authPublicKey('passwordPlaceholder'))}
                    disabled={isLoading}
                    isInvalid={Boolean(fieldErrors.password)}
                    errorMessage={fieldErrors.password}
                    feedbackPlacement="below"
                    leadingAddon={<Lock className="h-4 w-4 text-slate-400" />}
                    leadingAddonClassName="px-3"
                  />
                </div>
              </div>
              {otpChallengeId ? (
                <div className="login-field flex flex-col gap-[2px]">
                  <label
                    htmlFor="login-otp"
                    className="block ps-[4px] text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                  >
                    {t(authPublicKey('verificationCode'))}
                  </label>
                  <p className="mb-[2px] ps-[4px] text-xs text-slate-500">{otpHint}</p>
                  <UiInput
                    id="login-otp"
                    name="otp"
                    size="md"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value);
                      if (fieldErrors.otp) {
                        setFieldErrors((current) => ({ ...current, otp: undefined }));
                      }
                    }}
                    autoComplete="one-time-code"
                    placeholder={t(authPublicKey('otpPlaceholder'))}
                    disabled={isLoading}
                    autoDir={false}
                    aiAssist={false}
                    isInvalid={Boolean(fieldErrors.otp)}
                    errorMessage={fieldErrors.otp}
                    feedbackPlacement="below"
                  />
                  <button
                    type="button"
                    className="mt-2 ps-[4px] text-left text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700"
                    onClick={() => {
                      setOtpChallengeId(null);
                      setOtpCode('');
                      setOtpHint('');
                      setFieldErrors({});
                    }}
                  >
                    {t(authPublicKey('backToPasswordSignIn'))}
                  </button>
                </div>
              ) : null}

              {!otpChallengeId ? (
                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-400 transition-colors hover:text-primary-700"
                  >
                    {t(authPublicKey('forgotPassword'))}
                    <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  </Link>
                </div>
              ) : null}

              <motion.button
                type="submit"
                disabled={isLoading}
                whileTap={{ scale: 0.95 }}
                className="login-submit group relative flex min-h-11 w-full items-center justify-center overflow-visible rounded-lg border border-transparent p-0 text-[15px] font-bold text-white transition-transform focus:outline-none focus:ring-2 focus:ring-[#2D6A64]/40 focus:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="login-submit__surface">
                  <span className="login-submit__shine" aria-hidden />
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <ArrowRight className={cn('h-4 w-4 shrink-0', isRtl && 'rotate-180')} aria-hidden />
                      <span>
                        {otpChallengeId
                          ? t(authPublicKey('verifyAndSignIn'))
                          : t(authPublicKey('signIn'))}
                      </span>
                    </>
                  )}
                </span>
                <span className="login-submit__sparkles" aria-hidden>
                  <span className="login-submit__sparkle login-submit__sparkle--a" />
                  <span className="login-submit__sparkle login-submit__sparkle--b" />
                  <span className="login-submit__sparkle login-submit__sparkle--c" />
                  <span className="login-submit__sparkle login-submit__sparkle--d" />
                </span>
              </motion.button>
            </form>

            {!isAuthConfigLoading && oauthProviders.length > 0 && !otpChallengeId ? (
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {t(authPublicKey('orContinueWith'))}
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="flex flex-col gap-2">
                  {oauthProviders.map((provider) => (
                    <a
                      key={provider.id}
                      href={`/api/auth/oauth/${encodeURIComponent(provider.id)}/start`}
                      className="flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:border-primary-300 hover:bg-primary-50"
                    >
                      {provider.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {!isAuthConfigLoading && registrationEnabled ? (
              <p className="mt-6 text-center text-sm text-slate-500">
                {t(authPublicKey('needAccount'))}{' '}
                <Link
                  to="/register"
                  className="font-semibold text-primary-600 transition-colors hover:text-primary-700"
                >
                  {t(authPublicKey('createOne'))}
                </Link>
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setIsAboutModalOpen(true)}
            className="mt-5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-slate-400 transition-colors hover:text-slate-600"
          >
            <Info className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            {t(authPublicKey('login.aboutSystem'))}
          </button>
        </motion.div>
      </main>

      <AboutAppModal
        open={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        brand={loginPortalBrand.usesPortalLogo ? loginPortalBrand : null}
      />
      {error ? <AppToast type="error" text={error} /> : null}
    </div>
  );
};
