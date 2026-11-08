import { execSync } from 'node:child_process';
import fs from 'node:fs';

const j = JSON.parse(fs.readFileSync('knip-out.json', 'utf8'));
const iss = Array.isArray(j.issues) ? j.issues : Object.values(j.issues);
const all = [];
for (const item of iss) {
  for (const e of item.exports ?? []) {
    all.push({ file: item.file.replace(/\\/g, '/'), name: e.name, line: e.line });
  }
}

function isUsedExternally(file, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const out = execSync(`rg -l "\\b${esc}\\b" src --glob "!${file}"`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    }).trim();
    if (!out) return false;
    const files = out.split(/\r?\n/).filter(Boolean);
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      const importRe = new RegExp(
        `\\bimport\\b[^;\\n]*\\b${esc}\\b|\\bexport\\s*\\{[^}]*\\b${esc}\\b|import\\s+type\\s*\\{[^}]*\\b${esc}\\b|import\\s+\\b${esc}\\b\\s+from`,
      );
      if (importRe.test(content)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

const safe = [];
for (const entry of all) {
  const { file, name } = entry;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) continue;
  if (name.length < 5) continue;
  if (isUsedExternally(file, name)) continue;
  safe.push(entry);
}

fs.writeFileSync('knip-safe-unexport.json', JSON.stringify(safe, null, 2));
console.log('total unused exports', all.length);
console.log('safe to unexport (verified)', safe.length);

const byFile = {};
for (const e of safe) {
  byFile[e.file] = (byFile[e.file] ?? 0) + 1;
}
const top = Object.entries(byFile)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40);
console.log('\nTop files:');
for (const [f, c] of top) console.log(`${c}\t${f}`);
