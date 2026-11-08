/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'guacamole-common-js' {
  type MouseHandler = (state: unknown) => void;

  const Guacamole: {
    Client: new (tunnel: unknown) => {
      connect: (data?: string) => void;
      disconnect: () => void;
      getDisplay: () => { getElement: () => HTMLElement };
      sendMouseState: (state: unknown) => void;
      sendKeyEvent: (pressed: number, keysym: number) => void;
      sendSize: (width: number, height: number) => void;
      createClipboardStream: (mimetype: string) => unknown;
      onclipboard: ((stream: unknown, mimetype: string) => void) | null;
      onerror: ((status: { code?: number; message?: string }) => void) | null;
      onstatechange: ((state: number) => void) | null;
    };
    WebSocketTunnel: new (url: string) => unknown;
    Mouse: new (element: Element) => {
      onmousedown: MouseHandler | null;
      onmouseup: MouseHandler | null;
      onmousemove: MouseHandler | null;
    };
    Keyboard: new (element: Document | Window | Element) => {
      onkeydown: ((keysym: number) => boolean | void) | null;
      onkeyup: ((keysym: number) => boolean | void) | null;
      reset: () => void;
    };
    StringReader: new (stream: unknown) => {
      ontext: ((text: string) => void) | null;
      onend: (() => void) | null;
    };
    StringWriter: new (stream: unknown) => {
      sendText: (text: string) => void;
      sendEnd: () => void;
    };
  };

  export default Guacamole;
}

declare module 'guacamole-lite' {
  const GuacamoleLite: new (
    websocketOptions: Record<string, unknown>,
    guacdOptions: Record<string, unknown>,
    clientOptions: Record<string, unknown>,
    callbacks?: Record<string, unknown>,
  ) => {
    close: () => void;
    on: (event: string, listener: (...args: unknown[]) => void) => void;
    activeConnections?: Map<unknown, unknown>;
  };
  export default GuacamoleLite;
}

declare module '@xterm/xterm' {
  export class Terminal {
    constructor(options?: unknown);
    cols: number;
    rows: number;
    buffer: {
      active: {
        length: number;
        getLine: (index: number) => { translateToString: (trimRight?: boolean) => string } | undefined;
      };
    };
    loadAddon: (addon: unknown) => void;
    open: (element: HTMLElement) => void;
    write: (data: string | Uint8Array) => void;
    writeln: (data: string) => void;
    onData: (cb: (data: string) => void) => { dispose: () => void };
    onResize: (cb: () => void) => { dispose: () => void };
    dispose: () => void;
  }
}

declare module '@xterm/addon-fit' {
  export class FitAddon {
    fit: () => void;
    dispose: () => void;
  }
}

declare module '@xterm/xterm/css/xterm.css' {}

declare module 'basic-ftp' {
  export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 3,
  }

  export type FileInfo = {
    name: string;
    type: FileType;
    size: number;
    permissions?: number | string;
    rawModifiedAt?: string;
    modifiedAt?: Date;
  };

  export class Client {
    constructor(timeout?: number);
    access: (options: {
      host: string;
      port?: number;
      user?: string;
      password?: string;
      secure?: boolean;
    }) => Promise<unknown>;
    close: () => void;
    list: (path?: string) => Promise<FileInfo[]>;
    downloadTo: (destination: NodeJS.WritableStream, fromRemotePath: string) => Promise<unknown>;
    uploadFrom: (source: NodeJS.ReadableStream, toRemotePath: string) => Promise<unknown>;
    ensureDir: (remotePath: string) => Promise<void>;
    remove: (path: string) => Promise<void>;
    removeDir: (path: string) => Promise<void>;
    rename: (from: string, to: string) => Promise<void>;
    cd: (path: string) => Promise<void>;
    pwd: () => Promise<string>;
    size: (path: string) => Promise<number>;
  }
}
