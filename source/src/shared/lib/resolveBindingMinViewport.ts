import type { PlatformRouteBinding } from '../../shared/api/contracts/platform/types';
import {
  tierMeetsMinViewport,
  type MinViewport,
  type ViewportTier,
} from './viewportTokens';

export function resolveBindingMinViewport(binding: PlatformRouteBinding): MinViewport | undefined {
  return binding.nav?.minViewport;
}

export function isBindingAllowedForViewport(
  binding: PlatformRouteBinding,
  tier: ViewportTier,
): boolean {
  return tierMeetsMinViewport(tier, resolveBindingMinViewport(binding));
}
