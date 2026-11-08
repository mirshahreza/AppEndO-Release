/** Vite's default HMR WebSocket port when `server.hmr.port` is unset or zero. */
export const VITE_DEFAULT_HMR_PORT = 24678;

export const resolvePreferredHmrPort = (serverPort: number, configuredHmrPort: number): number => {
  if (Number.isFinite(configuredHmrPort) && configuredHmrPort > 0) {
    return configuredHmrPort;
  }
  return serverPort + 100;
};
