/** Loaded only when Remote Hubs is not installed. Real @xterm/xterm comes from packages-storage/libs. */

type Disposable = { dispose: () => void };

export class Terminal {
  cols = 80;
  rows = 24;
  buffer = {
    active: {
      length: 0,
      getLine: () => undefined as { translateToString: (trimRight?: boolean) => string } | undefined,
    },
  };

  constructor(_options?: unknown) {}
  loadAddon(_addon: unknown): void {}
  open(_element: HTMLElement): void {}
  write(_data: string | Uint8Array): void {}
  writeln(_data: string): void {}
  onData(_cb: (data: string) => void): Disposable {
    return { dispose() {} };
  }
  onResize(_cb: () => void): Disposable {
    return { dispose() {} };
  }
  dispose(): void {}
}

export default { Terminal };
