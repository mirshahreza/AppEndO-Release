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
  VxSelfRegistrationPage,
  VxTrackRegistrationPage,
  VxPublicLoginPage,
  VxPublicMyProfilePage,
  VxPublicInquiryPage,
  VxRegistrationDevPortalPage,
} from '../routes/lazyPages';
import {
  buildHwyPublicCulturePath,
  VX_DEFAULT_PUBLIC_CULTURE,
  VX_PUBLIC_PORTAL_SEGMENT,
  VX_LOGIN_PUBLIC_PATH,
  VX_MY_PROFILE_PUBLIC_PATH,
  VX_MEMBER_INQUIRY_PUBLIC_PATH,
  VX_SELF_REGISTRATION_PUBLIC_PATHS,
  VX_SELF_REGISTRATION_DEV_PORTAL_PUBLIC_PATH,
  VX_TRACK_REGISTRATION_PUBLIC_PATH,
  vxSelfRegistrationDevPortalPublicUrl,
  vxTrackRegistrationPublicUrl,
} from '../../domain/vx/selfRegistration/vxSelfRegistrationRoutes';
import { ComponentDesignerOutlinePreviewRoute } from './ComponentDesignerOutlinePreviewRoute';
import { useOptionalPlatformConfig } from './PlatformConfigProvider';
import { getNonCultureEnabledMounts } from './platformConfigHelpers';
import { RootZonePage } from './RootZonePage';
import { PublicCultureScope } from './PublicCultureScope';
import { resolveInvalidCulturePrefixRedirect } from './LegacyAdminUrlResolver';
import { VerticalPackagePublicGate } from '../../shared/packages/VerticalPackagePublicGate';

const ExperienceHost = React.lazy(() =>
  import('./ExperienceHost').then((module) => ({ default: module.ExperienceHost })),
);

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
          <React.Fragment key={`vx-public-${cultureId}`}>
            {VX_SELF_REGISTRATION_PUBLIC_PATHS.map((suffixPath) => (
              <Route
                key={`${cultureId}${suffixPath}`}
                path={`${cultureId}/${VX_PUBLIC_PORTAL_SEGMENT}${suffixPath}`}
                element={withPublicCulture(<VerticalPackagePublicGate><VxSelfRegistrationPage /></VerticalPackagePublicGate>)}
              />
            ))}
            <Route
              key={`${cultureId}${VX_TRACK_REGISTRATION_PUBLIC_PATH}`}
              path={`${cultureId}/${VX_PUBLIC_PORTAL_SEGMENT}${VX_TRACK_REGISTRATION_PUBLIC_PATH}`}
              element={withPublicCulture(<VerticalPackagePublicGate><VxTrackRegistrationPage /></VerticalPackagePublicGate>)}
            />
            <Route
              key={`${cultureId}${VX_LOGIN_PUBLIC_PATH}`}
              path={`${cultureId}/${VX_PUBLIC_PORTAL_SEGMENT}${VX_LOGIN_PUBLIC_PATH}`}
              element={withPublicCulture(<VerticalPackagePublicGate><VxPublicLoginPage /></VerticalPackagePublicGate>)}
            />
            <Route
              key={`${cultureId}${VX_MY_PROFILE_PUBLIC_PATH}`}
              path={`${cultureId}/${VX_PUBLIC_PORTAL_SEGMENT}${VX_MY_PROFILE_PUBLIC_PATH}`}
              element={withPublicCulture(<VerticalPackagePublicGate><VxPublicMyProfilePage /></VerticalPackagePublicGate>)}
            />
            <Route
              key={`${cultureId}${VX_MEMBER_INQUIRY_PUBLIC_PATH}`}
              path={`${cultureId}/${VX_PUBLIC_PORTAL_SEGMENT}${VX_MEMBER_INQUIRY_PUBLIC_PATH}`}
              element={withPublicCulture(<VerticalPackagePublicGate><VxPublicInquiryPage /></VerticalPackagePublicGate>)}
            />
            <Route
              key={`${cultureId}${VX_SELF_REGISTRATION_DEV_PORTAL_PUBLIC_PATH}`}
              path={`${cultureId}/${VX_PUBLIC_PORTAL_SEGMENT}${VX_SELF_REGISTRATION_DEV_PORTAL_PUBLIC_PATH}`}
              element={withPublicCulture(<VerticalPackagePublicGate><VxRegistrationDevPortalPage /></VerticalPackagePublicGate>)}
            />
          </React.Fragment>
        ))}
        {VX_SELF_REGISTRATION_PUBLIC_PATHS.map((suffixPath) => (
          <Route
            key={`legacy-redirect${suffixPath}`}
            path={suffixPath.replace(/^\//, '')}
            element={<Navigate to={buildHwyPublicCulturePath(suffixPath, VX_DEFAULT_PUBLIC_CULTURE)} replace />}
          />
        ))}
        <Route
          path={VX_TRACK_REGISTRATION_PUBLIC_PATH.replace(/^\//, '')}
          element={<Navigate to={vxTrackRegistrationPublicUrl(VX_DEFAULT_PUBLIC_CULTURE)} replace />}
        />
        <Route
          path={VX_SELF_REGISTRATION_DEV_PORTAL_PUBLIC_PATH.replace(/^\//, '')}
          element={<Navigate to={vxSelfRegistrationDevPortalPublicUrl(VX_DEFAULT_PUBLIC_CULTURE)} replace />}
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
