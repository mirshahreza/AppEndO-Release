import React from 'react';
import { useLocation } from 'react-router-dom';
import { PROJECT_STANDARDS } from '../config/projectStandards';
import { useOptionalCultureT } from '../core/culture/CultureContext';
import { PORTALX_PACKAGE_VERSION } from '../oss/excludedModuleStub';
import { isPortalxPublicPathname } from '../oss/excludedModuleStub';
import { AppEndLogo } from './AppEndLogo';
import {
  AppDialogShell,
  DialogBody,
} from '../shared/ui/dialog';
import {
  DEFAULT_PORTAL_ABOUT_BODY,
  DEFAULT_PORTAL_ABOUT_TITLE,
  type ResolvedPortalBrand,
} from '../shared/api/contracts/platform/portalBrand';
import { FORM_THEME_INK_LABEL_CLASS } from '../shared/ui/formThemeInk';
import { cn } from '../lib/utils';

interface AboutAppModalProps {
  open: boolean;
  onClose: () => void;
  brand?: ResolvedPortalBrand | null;
  /** When true, show Portalx package version (auto-detected from `/portalx/` URL when omitted). */
  showPortalxPackageVersion?: boolean;
}

export const AboutAppModal = ({
  open,
  onClose,
  brand = null,
  showPortalxPackageVersion,
}: AboutAppModalProps) => {
  const t = useOptionalCultureT();
  const { pathname } = useLocation();
  const showPortalxPackage =
    showPortalxPackageVersion ?? isPortalxPublicPathname(pathname);

  const portalxAboutTitleKey = 'extx.selfReg.portal.aboutTitle';
  const portalxAboutBodyKey = 'extx.selfReg.portal.aboutBody';
  const cultureAboutTitle = t(portalxAboutTitleKey);
  const cultureAboutBody = t(portalxAboutBodyKey);
  const headline = showPortalxPackage && cultureAboutTitle !== portalxAboutTitleKey
    ? cultureAboutTitle
    : brand?.aboutTitle?.trim() || DEFAULT_PORTAL_ABOUT_TITLE;
  const body = showPortalxPackage && cultureAboutBody !== portalxAboutBodyKey
    ? cultureAboutBody
    : brand?.aboutBody?.trim() || DEFAULT_PORTAL_ABOUT_BODY;

  const portalxPackageVersionKey = 'extx.selfReg.portal.aboutPortalxPackageVersionLabel';
  const standardsLabelKey = 'extx.selfReg.portal.aboutStandardsLabel';
  const portalxPackageVersionLabelRaw = t(portalxPackageVersionKey);
  const portalxPackageVersionLabel =
    portalxPackageVersionLabelRaw === portalxPackageVersionKey
      ? 'Portalx package'
      : portalxPackageVersionLabelRaw;
  const standardsLabelRaw = showPortalxPackage ? t(standardsLabelKey) : 'Standards';
  const standardsLabel =
    showPortalxPackage && standardsLabelRaw !== standardsLabelKey
      ? standardsLabelRaw
      : 'Standards';
  return (
    <AppDialogShell
      open={open}
      backdrop="admin"
      size="auto"
      onClose={onClose}
      onBackdropClick={onClose}
      ariaLabel={headline}
      shellOrbitBorder
      shellClassName="overflow-hidden p-0 w-[662px] max-w-[calc(100vw-32px)]"
    >
      <DialogBody gradient={false} outerClassName="!mx-0 flex-1 min-h-0" innerClassName="!p-0">
        <div className="relative overflow-hidden border-b border-slate-200">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full bg-emerald-glow-a22 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full bg-indigo-glow-a16 blur-3xl"
          />
          <div className="header-line-pattern relative bg-gradient-to-br from-primary-subtle/85 via-white to-white px-8 py-6">
            <div className="flex justify-center">
              <AppEndLogo src={brand?.logoUrl} alt={brand?.title} />
            </div>
          </div>
        </div>

        <div
          className={cn('space-y-4 bg-surface-elevated p-8', showPortalxPackage && 'text-start')}
          dir={showPortalxPackage ? 'rtl' : undefined}
          lang={showPortalxPackage ? 'ar' : undefined}
        >
          <div className="space-y-2">
            <h3 className="text-lg font-black tracking-tight text-slate-900">{headline}</h3>
            <p className="text-sm leading-relaxed text-slate-500 whitespace-pre-wrap">{body}</p>
          </div>

          <div className="space-y-3 pt-2 text-xs text-slate-500">
            {showPortalxPackage ? (
              <p>
                <span className={cn('font-semibold', FORM_THEME_INK_LABEL_CLASS.accent)}>
                  {portalxPackageVersionLabel}
                </span>
                {' '}
                <bdi dir="ltr" className="tabular-nums">
                  v
                  {PORTALX_PACKAGE_VERSION}
                </bdi>
              </p>
            ) : null}
            <p>
              <span className={cn('font-semibold', FORM_THEME_INK_LABEL_CLASS.complement)}>{standardsLabel}</span>
              {' '}
              {showPortalxPackage ? (
                <bdi dir="ltr" className="tabular-nums">
                  v
                  {PROJECT_STANDARDS.version}
                </bdi>
              ) : (
                <>
                  v
                  {PROJECT_STANDARDS.version}
                </>
              )}
            </p>
          </div>
        </div>
      </DialogBody>
    </AppDialogShell>
  );
};
