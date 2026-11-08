import React from 'react';
import { Login as LoginPage } from '../features/auth/LoginPage';
import { HwyLoginPortalLinks } from '../features/hwy-public-self-registration/HwyLoginPortalLinks';
import { useAppBootQuery } from '../shared/api/queries/boot';
import { isHawietyPackageEnabledOnBoot } from '../shared/packages/hawietyRuntimeClient';

export const Login: React.FC = () => {
  const boot = useAppBootQuery();
  const showHawietyLinks = isHawietyPackageEnabledOnBoot(boot.data);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">
        <LoginPage />
      </div>
      {showHawietyLinks ? (
        <div className="flex justify-center px-4 pb-8">
          <div className="w-full max-w-[320px] rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
            <HwyLoginPortalLinks />
          </div>
        </div>
      ) : null}
    </div>
  );
};
