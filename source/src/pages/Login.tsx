import React from 'react';
import { Login as LoginPage } from '../features/auth/LoginPage';
import { VxLoginPortalLinks } from '../features/vx-public-self-registration/VxLoginPortalLinks';
import { useAppBootQuery } from '../shared/api/queries/boot';
import { isVerticalPackageEnabledOnBoot } from '../shared/packages/verticalRuntimeClient';

export const Login: React.FC = () => {
  const boot = useAppBootQuery();
  const showVerticalLinks = isVerticalPackageEnabledOnBoot(boot.data);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">
        <LoginPage />
      </div>
      {showVerticalLinks ? (
        <div className="flex justify-center px-4 pb-8">
          <div className="w-full max-w-[320px] rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
            <VxLoginPortalLinks />
          </div>
        </div>
      ) : null}
    </div>
  );
};
