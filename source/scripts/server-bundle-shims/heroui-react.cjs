'use strict';

/**
 * Server production bundle must not render HeroUI. Local designer/runtime TSX is bundled for
 * codegen paths; real `@heroui/react` is ESM-only. Package UI compile loads the real module
 * via dynamic `import()` in a separate esbuild context (packageUiModuleCompile.service).
 */
const noop = () => null;
const passthrough = ({ children }) => children ?? null;

const handler = {
  get(_target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return new Proxy({}, handler);
    if (prop === 'toast') {
      return { show: noop, success: noop, danger: noop, warning: noop };
    }
    return passthrough;
  },
};

module.exports = new Proxy(noop, handler);
