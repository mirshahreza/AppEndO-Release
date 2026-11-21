import { useMemo } from 'react';

import type { AppRouteLoadingVariant } from '../../components/AppRouteLoading';
import { DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG } from '../api/contracts/routeLoading/constants';
import {
  normalizePlatformRouteLoadingConfig,
  resolveEffectiveRouteLoadingExperience,
} from '../api/contracts/routeLoading/normalizers';
import type {
  EffectiveRouteLoadingExperience,
  PlatformRouteLoadingConfig,
} from '../api/contracts/routeLoading/schema';
import { useAppBootQuery } from '../api/queries/boot';

function isEffectiveRouteLoadingExperience(
  value: PlatformRouteLoadingConfig | EffectiveRouteLoadingExperience,
): value is EffectiveRouteLoadingExperience {
  return !('version' in value);
}

export function useRouteLoadingExperience(
  variant: AppRouteLoadingVariant,
  override?: PlatformRouteLoadingConfig | EffectiveRouteLoadingExperience | null,
): EffectiveRouteLoadingExperience {
  const bootQuery = useAppBootQuery();

  return useMemo(() => {
    if (override && isEffectiveRouteLoadingExperience(override)) {
      return override;
    }

    const config = normalizePlatformRouteLoadingConfig(
      override ?? bootQuery.data?.routeLoading ?? DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG,
    );
    return resolveEffectiveRouteLoadingExperience(config, variant);
  }, [bootQuery.data?.routeLoading, override, variant]);
}