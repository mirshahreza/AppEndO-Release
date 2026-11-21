import React, { Suspense } from 'react';
import type { ExperienceMountRuntimeProvidersBundleProps } from './ExperienceMountRuntimeProvidersBundle';

const ExperienceMountRuntimeProvidersBundle = React.lazy(() =>
  import('./ExperienceMountRuntimeProvidersBundle').then((module) => ({
    default: module.ExperienceMountRuntimeProvidersBundle,
  })),
);

let experienceMountRuntimeProvidersPreload: Promise<unknown> | null = null;

export function preloadExperienceMountRuntimeProviders(): Promise<unknown> {
  if (!experienceMountRuntimeProvidersPreload) {
    experienceMountRuntimeProvidersPreload = import('./ExperienceMountRuntimeProvidersBundle');
  }
  return experienceMountRuntimeProvidersPreload;
}

export function LazyExperienceMountRuntimeProviders(
  props: ExperienceMountRuntimeProvidersBundleProps,
): React.ReactElement {
  return (
    <Suspense fallback={props.children}>
      <ExperienceMountRuntimeProvidersBundle {...props} />
    </Suspense>
  );
}