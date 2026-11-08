import React from 'react';
import { cn } from '../../lib/utils';
import { AppEndLogo } from '../../components/AppEndLogo';
import { InstallWizardBackdrop } from './InstallWizardBackdrop';

type InstallWizardPageShellProps = {
  children: React.ReactNode;
  showLogo?: boolean;
};

export const InstallWizardPageShell: React.FC<InstallWizardPageShellProps> = ({
  children,
  showLogo = true,
}) => (
  <div className="install-wizard-page shell-atmosphere relative flex h-dvh min-h-dvh flex-col items-center justify-start overflow-hidden p-0 md:h-auto md:min-h-dvh md:justify-center lg:p-4">
    <InstallWizardBackdrop />
    <div className="relative z-10 flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col items-stretch md:h-auto md:flex-none md:items-center">
      {showLogo ? (
        <div className="install-wizard-logo-enter mb-2 mt-3 flex w-full shrink-0 justify-center md:mb-3 md:mt-0 lg:mb-6">
          <AppEndLogo />
        </div>
      ) : null}
      <div
        className={cn(
          'install-wizard-enter flex min-h-0 w-full flex-1 flex-col items-stretch md:flex-none md:items-center md:justify-center',
          !showLogo && 'install-wizard-enter--solo',
        )}
      >
        {children}
      </div>
    </div>
  </div>
);
