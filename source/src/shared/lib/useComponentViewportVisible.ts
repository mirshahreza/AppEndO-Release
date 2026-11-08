import { useViewportTier } from './useViewportTier';
import {
  isComponentVisibleAtTier,
  type ComponentViewportVisibility,
} from './viewportVisibility';

export function useComponentViewportVisible(
  visibility: ComponentViewportVisibility = 'always',
): boolean {
  const tier = useViewportTier();
  return isComponentVisibleAtTier(visibility, tier);
}
