import { afterEach, describe, expect, it } from 'vitest';
import * as React from 'react';
import * as ReactJSXRuntime from 'react/jsx-runtime';
import * as ReactRouterDOM from 'react-router-dom';
import {
  installPackageUiRuntimeGlobals,
  isPackageUiRuntimeReady,
  PACKAGE_UI_INTERNAL_MODULE_SPECIFIERS,
  resetPackageUiRuntimeGlobalsForTests,
} from '../packageUiRuntimeGlobals';

describe('packageUiRuntimeGlobals', () => {
  afterEach(() => {
    resetPackageUiRuntimeGlobalsForTests();
  });

  it('is not ready until HeroUI, react-dom, and the shared UI barrel are installed', () => {
    expect(isPackageUiRuntimeReady()).toBe(false);

    installPackageUiRuntimeGlobals({
      React,
      ReactJSXRuntime,
      ReactRouterDOM,
      AppInternalModules: {},
    });
    expect(isPackageUiRuntimeReady()).toBe(false);

    installPackageUiRuntimeGlobals({
      React,
      ReactJSXRuntime,
      ReactRouterDOM,
      ReactDOM: { createPortal: () => null } as never,
      HeroUIReact: { Button: () => null } as never,
      AppInternalModules: {
        '@/shared/ui': { AppButton: () => null },
      },
    });
    expect(isPackageUiRuntimeReady()).toBe(true);
  });

  it('merges AppInternalModules instead of replacing them', () => {
    installPackageUiRuntimeGlobals({
      React,
      ReactJSXRuntime,
      ReactRouterDOM,
      AppInternalModules: {
        '@/shared/ui': { AppButton: () => null },
      },
    });
    installPackageUiRuntimeGlobals({
      React,
      ReactJSXRuntime,
      ReactRouterDOM,
      HeroUIReact: { Button: () => null } as never,
      AppInternalModules: {
        '@/shared/ui/HeroFieldControls': { UiInput: () => null },
      },
    });

    expect(globalThis.__APPENDO_PACKAGE_RUNTIME__?.AppInternalModules?.['@/shared/ui']).toBeTruthy();
    expect(globalThis.__APPENDO_PACKAGE_RUNTIME__?.AppInternalModules?.['@/shared/ui/HeroFieldControls']).toBeTruthy();
  });

  it('keeps ReactDOM once installed, even after a later call omits it', () => {
    const ReactDOM = { createPortal: () => null } as never;

    installPackageUiRuntimeGlobals({
      React,
      ReactJSXRuntime,
      ReactRouterDOM,
      ReactDOM,
      AppInternalModules: {},
    });
    expect(globalThis.__APPENDO_PACKAGE_RUNTIME__?.ReactDOM).toBe(ReactDOM);

    installPackageUiRuntimeGlobals({
      React,
      ReactJSXRuntime,
      ReactRouterDOM,
      AppInternalModules: {},
    });
    expect(globalThis.__APPENDO_PACKAGE_RUNTIME__?.ReactDOM).toBe(ReactDOM);
  });

  it('keeps ReactQuery once installed, even after a later call omits it', () => {
    const ReactQuery = { useQuery: () => null, useQueryClient: () => null } as never;

    installPackageUiRuntimeGlobals({
      React,
      ReactJSXRuntime,
      ReactRouterDOM,
      ReactQuery,
      AppInternalModules: {},
    });
    expect(globalThis.__APPENDO_PACKAGE_RUNTIME__?.ReactQuery).toBe(ReactQuery);

    installPackageUiRuntimeGlobals({
      React,
      ReactJSXRuntime,
      ReactRouterDOM,
      AppInternalModules: {},
    });
    expect(globalThis.__APPENDO_PACKAGE_RUNTIME__?.ReactQuery).toBe(ReactQuery);
  });

  it('lists the host-internal specifiers package UI compile must shim', () => {
    expect([...PACKAGE_UI_INTERNAL_MODULE_SPECIFIERS]).toEqual([
      '@/shared/ui',
      '@/shared/ui/HeroFieldControls',
      '@/shared/ui/DesignerFormFields',
      '@/domain/component-designer/DesignerRuntimeAppTableGrid',
      '@/domain/component-designer/designerGridToolbarConfig',
      '@/domain/component-designer/previewFieldValidation',
      '@/app/platform/PlatformMountContext',
      '@/app/platform/PortalContext',
      '@/app/platform/PlatformConfigProvider',
      '@/contexts/AuthContext',
      '@/contexts/AccentThemeContext',
      '@/contexts/GridColumnLayoutsContext',
      '@/shared/lib/useViewportTier',
      '@/core/culture/CultureContext',
      '@/layouts/adminShell/ShellHeaderOverrideContext',
    ]);
  });
});
