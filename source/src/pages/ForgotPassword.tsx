import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthPublicShell } from '../components/auth/AuthPublicShell';
import { UiInput } from '../shared/ui/HeroFieldControls';
import { AppButton } from '../shared/ui/AppButton';
import { apiPost, formatApiErrorMessage, isApiError } from '../shared/api/client';
import { useOptionalCultureT } from '../core/culture/CultureContext';
import { authPublicKey } from '../core/culture/translations/cultureKeyHelpers';

export const ForgotPassword: React.FC = () => {
  const t = useOptionalCultureT();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const { data, response } = await apiPost<{ success?: boolean; message?: string; error?: string }>(
        '/api/auth/forgot-password',
        { email },
      );

      if (response.ok && data.success) {
        setMessage(data.message || t(authPublicKey('forgotPasswordSuccess')));
        return;
      }

      setError(data.error || t(authPublicKey('unableToProcessRequest')));
    } catch (error) {
      setError(isApiError(error) ? formatApiErrorMessage(error) : t(authPublicKey('unableToProcessRequestRetry')));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPublicShell title={t(authPublicKey('forgotPasswordTitle'))} subtitle={t(authPublicKey('forgotPasswordSubtitle'))}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-[2px]">
          <label htmlFor="forgot-email" className="text-[13px] font-bold text-slate-600 ps-[4px] uppercase tracking-wide">{t(authPublicKey('email'))}</label>
          <UiInput id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
        </div>
        {error ? <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">{message}</p> : null}
        <AppButton type="submit" intent="primary" className="w-full" disabled={isLoading || !email}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t(authPublicKey('sendResetLink'))}
        </AppButton>
      </form>
    </AuthPublicShell>
  );
};
