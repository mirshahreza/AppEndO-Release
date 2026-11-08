import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthPublicShell } from '../components/auth/AuthPublicShell';
import { UiInput } from '../shared/ui/HeroFieldControls';
import { UiCheckboxChoice } from '../shared/ui/FormChoiceFields';
import { AppButton } from '../shared/ui/AppButton';
import { apiPost } from '../shared/api/client';
import { useAuthPublicConfig } from '../shared/lib/authPublicConfig';
import { useOptionalCultureT } from '../core/culture/CultureContext';
import { authPublicKey } from '../core/culture/translations/cultureKeyHelpers';

export const Register: React.FC = () => {
  const t = useOptionalCultureT();
  const navigate = useNavigate();
  const { config, isLoading: isConfigLoading, registrationEnabled } = useAuthPublicConfig();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const requireTerms = config?.registration?.requireTerms === true;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const { data, response } = await apiPost<{ success?: boolean; message?: string; error?: string }>(
        '/api/auth/register',
        { email, username, password, firstName, lastName, termsAccepted },
      );

      if (response.ok && data.success) {
        setMessage(data.message || t(authPublicKey('accountCreated')));
        window.setTimeout(() => navigate('/login'), 1800);
        return;
      }

      setError(data.error || t(authPublicKey('registrationFailed')));
    } catch {
      setError(t(authPublicKey('registrationFailedRetry')));
    } finally {
      setIsLoading(false);
    }
  };

  if (isConfigLoading || !config) {
    return (
      <AuthPublicShell title={t(authPublicKey('createAccountTitle'))}>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      </AuthPublicShell>
    );
  }

  if (!registrationEnabled) {
    return (
      <AuthPublicShell
        title={t(authPublicKey('createAccountTitle'))}
        subtitle={t(authPublicKey('registrationDisabledSubtitle'))}
      >
        <p className="text-sm text-slate-600 text-center">{t(authPublicKey('registrationDisabledBody'))}</p>
      </AuthPublicShell>
    );
  }

  return (
    <AuthPublicShell
      title={t(authPublicKey('createAccountTitle'))}
      subtitle={t(authPublicKey('createAccountSubtitle'))}
      footer={(
        <>
          {t(authPublicKey('alreadyHaveAccount'))}{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">{t(authPublicKey('signInLink'))}</Link>
        </>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-[2px]">
          <label htmlFor="register-email" className="text-[13px] font-bold text-slate-600 ps-[4px] uppercase tracking-wide">{t(authPublicKey('email'))}</label>
          <UiInput id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
        </div>
        <div className="flex flex-col gap-[2px]">
          <label htmlFor="register-username" className="text-[13px] font-bold text-slate-600 ps-[4px] uppercase tracking-wide">{t(authPublicKey('username'))}</label>
          <UiInput id="register-username" value={username} onChange={(e) => setUsername(e.target.value)} disabled={isLoading} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-[2px]">
            <label htmlFor="register-first-name" className="text-[13px] font-bold text-slate-600 ps-[4px] uppercase tracking-wide">{t(authPublicKey('firstName'))}</label>
            <UiInput id="register-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={isLoading} />
          </div>
          <div className="flex flex-col gap-[2px]">
            <label htmlFor="register-last-name" className="text-[13px] font-bold text-slate-600 ps-[4px] uppercase tracking-wide">{t(authPublicKey('lastName'))}</label>
            <UiInput id="register-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={isLoading} />
          </div>
        </div>
        <div className="flex flex-col gap-[2px]">
          <label htmlFor="register-password" className="text-[13px] font-bold text-slate-600 ps-[4px] uppercase tracking-wide">{t(authPublicKey('password'))}</label>
          <UiInput id="register-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
        </div>
        {requireTerms ? (
          <UiCheckboxChoice
            id="register-terms"
            checked={termsAccepted}
            onChange={setTermsAccepted}
            className="items-start"
          >
            <span className="text-sm text-slate-600">{t(authPublicKey('acceptTerms'))}</span>
          </UiCheckboxChoice>
        ) : null}
        {error ? <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">{message}</p> : null}
        <AppButton type="submit" intent="primary" className="w-full" disabled={isLoading || !email || !password || (requireTerms && !termsAccepted)}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t(authPublicKey('createAccount'))}
        </AppButton>
      </form>
    </AuthPublicShell>
  );
};
