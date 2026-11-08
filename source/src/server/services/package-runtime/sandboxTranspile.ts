import { transform } from 'esbuild';

/**
 * Transpiles a package-authored TS/TSX/JS source string into CJS for execution inside
 * the vm.Script sandbox. Shared by request-time API handlers (packageApiRuntime.service)
 * and one-time install hooks (packageInstallHookRuntime.service) so both stay on the
 * exact same esbuild/vm wiring.
 */
export const transpileSandboxSource = async (source: string, entry: string): Promise<string> => {
  const shouldTranspile = entry.endsWith('.ts')
    || entry.endsWith('.tsx')
    || /\bexport\b/.test(source)
    || /\bimport\b/.test(source);
  if (!shouldTranspile) {
    return source;
  }
  const loader = entry.endsWith('.tsx') ? 'tsx' : 'ts';
  const result = await transform(source, {
    loader,
    format: 'cjs',
    target: 'node20',
    sourcemap: false,
    legalComments: 'none',
  });
  return result.code;
};
