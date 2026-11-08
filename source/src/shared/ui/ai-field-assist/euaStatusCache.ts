import type { EuaStatusResponse } from '../../api/contracts/ai/euaFieldAssist';
import { buildDefaultEuaCapabilities } from '../../api/contracts/ai/euaFieldAssist';
import { fetchEuaStatus } from '../../api/queries/euaFieldAssist';

type EuaStatusListener = () => void;

let cachedStatus: EuaStatusResponse | null = null;
let inflight: Promise<EuaStatusResponse | null> | null = null;
const listeners = new Set<EuaStatusListener>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export function getCachedEuaStatus(): EuaStatusResponse | null {
  return cachedStatus;
}

export function subscribeEuaStatus(listener: EuaStatusListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function ensureEuaStatusLoaded(): Promise<EuaStatusResponse | null> {
  if (cachedStatus) {
    return cachedStatus;
  }

  if (!inflight) {
    inflight = fetchEuaStatus()
      .then((status) => {
        cachedStatus = status;
        notify();
        return status;
      })
      .catch(() => {
        cachedStatus = {
          success: true,
          aiEnabled: false,
          capabilities: buildDefaultEuaCapabilities(false),
        };
        notify();
        return cachedStatus;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export function resetEuaStatusCacheForTests(): void {
  cachedStatus = null;
  inflight = null;
  notify();
}
