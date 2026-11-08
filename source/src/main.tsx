import '@vitejs/plugin-react/preamble';
import {StrictMode} from 'react';
import * as React from 'react';
import * as ReactJSXRuntime from 'react/jsx-runtime';
import * as ReactRouterDOM from 'react-router-dom';
import {createRoot} from 'react-dom/client';
import { installPackageUiRuntimeGlobals } from './core/packages/packageUiRuntimeGlobals';
import {QueryClientProvider} from '@tanstack/react-query';
import App from './App.tsx';
import {GlobalApiErrorToast} from './shared/api/GlobalApiErrorToast';
import {queryClient} from './shared/api/queryClient';
import './index.css';
import { bootstrapAccentTheme } from './contexts/AccentThemeContext';
import { PwaManager } from './components/PwaManager';

bootstrapAccentTheme();
installPackageUiRuntimeGlobals({
  React, ReactJSXRuntime, ReactRouterDOM,
  AppInternalModules: {},
});

const setupGlobalScrollActivityState = (): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  let clearTimer: number | undefined;

  const markScrolling = (): void => {
    document.documentElement.classList.add('is-scrolling');
    if (clearTimer !== undefined) {
      window.clearTimeout(clearTimer);
    }
    clearTimer = window.setTimeout(() => {
      document.documentElement.classList.remove('is-scrolling');
      clearTimer = undefined;
    }, 180);
  };

  window.addEventListener('scroll', markScrolling, { capture: true, passive: true });
  window.addEventListener('wheel', markScrolling, { passive: true });
  window.addEventListener('touchmove', markScrolling, { passive: true });
};

setupGlobalScrollActivityState();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <GlobalApiErrorToast />
      <PwaManager />
    </QueryClientProvider>
  </StrictMode>,
);
