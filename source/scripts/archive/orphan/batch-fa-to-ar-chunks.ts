/**
 * Batch-translate fa-designer-chunk2/3/4 to ar-designer-chunk2/3/4 (one API call per file).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from '@vitalets/google-translate-api';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'designer-locale-data');
const PLACEHOLDER_RE = /\{[^}]+\}/g;

function protect(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = text.replace(PLACEHOLDER_RE, (m) => {
    const t = `__PH_${tokens.length}__`;
    tokens.push(m);
    return t;
  });
  return { masked, tokens };
}

function restore(text: string, tokens: string[]): string {
  let out = text;
  tokens.forEach((t, i) => {
    out = out.replaceAll(`__PH_${i}__`, t);
  });
  return out;
}

async function convertChunk(num: 2 | 3 | 4): Promise<void> {
  const faPath = path.join(dir, `fa-designer-chunk${num}.json`);
  const fa = JSON.parse(fs.readFileSync(faPath, 'utf8')) as Record<string, string>;
  const keys = Object.keys(fa);
  const protectedRows = keys.map((k) => protect(fa[k]!));
  const joined = protectedRows.map((r) => r.masked).join('\n');
  const result = await translate(joined, { from: 'fa', to: 'ar' });
  const lines = result.text.split('\n');
  if (lines.length !== keys.length) {
    throw new Error(`chunk${num} line mismatch ${lines.length} vs ${keys.length}`);
  }
  const ar: Record<string, string> = {};
  keys.forEach((key, i) => {
    ar[key] = restore(lines[i] ?? '', protectedRows[i]?.tokens ?? []);
  });
  fs.writeFileSync(path.join(dir, `ar-designer-chunk${num}.json`), `${JSON.stringify(ar, null, 2)}\n`, 'utf8');
  console.log(`ar-designer-chunk${num}`, keys.length);
}

async function main(): Promise<void> {
  for (const num of [2, 3, 4] as const) {
    await convertChunk(num);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
