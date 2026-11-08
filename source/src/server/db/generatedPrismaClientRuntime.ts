import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

export const GENERATED_PRISMA_CLIENT_ENTRY = (): string => (
  path.join(process.cwd(), 'src', 'generated', 'prisma', 'client.ts')
);

export const GENERATED_PRISMA_CLIENT_RUNTIME = (): string => (
  path.join(process.cwd(), 'src', 'generated', 'prisma', 'client.runtime.mjs')
);

type CompileOptions = {
  /** After `prisma generate`, always rewrite the Node runtime module. */
  force?: boolean;
  entry?: string;
  outfile?: string;
};

/**
 * Prisma 7 emits TypeScript (`client.ts`). Production `node dist/server.cjs` cannot import `.ts`.
 * Bundle a Node-loadable ESM next to the generated client.
 */
export const compileGeneratedPrismaClientForNode = (options: CompileOptions = {}): string => {
  const entry = options.entry ?? GENERATED_PRISMA_CLIENT_ENTRY();
  const outfile = options.outfile ?? GENERATED_PRISMA_CLIENT_RUNTIME();

  if (!fs.existsSync(entry)) {
    throw new Error(`Prisma client is missing (${entry}). Run: npm run prisma:generate`);
  }

  const stale = options.force === true
    || !fs.existsSync(outfile)
    || fs.statSync(entry).mtimeMs > fs.statSync(outfile).mtimeMs;

  if (stale) {
    fs.mkdirSync(path.dirname(outfile), { recursive: true });
    esbuild.buildSync({
      absWorkingDir: process.cwd(),
      entryPoints: [entry],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
      logLevel: 'silent',
    });
  }

  return outfile;
};
