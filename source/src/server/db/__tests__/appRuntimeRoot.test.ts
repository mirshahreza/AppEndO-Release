import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  prismaSchemaPath,
  resolveAppRuntimeRoot,
  resolveNodeModulesRoot,
} from '../appRuntimeRoot';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe('resolveAppRuntimeRoot', () => {
  it('uses a working directory that already contains the Prisma schema', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-root-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, 'prisma'), { recursive: true });
    fs.writeFileSync(path.join(root, 'prisma', 'schema.prisma'), 'datasource db {}\n');
    expect(resolveAppRuntimeRoot(root)).toBe(root);
    expect(prismaSchemaPath(root)).toBe(path.join(root, 'prisma', 'schema.prisma'));
  });

  it('reads prisma and generated paths from source/ when the snapshot root is the start directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-root-'));
    tempDirs.push(root);
    const source = path.join(root, 'source');
    fs.mkdirSync(path.join(source, 'prisma'), { recursive: true });
    fs.mkdirSync(path.join(source, 'src', 'generated', 'prisma', 'internal'), { recursive: true });
    fs.writeFileSync(path.join(source, 'prisma', 'schema.prisma'), 'datasource db {}\n');
    fs.mkdirSync(path.join(root, 'node_modules', 'prisma'), { recursive: true });
    fs.writeFileSync(path.join(root, 'node_modules', 'prisma', 'package.json'), '{}\n');

    expect(resolveAppRuntimeRoot(root)).toBe(source);
    expect(prismaSchemaPath(root)).toBe(path.join(source, 'prisma', 'schema.prisma'));
    expect(resolveNodeModulesRoot(root)).toBe(root);
    expect(resolveNodeModulesRoot(source)).toBe(root);
  });
});
