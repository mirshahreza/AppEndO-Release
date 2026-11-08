import type * as React from 'react';
import type * as ReactJSXRuntime from 'react/jsx-runtime';
import type * as ReactDOM from 'react-dom';
import type * as ReactRouterDOM from 'react-router-dom';
import type * as HeroUIReact from '@heroui/react';
import type * as ReactQuery from '@tanstack/react-query';

export const PACKAGE_UI_INTERNAL_MODULE_SPECIFIERS = [
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
  '@/shared/ui/hwy/hwyGeoResponsibilityInlineListDialogApi',
] as const;

export type PackageUiInternalModuleSpecifier = (typeof PACKAGE_UI_INTERNAL_MODULE_SPECIFIERS)[number];

export type PackageUiRuntimeGlobals = {
  React: typeof React;
  ReactJSXRuntime: typeof ReactJSXRuntime;
  ReactRouterDOM: typeof ReactRouterDOM;
  /**
   * The host app's own `react-dom` — package pages that call `createPortal` (Remote Hubs new-tab
   * menus, AppSplitButton) must share this instance. Bundling a second copy next to the host
   * renderer throws invalid-hook / mismatched-renderer errors on every hub page.
   */
  ReactDOM?: typeof ReactDOM;
  /** Present after `ensurePackageUiRuntime()` — not on first paint. */
  HeroUIReact?: typeof HeroUIReact;
  /**
   * The host app's own `@tanstack/react-query` instance — sharing it (rather than letting each
   * package UI bundle pull in its own copy) is what makes `useQuery()`/`useQueryClient()` inside
   * a package page see the host's `<QueryClientProvider>`. Two separate module instances mean two
   * separate `QueryClientContext` objects, so `useQueryClient()` always throws "No QueryClient
   * set" even though the component renders inside the real provider tree.
   */
  ReactQuery?: typeof ReactQuery;
  /**
   * Keyed by import specifier (e.g. `@/shared/ui`) — internal app modules a package UI page can
   * import without paying to re-bundle them (some transitively pull in mermaid/tiptap/prosemirror
   * /the TS compiler and blow up to 50+MB per page). Add an entry here, a loader in
   * `ensurePackageUiRuntime.ts`, and the matching export names in
   * `packageUiModuleCompile.service.ts` when a future package needs another module from this bucket.
   */
  AppInternalModules: Record<string, Record<string, unknown>>;
};

declare global {
  // eslint-disable-next-line no-var
  var __APPENDO_PACKAGE_RUNTIME__: PackageUiRuntimeGlobals | undefined;
}

export function installPackageUiRuntimeGlobals(globals: PackageUiRuntimeGlobals): void {
  const current = globalThis.__APPENDO_PACKAGE_RUNTIME__;
  globalThis.__APPENDO_PACKAGE_RUNTIME__ = {
    React: globals.React,
    ReactJSXRuntime: globals.ReactJSXRuntime,
    ReactRouterDOM: globals.ReactRouterDOM,
    ReactDOM: globals.ReactDOM ?? current?.ReactDOM,
    HeroUIReact: globals.HeroUIReact ?? current?.HeroUIReact,
    ReactQuery: globals.ReactQuery ?? current?.ReactQuery,
    AppInternalModules: {
      ...current?.AppInternalModules,
      ...globals.AppInternalModules,
    },
  };
}

export function isPackageUiRuntimeReady(): boolean {
  const runtime = globalThis.__APPENDO_PACKAGE_RUNTIME__;
  return Boolean(
    runtime?.HeroUIReact
    && runtime.ReactDOM
    && runtime.AppInternalModules?.['@/shared/ui'],
  );
}

export function resetPackageUiRuntimeGlobalsForTests(): void {
  globalThis.__APPENDO_PACKAGE_RUNTIME__ = undefined;
}
