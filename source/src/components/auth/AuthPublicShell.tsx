import React from 'react';
import { Link } from 'react-router-dom';
import { useOptionalCultureT } from '../../core/culture/CultureContext';
import { authPublicKey } from '../../core/culture/translations/cultureKeyHelpers';
import { AppEndLogo } from '../AppEndLogo';
import { cn } from '../../lib/utils';
import { SHADOW_MODAL } from '../../shared/ui/surfaceClasses';

type AuthPublicShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export const AuthPublicShell: React.FC<AuthPublicShellProps> = ({
  title,
  subtitle,
  children,
  footer,
}) => {
  const t = useOptionalCultureT();

  return (
    <div className="min-h-screen bg-surface-auth flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className={cn('w-full max-w-[460px] bg-white/85 backdrop-blur-xl border border-white/40 rounded-xl p-8 z-10', SHADOW_MODAL)}>
        <div className="flex flex-col items-center mb-8">
          <AppEndLogo />
          <h1 className="mt-6 text-xl font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-slate-500 text-center">{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <div className="mt-6 pt-4 border-t border-slate-100 text-center text-sm text-slate-500">{footer}</div> : null}
      </div>
      <p className="mt-6 text-sm text-slate-500">
        <Link to="/login" className="font-semibold text-primary-700 hover:text-primary-700">
          {t(authPublicKey('backToSignIn'))}
        </Link>
      </p>
    </div>
  );
};
