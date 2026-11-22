import React from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { getEnabledCulturePackIds } from '../../core/culture/CultureRegistry';
import { RouteNotFoundPage } from '../../pages/RouteNotFoundPage';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import { InstallGate } from '../../components/InstallGate';
import {
  DashboardSnapshotPage,
  ForgotPasswordPage,
  InstallPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  SharedWorkbookPage,
  VerifyEmailPage,
  ExtxSelfRegistrationPage,
  ExtxTrackRegistrationPage,
  ExtxPublicLoginPage,
  ExtxPublicMyProfilePage,
  ExtxPublicInquiryPage,
  ExtxRegistrationDevPortalPage,
} from '../routes/lazyPages';
import {
  buildExtxPublicCulturePath,
  EXTX_DEFAULT_PUBLIC_CULTURE,
  EXTX_PUBLIC_PORTAL_SEGMENT,
  EXTX_LOGIN_PUBLIC_PATH,
  EXTX_MY_PROFILE_PUBLIC_PATH,
  EXTX_MEMBER_INQUIRY_PUBLIC_PATH,
  EXTX_SELF_REGISTRATION_PUBLIC_PATHS,
  EXTX_SELF_REGISTRATION_DEV_PORTAL_PUBLIC_PATH,
  EXTX_TRACK_REGISTRATION_PUBLIC_PATH,
  extxSelfRegistrationDevPortalPublicUrl,
  extxTrackRegistrationPublicUrl,
} from '../../oss/excludedModuleStub';
import { ComponentDesignerOutlinePreviewRoute } from './ComponentDesignerOutlinePreviewRoute';
import { useOptionalPlatformConfig } from './PlatformConfigProvider';
import { getNonCultureEnabledMounts } from './platformConfigHelpers';
import { RootZonePage } from './RootZonePage';
import { PublicCultureScope } from './PublicCultureScope';
import { resolveInvalidCulturePrefixRedirect } from './LegacyAdminUrlResolver';
import { PortalxPackagePublicGate } from '../../oss/excludedModuleStub';

const ExperienceHost = React.lazy(() => {
  void import('./LazyExperienceMountRuntimeProviders').then((module) => {
    void module.preloadExperienceMountRuntimeProviders();
  });
  return import('./ExperienceHost').then((module) => ({ default: module.ExperienceHost }));
});

const UnmatchedPlatformRoute: React.FC = () => {
  const { pathname } = useLocation();
  const redirectPath = resolveInvalidCulturePrefixRedirect(pathname);
  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }
  return <RouteNotFoundPage variant="fullscreen" />;
};

