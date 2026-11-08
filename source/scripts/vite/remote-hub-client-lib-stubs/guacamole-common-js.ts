/** Loaded only when Remote Hubs is not installed. Real guacamole-common-js comes from packages-storage/libs. */

type MouseHandler = ((state: unknown) => void) | null;

const Guacamole = {
  Client: class {
    connect(_data?: string): void {}
    disconnect(): void {}
    getDisplay(): { getElement: () => HTMLElement } {
      return { getElement: () => document.createElement('div') };
    }
    sendMouseState(_state: unknown): void {}
    sendKeyEvent(_pressed: number, _keysym: number): void {}
    sendSize(_width: number, _height: number): void {}
    createClipboardStream(_mimetype: string): unknown {
      return {};
    }
    onclipboard: ((stream: unknown, mimetype: string) => void) | null = null;
    onerror: ((status: { code?: number; message?: string }) => void) | null = null;
    onstatechange: ((state: number) => void) | null = null;
  },
  WebSocketTunnel: class {
    constructor(_url: string) {}
  },
  Mouse: class {
    onmousedown: MouseHandler = null;
    onmouseup: MouseHandler = null;
    onmousemove: MouseHandler = null;
    constructor(_element: Element) {}
  },
  Keyboard: class {
    onkeydown: ((keysym: number) => boolean | void) | null = null;
    onkeyup: ((keysym: number) => boolean | void) | null = null;
    reset(): void {}
    constructor(_element: Document | Window | Element) {}
  },
  StringReader: class {
    ontext: ((text: string) => void) | null = null;
    onend: (() => void) | null = null;
    constructor(_stream: unknown) {}
  },
  StringWriter: class {
    constructor(_stream: unknown) {}
    sendText(_text: string): void {}
    sendEnd(): void {}
  },
};

export default Guacamole;
