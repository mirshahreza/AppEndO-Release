import React from 'react';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import { ensurePackageUiRuntime } from '../../core/packages/ensurePackageUiRuntime';
import { parsePackagePageLoaderRef, buildPackageUiModuleUrl } from '../../shared/api/contracts/package-manifest/extensionUiRoutes';
import { importPackageUiModule } from '../../shared/packages/importPackageUiModule';
import { resolvePackageUiModuleExport } from '../../shared/packages/packageUiModuleExport';
import { useComponentUsageHitOnce } from '../../shared/lib/useComponentUsageHitOnce';
import { usePlatformConfig } from './PlatformConfigProvider';

type PackagePageModuleProps = {
  loaderRef: string;
  /** Chrome slots fail closed instead of showing a page-level error. */
  fallback?: 'page' | 'silent';
};

type PluginPageComponent = React.ComponentType<Record<string, never>>;

const moduleCache = new Map<string, Promise<PluginPageComponent | null>>();

async function loadPackagePageModule(moduleUrl: string): Promise<PluginPageComponent | null> {
  try {
    await ensurePackageUiRuntime();
    const module = await importPackageUiModule(moduleUrl);
    const Component = resolvePackageUiModuleExport(module as Record<string, unknown>);
    if (typeof Component !== 'function') {
      return null;
    }
    return Component as PluginPageComponent;
  } catch (error) {
    console.error(`Failed to load package page module ${moduleUrl}`, error);
    return null;
  }
}

function getPackagePageModule(moduleUrl: string): Promise<PluginPageComponent | null> {
  const cached = moduleCache.get(moduleUrl);
  if (cached) return cached;

  const pending = loadPackagePageModule(moduleUrl).then((component) => {
    if (!component) {
      moduleCache.delete(moduleUrl);
    }
    return component;
  });
  moduleCache.set(moduleUrl, pending);
  return pending;
}

export const PackagePageModule: React.FC<PackagePageModuleProps> = ({ loaderRef, fallback = 'page' }) => {
  const { version: platformRuntimeVersion } = usePlatformConfig();
  const parsed = parsePackagePageLoaderRef(loaderRef);
  const moduleUrl = parsed
    ? buildPackageUiModuleUrl(parsed.packageId, parsed.pageKey, platformRuntimeVersion)
    : null;
  const [PageComponent, setPageComponent] = React.useState<PluginPageComponent | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!moduleUrl) {
      setFailed(true);
      setPageComponent(null);
      return;
    }

    let cancelled = false;
    setFailed(false);
    setPageComponent(null);

    void getPackagePageModule(moduleUrl).then((component) => {
      if (cancelled) return;
      if (!component) {
        setFailed(true);
        return;
      }
      setPageComponent(() => component);
    });

    return () => {
      cancelled = true;
    };
  }, [moduleUrl]);

  useComponentUsageHitOnce(
    parsed ? `${parsed.packageId}:${parsed.pageKey}` : '',
    parsed?.pageKey ?? '',
    'package',
    Boolean(PageComponent && parsed && !failed),
  );

  if (!parsed || failed) {
    if (fallback === 'silent') {
      return null;
    }
    return (
      <div className="flex min-h-[240px] items-center justify-center p-6">
        <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
          Package page <span className="font-semibold">{loaderRef}</span> is not available.
        </div>
      </div>
    );
  }

  if (!PageComponent) {
    if (fallback === 'silent') {
      return null;
    }
    return <AppRouteLoading />;
  }

  return <PageComponent />;
};
