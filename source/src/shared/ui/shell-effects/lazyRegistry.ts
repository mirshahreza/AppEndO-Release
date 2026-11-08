import type { ComponentType } from 'react';
import { SHELL_EFFECT_CATALOG } from './catalog';
import type {
  ShellEffectFallback,
  ShellEffectId,
  ShellEffectRendererProps,
  ShellViewport,
} from './types';

export type ShellEffectRuntimePlan = {
  effectId: ShellEffectId;
  lazy: boolean;
  fallback: Exclude<ShellEffectFallback, 'runtime'>;
};

export function getShellEffectRuntimePlan(
  effectId: ShellEffectId,
  viewport: ShellViewport,
): ShellEffectRuntimePlan {
  const meta = SHELL_EFFECT_CATALOG[effectId];
  return {
    effectId,
    lazy: meta.loadRule !== 'base',
    fallback:
      viewport === 'phone' && meta.costTier === 'high'
        ? 'static'
        : meta.fallbackRenderer,
  };
}

export async function loadShellEffectRenderer(
  effectId: ShellEffectId,
): Promise<ComponentType<ShellEffectRendererProps>> {
  const module = await import('./renderers');
  return module.SHELL_EFFECT_RENDERERS[effectId];
}
