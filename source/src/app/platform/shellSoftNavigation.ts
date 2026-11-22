import { isCmsSettingsSoftNavigation } from './cmsSettingsSoftNav';
import { isExtxMemberDossierSoftNavigation } from '../../oss/excludedModuleStub';

/** Route-family switches that must not run the shell formatted-reveal cover. */
export const isShellSoftNavigation = (fromPathname: string, toPathname: string): boolean => (
  isCmsSettingsSoftNavigation(fromPathname, toPathname)
  || isExtxMemberDossierSoftNavigation(fromPathname, toPathname)
);
