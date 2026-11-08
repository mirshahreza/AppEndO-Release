import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { compileGeneratedPrismaClientForNode } from '../generatedPrismaClientRuntime';

const ENTRY = path.join(process.cwd(), 'src', 'generated', 'prisma', 'client.ts');

describe('compileGeneratedPrismaClientForNode', () => {
  const outfile = path.join(os.tmpdir(), `appendo-prisma-client-runtime-${process.pid}.mjs`);

  afterEach(() => {
    try {
      if (fs.existsSync(outfile)) fs.unlinkSync(outfile);
    } catch {
      // Best-effort temp cleanup.
    }
  });

  it('bundles client.ts into ESM that Node can import', async () => {
    expect(fs.existsSync(ENTRY)).toBe(true);

    const compiled = compileGeneratedPrismaClientForNode({
      force: true,
      entry: ENTRY,
      outfile,
    });

    expect(compiled).toBe(outfile);
    expect(fs.existsSync(outfile)).toBe(true);
    expect(fs.readFileSync(outfile, 'utf8')).not.toContain('from "./enums.ts"');

    const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
    expect(typeof mod.PrismaClient).toBe('function');
  });

  it('skips rebuild when the runtime module is newer than client.ts', () => {
    compileGeneratedPrismaClientForNode({ force: true, entry: ENTRY, outfile });
    const futureSec = Math.floor(Date.now() / 1000) + 60;
    fs.utimesSync(outfile, futureSec, futureSec);
    const firstMtime = fs.statSync(outfile).mtimeMs;

    compileGeneratedPrismaClientForNode({ entry: ENTRY, outfile });
    expect(fs.statSync(outfile).mtimeMs).toBe(firstMtime);
  });
});
