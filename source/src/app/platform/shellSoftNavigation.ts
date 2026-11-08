import { isCmsSettingsSoftNavigation } from './cmsSettingsSoftNav';
import { isHwyMemberDossierSoftNavigation } from './hwyMemberDossierSoftNav';

/** Route-family switches that must not run the shell formatted-reveal cover. */
export const isShellSoftNavigation = (fromPathname: string, toPathname: string): boolean => (
  isCmsSettingsSoftNavigation(fromPathname, toPathname)
  || isHwyMemberDossierSoftNavigation(fromPathname, toPathname)
);
