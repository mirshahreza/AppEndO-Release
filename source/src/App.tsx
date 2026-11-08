/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useLayoutEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AccentThemeProvider } from './contexts/AccentThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { GridColumnLayoutsProvider } from './contexts/GridColumnLayoutsContext';
import { UserAccentThemeBridge } from './contexts/UserAccentThemeBridge';
import { ThemePresetRuntimeBridge } from './contexts/ThemePresetRuntimeBridge';
import { PlatformAppRoutes } from './app/platform/PlatformAppRoutes';
import { CulturePathGuard } from './app/platform/CulturePathGuard';
import { PlatformConfigProvider } from './app/platform/PlatformConfigProvider';
import { dismissAppBootSplash } from './components/dismissAppBootSplash';
import { scheduleAppBootSplashDismiss } from './components/scheduleAppBootSplashDismiss';
import { ViewportTierProvider } from './shared/lib/useViewportTier';
// Import directly from the provider's own file, not the ai-field-assist barrel — the barrel
// re-exports ~30 things (dialogs, launchers, toolbars) from sibling files, and importing even
// one name from it pulls all of those into whatever chunk this import lands in. Provider only
// needs its own module (see shared/ui/ai-field-assist/AiFieldAssistProvider.tsx).
import { AiFieldAssistProvider } from './shared/ui/ai-field-assist/AiFieldAssistProvider';
import { AppEndooHost } from './shared/ui/shell/AppEndooHost';
import { PageGuideHost } from './shared/ui/shell/pageGuide/PageGuideHost';
import { AppToastHost } from './shared/ui/AppToastHost';
import { UiToastProvider } from './shared/ui/UiToastProvider';

const BOOT_SPLASH_SAFETY_MS = 12_000;

export default function App() {
  useLayoutEffect(() => {
    // Shell first-surface owns dismiss (ShellChromeEnter). For auth/public/install
    // routes without that shell, dismiss once React painted a non-loading UI.
    const root = document.getElementById('root');
    if (!root) {
      dismissAppBootSplash();
      return;
    }

    const safety = window.setTimeout(() => {
      dismissAppBootSplash();
    }, BOOT_SPLASH_SAFETY_MS);

    const tryDismissNonShell = () => {
      if (document.querySelector('[data-shell-chrome-enter="true"]')) {
        return;
      }
      if (root.querySelector('[data-testid="app-route-loading"][data-variant="fullscreen"]')) {
        // Keep #app-boot-splash on top until fullscreen loading is gone (ShellChromeEnter
        // or public route content). Avoids a second loader look and layout handoff jump.
        return;
      }
      if (root.childElementCount === 0) {
        return;
      }
      scheduleAppBootSplashDismiss();
      window.clearTimeout(safety);
    };

    const observer = new MutationObserver(() => {
      tryDismissNonShell();
    });
    observer.observe(root, { childList: true, subtree: true });
    tryDismissNonShell();

    return () => {
      observer.disconnect();
      window.clearTimeout(safety);
    };
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <CulturePathGuard>
          <PlatformConfigProvider>
          <GridColumnLayoutsProvider>
            <AccentThemeProvider>
              <ViewportTierProvider>
                <AiFieldAssistProvider>
                  <UiToastProvider />
                  <AppToastHost />
                  <UserAccentThemeBridge />
                  <ThemePresetRuntimeBridge />
                  <PlatformAppRoutes />
                  <AppEndooHost />
                  <PageGuideHost />
                </AiFieldAssistProvider>
              </ViewportTierProvider>
            </AccentThemeProvider>
          </GridColumnLayoutsProvider>
        </PlatformConfigProvider>
        </CulturePathGuard>
      </BrowserRouter>
    </AuthProvider>
  );
}
