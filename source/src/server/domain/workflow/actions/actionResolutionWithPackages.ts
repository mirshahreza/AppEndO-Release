import {
  getActionDefinition as getCoreActionDefinition,
  resolveExactProvider as resolveCoreExactProvider,
  resolveCapabilityProvider as resolveCoreCapabilityProvider,
  type CapabilityResolutionResult,
} from './registry';
import { computeActionDefinitionFingerprint } from './fingerprint';
import { resolvePackageActionDefinition, resolvePackageActionProvider } from './packageActionRegistry';
import type { ActionDefinition, ActionProviderRegistration } from './types';

/**
 * p-99/WFT-1 — the deferred half of the package-Action wiring: composes `registry.ts`'s CORE/
 * PLATFORM lookup (a "doc04 §3... sole authority" frozen contract, left completely untouched) with
 * the live package Action index (`packageActionRegistry.ts`), so publish-time validation
 * (`actionResolutionValidation.ts`) and execution-time dispatch (`attemptService.ts`) both see the
 * same universe of resolvable Actions. Package Actions are consulted ONLY when the CORE/PLATFORM
 * registry has nothing for the exact key/version — the two namespaces are never merged or ranked
 * against each other; a package can never shadow a CORE/PLATFORM Action.
 *
 * Both call sites import these three functions under the SAME names `registry.ts` exports
 * (`getActionDefinition`/`resolveExactProvider`/`resolveCapabilityProvider`) via an import alias —
 * so this wiring is a one-line import-path change in each frozen-contract file, not a body edit.
 */

export type ResolvedActionDefinitionEntry = { definition: ActionDefinition; fingerprint: string };

export function getActionDefinitionWithPackages(key: string, version: string): ResolvedActionDefinitionEntry | undefined {
  const core = getCoreActionDefinition(key, version);
  if (core) return core;
  const definition = resolvePackageActionDefinition(key, version);
  if (!definition) return undefined;
  return { definition, fingerprint: computeActionDefinitionFingerprint(definition) };
}

export function resolveExactProviderWithPackages(
  actionKey: string,
  actionVersion: string,
  providerId: string,
  providerVersion: string,
): ActionProviderRegistration {
  try {
    return resolveCoreExactProvider(actionKey, actionVersion, providerId, providerVersion);
  } catch (error) {
    const provider = resolvePackageActionProvider(actionKey, actionVersion);
    if (provider && provider.providerId === providerId && provider.providerVersion === providerVersion) {
      return provider;
    }
    throw error;
  }
}

export function resolveCapabilityProviderWithPackages(
  actionKey: string,
  actionVersion: string,
  requiredCapabilities: readonly string[],
  isAuthorized: (provider: ActionProviderRegistration) => boolean,
): CapabilityResolutionResult {
  try {
    return resolveCoreCapabilityProvider(actionKey, actionVersion, requiredCapabilities, isAuthorized);
  } catch (error) {
    const provider = resolvePackageActionProvider(actionKey, actionVersion);
    if (provider && requiredCapabilities.every((c) => provider.providesCapabilities.includes(c)) && isAuthorized(provider)) {
      return { winner: provider, rejectedHigherRanked: [] };
    }
    throw error;
  }
}
