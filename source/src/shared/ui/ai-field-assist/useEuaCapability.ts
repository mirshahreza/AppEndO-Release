import { useEffect, useSyncExternalStore } from 'react';
import type { EuaCapabilityKey } from '../../api/contracts/ai/euaFieldAssist';
import {
  ensureEuaStatusLoaded,
  getCachedEuaStatus,
  subscribeEuaStatus,
} from './euaStatusCache';

export function useEuaStatusSnapshot() {
  return useSyncExternalStore(subscribeEuaStatus, getCachedEuaStatus, () => null);
}

/**
 * Temporary default until EUA-14 Settings UI — capabilities mirror field-assist readiness.
 */
export function useIsEuaCapabilityEnabled(capability: EuaCapabilityKey): boolean {
  const status = useEuaStatusSnapshot();

  useEffect(() => {
    void ensureEuaStatusLoaded();
  }, []);

  if (!status) {
    return false;
  }

  return status.capabilities[capability] === true;
}

/** AI globally on + at least one registered chat-capable model. */
export function useEuaFieldAssistReady(): boolean {
  const status = useEuaStatusSnapshot();
  return status?.aiEnabled === true && Boolean(status.defaultModelId);
}

export function useEuaDefaultModelId(): string | undefined {
  const status = useEuaStatusSnapshot();
  return status?.defaultModelId;
}

export function useEuaAssistAvailable(): boolean {
  return useEuaFieldAssistReady();
}
