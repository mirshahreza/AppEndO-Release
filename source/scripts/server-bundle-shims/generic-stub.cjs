'use strict';

const noop = () => null;
const passthrough = ({ children }) => children ?? null;

const handler = {
  get(_target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return new Proxy({}, handler);
    if (prop === 'create') return () => ({});
    if (prop === 'configure') return () => ({});
    return passthrough;
  },
};

module.exports = new Proxy(noop, handler);
