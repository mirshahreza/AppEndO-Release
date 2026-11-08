import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const targetFiles = process.argv.slice(2);
if (!targetFiles.length) {
  console.error('Usage: node tmp-knip-unexport-batch.mjs <file1> ...');
  process.exit(1);
}

const j = JSON.parse(fs.readFileSync('knip-out.json', 'utf8'));
const iss = Array.isArray(j.issues) ? j.issues : Object.values(j.issues);
const byFile = new Map();
for (const item of iss) {
  const file = item.file.replace(/\\/g, '/');
  if (!item.exports?.length) continue;
  byFile.set(file, item.exports.map((e) => e.name));
}

function moduleSuffixes(file) {
  const base = path.basename(file).replace(/\.tsx?$/, '');
  return [base, `${base}.ts`, `${base}.tsx`];
}

function isImportedFromExternal(name, file, mentionFiles) {
  const suffixes = moduleSuffixes(file);
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const mf of mentionFiles) {
    const norm = mf.replace(/\\/g, '/');
    if (norm === file) continue;
    const content = fs.readFileSync(mf, 'utf8');
    if (!new RegExp(`\\b${esc}\\b`).test(content)) continue;
    const importBlocks = content.match(/import[\s\S]*?from\s+['"][^'"]+['"]/g) ?? [];
    for (const block of importBlocks) {
      if (!new RegExp(`\\b${esc}\\b`).test(block)) continue;
      const from = block.match(/from\s+['"]([^'"]+)['"]/)?.[1] ?? '';
      if (suffixes.some((s) => from.endsWith(s) || from.includes(`/${s}`))) {
        return true;
      }
    }
    const exportFrom = content.match(new RegExp(`export\\s*\\{[^}]*\\b${esc}\\b[^}]*\\}\\s*from\\s+['"][^'"]+['"]`, 'g')) ?? [];
    for (const block of exportFrom) {
      const from = block.match(/from\s+['"]([^'"]+)['"]/)?.[1] ?? '';
      if (suffixes.some((s) => from.endsWith(s) || from.includes(`/${s}`))) {
        return true;
      }
    }
  }
  return false;
}

function externalMentions(name, file) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const out = execSync(`rg -l "\\b${esc}\\b" src --glob "!${file}"`, {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    }).trim();
    return out ? out.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    return [];
  }
}

let total = 0;
for (const fileArg of targetFiles) {
  const file = fileArg.replace(/\\/g, '/');
  const names = byFile.get(file);
  if (!names?.length) {
    console.log('skip (no knip exports):', file);
    continue;
  }
  let src = fs.readFileSync(file, 'utf8');
  let changed = 0;
  for (const name of names) {
    const mentions = externalMentions(name, file);
    if (isImportedFromExternal(name, file, mentions)) continue;
    const re = new RegExp(
      `\\bexport\\s+(const|function|type|interface|enum|class)\\s+(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`,
    );
    if (re.test(src)) {
      src = src.replace(re, '$1 $2');
      changed++;
      total++;
    }
  }
  if (changed) {
    fs.writeFileSync(file, src);
    console.log(`updated ${file}: unexported ${changed}`);
  } else {
    console.log(`no changes ${file}`);
  }
}
console.log('total unexported', total);
