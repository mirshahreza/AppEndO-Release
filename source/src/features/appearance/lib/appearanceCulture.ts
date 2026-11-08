import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import type { TranslationFn } from '../../../core/culture/TranslationRuntime';

export function appearanceKey(suffix: string): string {
  return `appearance.${suffix}`;
}

export function appearanceLabel(
  t: TranslationFn | undefined,
  suffix: string,
  fallback: string,
): string {
  return resolveCultureLabel(t, appearanceKey(suffix), fallback);
}
