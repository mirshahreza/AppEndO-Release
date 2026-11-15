/**
 * Fixed local dev API ports — one slot per deploy line so operators are not lost in 3000–3025 scans.
 * Vite child = api + 200; default HMR ws target = api + 100 (runtime.hmrPort when unset).
 */
export const OPERATOR_DEV_API_PORTS = {
  monorepo: 3000,
  releaseOss: 3100,
  vertical: 3200,
} as const;

export type OperatorDevLineId = keyof typeof OPERATOR_DEV_API_PORTS;

export const OPERATOR_DEV_LINE_LABELS: Record<OperatorDevLineId, string> = {
  monorepo: 'Dev (monorepo AppEndO)',
  releaseOss: 'Release OSS (AppEndO-Release)',
  vertical: 'Vertical (AppEndO-Vertical)',
};

export const VITE_CHILD_PORT_OFFSET = 200;
export const DEFAULT_HMR_PORT_OFFSET = 100;

export const isOperatorDevPortStrict = (): boolean => {
  const raw = process.env.APPENDO_DEV_PORT_STRICT?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') {
    return false;
  }
  return true;
};

export const portsForOperatorDevApi = (
  apiPort: number,
  configuredHmrPort?: number,
): { api: number; hmr: number; viteChild: number } => {
  const hmr = Number.isFinite(configuredHmrPort) && (configuredHmrPort ?? 0) > 0
    ? Number(configuredHmrPort)
    : apiPort + DEFAULT_HMR_PORT_OFFSET;
  return {
    api: apiPort,
    hmr,
    viteChild: apiPort + VITE_CHILD_PORT_OFFSET,
  };
};

/** Ports that belong to one dev line (kill + bind targets when strict). */
export const collectStrictDevLinePorts = (
  apiPort: number,
  configuredHmrPort?: number,
): number[] => {
  const { api, hmr, viteChild } = portsForOperatorDevApi(apiPort, configuredHmrPort);
  return [api, hmr, viteChild];
};
