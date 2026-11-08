import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthPublicShell } from '../components/auth/AuthPublicShell';
import { AppButton } from '../shared/ui/AppButton';
import { apiGet } from '../shared/api/client';
import { useOptionalCultureT } from '../core/culture/CultureContext';
import { authPublicKey } from '../core/culture/translations/cultureKeyHelpers';

export const VerifyEmail: React.FC = () => {
  const t = useOptionalCultureT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const challengeId = useMemo(() => {
    const raw = searchParams.get('challenge');
    return raw ? Number(raw) : undefined;
  }, [searchParams]);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (!token) {
        setError(t(authPublicKey('verificationTokenMissing')));
        setIsLoading(false);
        return;
      }

      try {
        const query = new URLSearchParams({ token });
        if (challengeId) {
          query.set('challenge', String(challengeId));
        }
        const { data, response } = await apiGet<{ success?: boolean; message?: string; error?: string }>(
          `/api/auth/verify-email?${query.toString()}`,
        );

        if (response.ok && data.success) {
          setMessage(data.message || t(authPublicKey('emailVerified')));
          window.setTimeout(() => navigate('/login'), 1800);
          return;
        }

        setError(data.error || t(authPublicKey('unableToVerifyEmail')));
      } catch {
        setError(t(authPublicKey('unableToVerifyEmailRetry')));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [challengeId, navigate, t, token]);

  return (
    <AuthPublicShell title={t(authPublicKey('verifyEmailTitle'))}>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {error ? <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">{message}</p> : null}
          {!message ? (
            <AppButton intent="secondary" className="w-full" onClick={() => navigate('/login')}>
              {t(authPublicKey('backToSignIn'))}
            </AppButton>
          ) : null}
        </div>
      )}
    </AuthPublicShell>
  );
};
