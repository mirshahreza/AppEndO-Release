import type { Plugin } from 'vite';

/** react-doodle-icons emits `clip-path`; React expects `clipPath`. */
export function fixReactDoodleSvgProps(): Plugin {
  return {
    name: 'fix-react-doodle-svg-props',
    transform(code, id) {
      if (!id.includes('react-doodle-icons') || !code.includes('clip-path')) {
        return null;
      }

      return {
        code: code.replaceAll('"clip-path"', '"clipPath"'),
        map: null,
      };
    },
  };
}
