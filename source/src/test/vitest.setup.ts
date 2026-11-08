if (typeof globalThis.CSS === 'undefined') {
  Object.defineProperty(globalThis, 'CSS', {
    configurable: true,
    value: {},
  });
}

if (typeof globalThis.CSS.escape !== 'function') {
  Object.defineProperty(globalThis.CSS, 'escape', {
    configurable: true,
    value: (value: string) => String(value).replace(/["\\]/g, '\\$&'),
  });
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
}
