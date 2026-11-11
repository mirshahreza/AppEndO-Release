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
  HwySelfRegistrationPage,
  HwyTrackRegistrationPage,
  HwyPublicLoginPage,
  HwyPublicMyProfilePage,
  HwyPublicInquiryPage,
  HwyRegistrationDevPortalPage,
} from '../routes/lazyPages';
import {
  buildHwyPublicCulturePath,
  HWY_DEFAULT_PUBLIC_CULTURE,
  HWY_PUBLIC_PORTAL_SEGMENT,
  HWY_LOGIN_PUBLIC_PATH,
  HWY_MY_PROFILE_PUBLIC_PATH,
  HWY_MEMBER_INQUIRY_PUBLIC_PATH,
  HWY_SELF_REGISTRATION_PUBLIC_PATHS,
  HWY_SELF_REGISTRATION_DEV_PORTAL_PUBLIC_PATH,
  HWY_TRACK_REGISTRATION_PUBLIC_PATH,
  hwySelfRegistrationDevPortalPublicUrl,
  hwyTrackRegistrationPublicUrl,
} from '../../domain/hwy/selfRegistration/hwySelfRegistrationRoutes';
import { ComponentDesignerOutlinePreviewRoute } from './ComponentDesignerOutlinePreviewRoute';
import { useOptionalPlatformConfig } from './PlatformConfigProvider';
import { getNonCultureEnabledMounts } from './platformConfigHelpers';
import { RootZonePage } from './RootZonePage';
import { PublicCultureScope } from './PublicCultureScope';
import { resolveInvalidCulturePrefixRedirect } from './LegacyAdminUrlResolver';
import { HawietyPackagePublicGate } from '../../shared/packages/HawietyPackagePublicGate';

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
          <React.Fragment key={`hwy-public-${cultureId}`}>
            {HWY_SELF_REGISTRATION_PUBLIC_PATHS.map((suffixPath) => (
              <Route
                key={`${cultureId}${suffixPath}`}
                path={`${cultureId}/${HWY_PUBLIC_PORTAL_SEGMENT}${suffixPath}`}
                element={withPublicCulture(<HawietyPackagePublicGate><HwySelfRegistrationPage /></HawietyPackagePublicGate>)}
              />
            ))}
            <Route
              key={`${cultureId}${HWY_TRACK_REGISTRATION_PUBLIC_PATH}`}
              path={`${cultureId}/${HWY_PUBLIC_PORTAL_SEGMENT}${HWY_TRACK_REGISTRATION_PUBLIC_PATH}`}
              element={withPublicCulture(<HawietyPackagePublicGate><HwyTrackRegistrationPage /></HawietyPackagePublicGate>)}
            />
            <Route
              key={`${cultureId}${HWY_LOGIN_PUBLIC_PATH}`}
              path={`${cultureId}/${HWY_PUBLIC_PORTAL_SEGMENT}${HWY_LOGIN_PUBLIC_PATH}`}
              element={withPublicCulture(<HawietyPackagePublicGate><HwyPublicLoginPage /></HawietyPackagePublicGate>)}
            />
            <Route
              key={`${cultureId}${HWY_MY_PROFILE_PUBLIC_PATH}`}
              path={`${cultureId}/${HWY_PUBLIC_PORTAL_SEGMENT}${HWY_MY_PROFILE_PUBLIC_PATH}`}
              element={withPublicCulture(<HawietyPackagePublicGate><HwyPublicMyProfilePage /></HawietyPackagePublicGate>)}
            />
            <Route
              key={`${cultureId}${HWY_MEMBER_INQUIRY_PUBLIC_PATH}`}
              path={`${cultureId}/${HWY_PUBLIC_PORTAL_SEGMENT}${HWY_MEMBER_INQUIRY_PUBLIC_PATH}`}
              element={withPublicCulture(<HawietyPackagePublicGate><HwyPublicInquiryPage /></HawietyPackagePublicGate>)}
            />
            <Route
              key={`${cultureId}${HWY_SELF_REGISTRATION_DEV_PORTAL_PUBLIC_PATH}`}
              path={`${cultureId}/${HWY_PUBLIC_PORTAL_SEGMENT}${HWY_SELF_REGISTRATION_DEV_PORTAL_PUBLIC_PATH}`}
              element={withPublicCulture(<HawietyPackagePublicGate><HwyRegistrationDevPortalPage /></HawietyPackagePublicGate>)}
            />
          </React.Fragment>
        ))}
        {HWY_SELF_REGISTRATION_PUBLIC_PATHS.map((suffixPath) => (
          <Route
            key={`legacy-redirect${suffixPath}`}
            path={suffixPath.replace(/^\//, '')}
            element={<Navigate to={buildHwyPublicCulturePath(suffixPath, HWY_DEFAULT_PUBLIC_CULTURE)} replace />}
          />
        ))}
        <Route
          path={HWY_TRACK_REGISTRATION_PUBLIC_PATH.replace(/^\//, '')}
          element={<Navigate to={hwyTrackRegistrationPublicUrl(HWY_DEFAULT_PUBLIC_CULTURE)} replace />}
        />
        <Route
          path={HWY_SELF_REGISTRATION_DEV_PORTAL_PUBLIC_PATH.replace(/^\//, '')}
          element={<Navigate to={hwySelfRegistrationDevPortalPublicUrl(HWY_DEFAULT_PUBLIC_CULTURE)} replace />}
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
