import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'esbuild';

const IMPORT_META_URL = 'import.meta.url';
const IMPORT_META_DIRNAME = 'import.meta.dirname';
const IMPORT_META_FILENAME = 'import.meta.filename';

const loaderFor = (filePath: string): 'ts' | 'tsx' | 'js' | 'jsx' => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.mtsx')) return 'tsx';
  if (filePath.endsWith('.jsx')) return 'jsx';
  if (filePath.endsWith('.ts') || filePath.endsWith('.mts') || filePath.endsWith('.cts')) return 'ts';
  return 'js';
};

/**
 * CJS bundles have no real `import.meta`. esbuild replaces `import.meta.url` with `""`,
 * and `fileURLToPath("")` throws while the module is still evaluating — that kills
 * `node dist/server.cjs` before listen. Rewrite each source file's meta to the original
 * path relative to the process working directory (the repo / release source root), so
 * sibling SQL and seed folders keep resolving after the files are concatenated.
 */
export const createBundledImportMetaPlugin = (): Plugin => ({
  name: 'bundled-import-meta',
  setup(build) {
    build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args) => {
      if (args.path.includes(`${path.sep}node_modules${path.sep}`)) {
        return undefined;
      }

      let contents: string;
      try {
        contents = await fs.promises.readFile(args.path, 'utf8');
      } catch {
        return undefined;
      }

      const needsRewrite = contents.includes(IMPORT_META_URL)
        || contents.includes(IMPORT_META_DIRNAME)
        || contents.includes(IMPORT_META_FILENAME);
      if (!needsRewrite) {
        return undefined;
      }

      const relativePath = path.relative(process.cwd(), args.path).split(path.sep).join('/');
      const fileExpr = `require("node:path").resolve(process.cwd(), ${JSON.stringify(relativePath)})`;
      const urlExpr = `require("node:url").pathToFileURL(${fileExpr}).href`;
      const dirExpr = `require("node:path").dirname(${fileExpr})`;

      contents = contents.split(IMPORT_META_FILENAME).join(fileExpr);
      contents = contents.split(IMPORT_META_DIRNAME).join(dirExpr);
      contents = contents.split(IMPORT_META_URL).join(urlExpr);

      return { contents, loader: loaderFor(args.path) };
    });
  },
});
