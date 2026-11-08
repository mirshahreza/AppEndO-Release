import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthPublicShell } from '../components/auth/AuthPublicShell';
import { UiInput } from '../shared/ui/HeroFieldControls';
import { AppButton } from '../shared/ui/AppButton';
import { apiPost } from '../shared/api/client';
import { useOptionalCultureT } from '../core/culture/CultureContext';
import { authPublicKey } from '../core/culture/translations/cultureKeyHelpers';

export const ResetPassword: React.FC = () => {
  const t = useOptionalCultureT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const challengeId = useMemo(() => {
    const raw = searchParams.get('challenge');
    return raw ? Number(raw) : undefined;
  }, [searchParams]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError(t(authPublicKey('resetTokenMissing')));
      return;
    }
    if (newPassword.length < 8) {
      setError(t(authPublicKey('passwordTooShort')));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t(authPublicKey('passwordsDoNotMatch')));
      return;
    }

    setIsLoading(true);
    try {
      const { data, response } = await apiPost<{ success?: boolean; message?: string; error?: string }>(
        '/api/auth/reset-password',
        { token, challengeId, newPassword },
      );

      if (response.ok && data.success) {
        setMessage(data.message || t(authPublicKey('passwordResetSuccess')));
        window.setTimeout(() => navigate('/login'), 1500);
        return;
      }

      setError(data.error || t(authPublicKey('unableToResetPassword')));
    } catch {
      setError(t(authPublicKey('unableToResetPasswordRetry')));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPublicShell title={t(authPublicKey('resetPasswordTitle'))} subtitle={t(authPublicKey('resetPasswordSubtitle'))}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-[2px]">
          <label htmlFor="reset-password" className="text-[13px] font-bold text-slate-600 ps-[4px] uppercase tracking-wide">{t(authPublicKey('newPassword'))}</label>
          <UiInput id="reset-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isLoading} />
        </div>
        <div className="flex flex-col gap-[2px]">
          <label htmlFor="reset-password-confirm" className="text-[13px] font-bold text-slate-600 ps-[4px] uppercase tracking-wide">{t(authPublicKey('confirmPassword'))}</label>
          <UiInput id="reset-password-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} />
        </div>
        {error ? <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">{message}</p> : null}
        <AppButton type="submit" intent="primary" className="w-full" disabled={isLoading || !newPassword || !confirmPassword}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t(authPublicKey('resetPasswordAction'))}
        </AppButton>
      </form>
    </AuthPublicShell>
  );
};
