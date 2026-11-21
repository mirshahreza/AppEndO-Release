import React, { Suspense } from 'react';
import type { StudioShellFeatureProvidersBundleProps } from './StudioShellFeatureProvidersBundle';

const StudioShellFeatureProvidersBundle = React.lazy(() =>
  import('./StudioShellFeatureProvidersBundle').then((module) => ({
    default: module.StudioShellFeatureProvidersBundle,
  })),
);

let studioShellFeatureProvidersPreload: Promise<unknown> | null = null;

/** Overlap download with boot / shell chunk load so Suspense rarely blocks chrome. */
export function preloadStudioShellFeatureProviders(): Promise<unknown> {
  if (!studioShellFeatureProvidersPreload) {
    studioShellFeatureProvidersPreload = import('./StudioShellFeatureProvidersBundle');
  }
  return studioShellFeatureProvidersPreload;
}

export function LazyStudioShellFeatureProviders(
  props: StudioShellFeatureProvidersBundleProps,
): React.ReactElement {
  return (
    <Suspense fallback={props.children}>
      <StudioShellFeatureProvidersBundle {...props} />
    </Suspense>
  );
}