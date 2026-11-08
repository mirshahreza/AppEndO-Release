import {
  installPackageUiRuntimeGlobals,
  isPackageUiRuntimeReady,
  PACKAGE_UI_INTERNAL_MODULE_SPECIFIERS,
  resetPackageUiRuntimeGlobalsForTests,
  type PackageUiInternalModuleSpecifier,
} from './packageUiRuntimeGlobals';

const PACKAGE_UI_INTERNAL_MODULE_LOADERS: Record<
  PackageUiInternalModuleSpecifier,
  () => Promise<Record<string, unknown>>
> = {
  '@/shared/ui': () => import('../../shared/ui'),
  '@/shared/ui/HeroFieldControls': () => import('../../shared/ui/HeroFieldControls'),
  '@/shared/ui/DesignerFormFields': () => import('../../shared/ui/DesignerFormFields'),
  '@/domain/component-designer/DesignerRuntimeAppTableGrid': () =>
    import('../../domain/component-designer/DesignerRuntimeAppTableGrid'),
  '@/domain/component-designer/designerGridToolbarConfig': () =>
    import('../../domain/component-designer/designerGridToolbarConfig'),
  '@/domain/component-designer/previewFieldValidation': () =>
    import('../../domain/component-designer/previewFieldValidation'),
  '@/app/platform/PlatformMountContext': () => import('../../app/platform/PlatformMountContext'),
  '@/app/platform/PortalContext': () => import('../../app/platform/PortalContext'),
  '@/app/platform/PlatformConfigProvider': () => import('../../app/platform/PlatformConfigProvider'),
  '@/contexts/AuthContext': () => import('../../contexts/AuthContext'),
  '@/contexts/AccentThemeContext': () => import('../../contexts/AccentThemeContext'),
  '@/contexts/GridColumnLayoutsContext': () => import('../../contexts/GridColumnLayoutsContext'),
  '@/shared/lib/useViewportTier': () => import('../../shared/lib/useViewportTier'),
  '@/core/culture/CultureContext': () => import('../../core/culture/CultureContext'),
  '@/layouts/adminShell/ShellHeaderOverrideContext': () => import('../../layouts/adminShell/ShellHeaderOverrideContext'),
  '@/shared/ui/hwy/hwyGeoResponsibilityInlineListDialogApi': () =>
    import('../../shared/ui/hwy/hwyGeoResponsibilityInlineListDialogApi'),
};

let loadPromise: Promise<void> | null = null;

async function loadPackageUiRuntime(): Promise<void> {
  const [React, ReactJSXRuntime, ReactDOM, ReactRouterDOM, HeroUIReact, ReactQuery, ...internalModules] = await Promise.all([
    import('react'),
    import('react/jsx-runtime'),
    import('react-dom'),
    import('react-router-dom'),
    import('@heroui/react'),
    import('@tanstack/react-query'),
    ...PACKAGE_UI_INTERNAL_MODULE_SPECIFIERS.map((specifier) => PACKAGE_UI_INTERNAL_MODULE_LOADERS[specifier]()),
  ]);

  const AppInternalModules: Record<string, Record<string, unknown>> = {};
  PACKAGE_UI_INTERNAL_MODULE_SPECIFIERS.forEach((specifier, index) => {
    AppInternalModules[specifier] = internalModules[index] ?? {};
  });

  installPackageUiRuntimeGlobals({
    React,
    ReactJSXRuntime,
    ReactDOM,
    ReactRouterDOM,
    HeroUIReact,
    ReactQuery,
    AppInternalModules,
  });
}

/**
 * Loads HeroUI + the heavy `@/shared/ui` barrel only when a package page or plugin slot
 * actually needs them. First paint of Studio/Dashboard must not wait on this.
 */
export function ensurePackageUiRuntime(): Promise<void> {
  if (isPackageUiRuntimeReady()) {
    return Promise.resolve();
  }
  if (!loadPromise) {
    loadPromise = loadPackageUiRuntime().catch((error: unknown) => {
      loadPromise = null;
      throw error;
    });
  }
  return loadPromise;
}

export function resetPackageUiRuntimeForTests(): void {
  loadPromise = null;
  resetPackageUiRuntimeGlobalsForTests();
}
