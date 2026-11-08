import type { Express } from 'express';
import {
  DEFAULT_BUILTIN_CULTURE_PACKS,
} from '../../shared/api/contracts/platform/cultures';
import { INSTALL_WIZARD_API_VERSION } from '../../shared/api/contracts/install/types';
import { buildDefaultEuaCapabilities } from '../../shared/api/contracts/ai/euaFieldAssist';
import { buildPwaWebManifest, DEFAULT_PWA_SETTINGS } from '../../shared/api/contracts/settings/pwa';
import { getRequestPathname } from '../utils/requestPaths';

const INSTALL_RUNTIME_CONFIG = {
  success: true as const,
  version: 'install-pending',
  mounts: [] as const,
  shells: [] as const,
  shellRules: [] as const,
  pageModules: [] as const,
  bindings: [] as const,
  navigations: [] as const,
};

const INSTALL_CULTURES = {
  success: true as const,
  packs: DEFAULT_BUILTIN_CULTURE_PACKS,
  enabledCulturePackIds: ['us'],
  defaultCultureId: 'us',
  availablePacks: DEFAULT_BUILTIN_CULTURE_PACKS.map((pack) => ({
    ...pack,
    source: 'builtin' as const,
  })),
};

const INSTALL_AUTH_CONFIG = {
  success: true as const,
  config: {
    login: {
      allowUsername: true,
      allowEmail: true,
      allowMobile: false,
    },
    otp: {
      enabled: false,
      channelEmail: false,
    },
    verification: {
      emailVerifyEnabled: false,
      emailVerifyRequired: false,
    },
    registration: {
      enabled: false,
      requireTerms: false,
      defaultRole: 'DEVELOPER',
    },
    identityProviders: [] as const,
  },
};

export function mountInstallPendingBootStubs(
  app: Express,
  isPromoted: () => boolean = () => false,
): void {
  app.use((req, res, next) => {
    if (isPromoted()) {
      next();
      return;
    }

    if (req.method !== 'GET') {
      next();
      return;
    }

    const pathname = getRequestPathname(req);

    switch (pathname) {
      case '/api/boot':
        res.json({
          success: true,
          runtimeConfig: {
            mounts: INSTALL_RUNTIME_CONFIG.mounts,
            shells: INSTALL_RUNTIME_CONFIG.shells,
            shellRules: INSTALL_RUNTIME_CONFIG.shellRules,
            pageModules: INSTALL_RUNTIME_CONFIG.pageModules,
            bindings: INSTALL_RUNTIME_CONFIG.bindings,
            navigations: INSTALL_RUNTIME_CONFIG.navigations,
            version: INSTALL_RUNTIME_CONFIG.version,
          },
          cultures: INSTALL_CULTURES,
          cultureTranslations: { revision: 0, cultureOverrides: {} },
          install: {
            success: true,
            apiVersion: INSTALL_WIZARD_API_VERSION,
            install: {
              pending: true,
              completed: false,
            },
          },
          enabledPackages: [],
          pwa: DEFAULT_PWA_SETTINGS,
          webFonts: [],
        });
        return;
      case '/api/platform/runtime-config':
        res.json(INSTALL_RUNTIME_CONFIG);
        return;
      case '/api/platform/cultures':
        res.json(INSTALL_CULTURES);
        return;
      case '/api/pwa/config':
        res.json({ success: true, ...DEFAULT_PWA_SETTINGS });
        return;
      case '/api/auth/config':
        res.json(INSTALL_AUTH_CONFIG);
        return;
      case '/api/auth/me':
        res.json({ success: false });
        return;
      case '/api/eua/status':
        res.json({
          success: true,
          aiEnabled: false,
          capabilities: buildDefaultEuaCapabilities(false),
        });
        return;
      case '/manifest.webmanifest':
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.json(buildPwaWebManifest(DEFAULT_PWA_SETTINGS));
        return;
      default:
        next();
    }
  });
}