const BootedPlatformRoutes: React.FC = () => {
  const platformConfig = useOptionalPlatformConfig();
  if (!platformConfig) {
    return <AppRouteLoading />;
  }
  const { config, version } = platformConfig;
  const nonCultureMounts = getNonCultureEnabledMounts(config);
  const cultureRouteIds = getEnabledCulturePackIds();

  return (
    <Routes>
      <Route path="/" element={<RootZonePage />} />
      {nonCultureMounts.map((mount) => {
        const routePath = mount.pathPrefix.replace(/^\//, '');
        return (
          <Route
            key={`${mount.id}:${version}`}
            path={`${routePath}/*`}
            element={<ExperienceHost mountId={mount.id} />}
          />
        );
      })}
      {cultureRouteIds.map((cultureId) => (
        <Route
          key={`shared-workbook:${cultureId}:${version}`}
          path={`${cultureId}/shared/workbooks/:workbookId`}
          element={withPublicCulture(<SharedWorkbookPage />)}
        />
      ))}
      {cultureRouteIds.map((cultureId) => (
        <Route
          key={`shared-dashboard-snapshot:${cultureId}:${version}`}
          path={`${cultureId}/shared/dashboard-snapshots/:snapshotId`}
          element={withPublicCulture(<DashboardSnapshotPage />)}
        />
      ))}
      {cultureRouteIds.map((cultureId) => (
        <Route
          key={`culture:${cultureId}:${version}`}
          path={`${cultureId}/*`}
          element={<ExperienceHost mountId={cultureId} />}
        />
      ))}
      <Route path="*" element={withPublicCulture(<UnmatchedPlatformRoute />)} />
    </Routes>
  );
};

const withPublicCulture = (element: React.ReactElement) => (
  <PublicCultureScope>{element}</PublicCultureScope>
);

export const PlatformAppRoutes: React.FC = () => (
  <InstallGate>
    <React.Suspense fallback={<AppRouteLoading />}>
      <Routes>
        <Route path="/install" element={withPublicCulture(<InstallPage />)} />
        <Route path="/login" element={withPublicCulture(<LoginPage />)} />
        {getEnabledCulturePackIds().map((cultureId) => (
          <React.Fragment key={`extx-public-${cultureId}`}>
            {EXTX_SELF_REGISTRATION_PUBLIC_PATHS.map((suffixPath) => (
              <Route
                key={`${cultureId}${suffixPath}`}
                path={`${cultureId}/${EXTX_PUBLIC_PORTAL_SEGMENT}${suffixPath}`}
                element={withPublicCulture(<PortalxPackagePublicGate><ExtxSelfRegistrationPage /></PortalxPackagePublicGate>)}
              />
            ))}
            <Route
              key={`${cultureId}${EXTX_TRACK_REGISTRATION_PUBLIC_PATH}`}
              path={`${cultureId}/${EXTX_PUBLIC_PORTAL_SEGMENT}${EXTX_TRACK_REGISTRATION_PUBLIC_PATH}`}
              element={withPublicCulture(<PortalxPackagePublicGate><ExtxTrackRegistrationPage /></PortalxPackagePublicGate>)}
            />
            <Route
              key={`${cultureId}${EXTX_LOGIN_PUBLIC_PATH}`}
              path={`${cultureId}/${EXTX_PUBLIC_PORTAL_SEGMENT}${EXTX_LOGIN_PUBLIC_PATH}`}
              element={withPublicCulture(<PortalxPackagePublicGate><ExtxPublicLoginPage /></PortalxPackagePublicGate>)}
            />
            <Route
              key={`${cultureId}${EXTX_MY_PROFILE_PUBLIC_PATH}`}
              path={`${cultureId}/${EXTX_PUBLIC_PORTAL_SEGMENT}${EXTX_MY_PROFILE_PUBLIC_PATH}`}
              element={withPublicCulture(<PortalxPackagePublicGate><ExtxPublicMyProfilePage /></PortalxPackagePublicGate>)}
            />
            <Route
              key={`${cultureId}${EXTX_MEMBER_INQUIRY_PUBLIC_PATH}`}
              path={`${cultureId}/${EXTX_PUBLIC_PORTAL_SEGMENT}${EXTX_MEMBER_INQUIRY_PUBLIC_PATH}`}
              element={withPublicCulture(<PortalxPackagePublicGate><ExtxPublicInquiryPage /></PortalxPackagePublicGate>)}
            />
            <Route
              key={`${cultureId}${EXTX_SELF_REGISTRATION_DEV_PORTAL_PUBLIC_PATH}`}
              path={`${cultureId}/${EXTX_PUBLIC_PORTAL_SEGMENT}${EXTX_SELF_REGISTRATION_DEV_PORTAL_PUBLIC_PATH}`}
              element={withPublicCulture(<PortalxPackagePublicGate><ExtxRegistrationDevPortalPage /></PortalxPackagePublicGate>)}
            />
          </React.Fragment>
        ))}
        {EXTX_SELF_REGISTRATION_PUBLIC_PATHS.map((suffixPath) => (
          <Route
            key={`legacy-redirect${suffixPath}`}
            path={suffixPath.replace(/^\//, '')}
            element={<Navigate to={buildExtxPublicCulturePath(suffixPath, EXTX_DEFAULT_PUBLIC_CULTURE)} replace />}
          />
        ))}
        <Route
          path={EXTX_TRACK_REGISTRATION_PUBLIC_PATH.replace(/^\//, '')}
          element={<Navigate to={extxTrackRegistrationPublicUrl(EXTX_DEFAULT_PUBLIC_CULTURE)} replace />}
        />
        <Route
          path={EXTX_SELF_REGISTRATION_DEV_PORTAL_PUBLIC_PATH.replace(/^\//, '')}
          element={<Navigate to={extxSelfRegistrationDevPortalPublicUrl(EXTX_DEFAULT_PUBLIC_CULTURE)} replace />}
        />
        <Route path="/register" element={withPublicCulture(<RegisterPage />)} />
        <Route path="/forgot-password" element={withPublicCulture(<ForgotPasswordPage />)} />
        <Route path="/reset-password" element={withPublicCulture(<ResetPasswordPage />)} />
        <Route path="/verify-email" element={withPublicCulture(<VerifyEmailPage />)} />
        <Route path="/shared/workbooks/:workbookId" element={withPublicCulture(<SharedWorkbookPage />)} />
        <Route path="/shared/dashboard-snapshots/:snapshotId" element={withPublicCulture(<DashboardSnapshotPage />)} />
        <Route path="/studio/component-preview" element={<ComponentDesignerOutlinePreviewRoute />} />
        <Route path="*" element={<BootedPlatformRoutes />} />
      </Routes>
    </React.Suspense>
  </InstallGate>
);
