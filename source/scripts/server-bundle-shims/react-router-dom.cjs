'use strict';

/** ESM-only peer — stub for server bundle; real router runs in the browser / package compile child. */
const noop = () => null;

const handler = {
  get(_target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return new Proxy({}, handler);
    return noop;
  },
};

module.exports = new Proxy(noop, handler);
