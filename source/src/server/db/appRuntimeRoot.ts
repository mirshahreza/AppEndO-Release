import fs from 'node:fs';
import path from 'node:path';

const PRISMA_SCHEMA_REL = path.join('prisma', 'schema.prisma');

export function directoryHasPrismaSchema(dir: string): boolean {
  return fs.existsSync(path.join(dir, PRISMA_SCHEMA_REL));
}

/**
 * Directory that holds `prisma/schema.prisma` and `src/generated`.
 * Dev and `source/` use the process working directory. A deploy snapshot keeps
 * those files under `source/` while `node dist/server.cjs` runs from the snapshot root.
 */
export function resolveAppRuntimeRoot(start: string = process.cwd()): string {
  const resolved = path.resolve(start);
  const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
  const scriptDir = scriptPath ? path.dirname(scriptPath) : '';
  const scriptParent = scriptDir ? path.dirname(scriptDir) : '';
  const candidates = [
    resolved,
    path.join(resolved, 'source'),
    scriptParent,
    scriptParent ? path.join(scriptParent, 'source') : '',
    scriptDir,
    scriptDir ? path.join(scriptDir, 'source') : '',
  ].filter((dir): dir is string => Boolean(dir));

  for (const dir of candidates) {
    if (directoryHasPrismaSchema(dir)) return dir;
  }
  return resolved;
}

/** Directory whose `node_modules` can run the Prisma CLI. Snapshot installs live next to `dist/`, not under `source/`. */
export function resolveNodeModulesRoot(start: string = process.cwd()): string {
  const runtimeRoot = resolveAppRuntimeRoot(start);
  const candidates = [
    path.resolve(start),
    runtimeRoot,
    path.dirname(runtimeRoot),
    path.resolve(start, '..'),
  ];
  for (const dir of candidates) {
    if (
      fs.existsSync(path.join(dir, 'node_modules', 'prisma', 'package.json'))
      || fs.existsSync(path.join(dir, 'node_modules', '.bin', 'prisma'))
    ) {
      return dir;
    }
  }
  return path.resolve(start);
}

export function prismaSchemaPath(start?: string): string {
  return path.join(resolveAppRuntimeRoot(start), PRISMA_SCHEMA_REL);
}

export function generatedPrismaClassPath(start?: string): string {
  return path.join(resolveAppRuntimeRoot(start), 'src', 'generated', 'prisma', 'internal', 'class.ts');
}

export function generatedPrismaClientEntryPath(start?: string): string {
  return path.join(resolveAppRuntimeRoot(start), 'src', 'generated', 'prisma', 'client.ts');
}

export function generatedPrismaClientRuntimePath(start?: string): string {
  return path.join(resolveAppRuntimeRoot(start), 'src', 'generated', 'prisma', 'client.runtime.mjs');
}

export function generatedPrismaOutputDir(start?: string): string {
  return path.join(resolveAppRuntimeRoot(start), 'src', 'generated', 'prisma');
}

export function sqlServerUnicodeUpgradeScriptPath(start?: string): string {
  return path.join(resolveAppRuntimeRoot(start), 'scripts', 'sqlserver-unicode-upgrade.ts');
}
