/**
 * Strip per-page toolbar scroll hooks; expose onGridScroll for ListPageShell when needed.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const hooksDir = path.join(root, 'src');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue;
      walk(p, acc);
    } else if (/use\w+\.(tsx?)$/.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

function migrateHook(text) {
  if (!text.includes('useListPageToolbarScroll') && !text.includes('useCollapsingListToolbar')) {
    return text;
  }
  let next = text;
  next = next.replace(
    /import\s*\{[^}]*useListPageToolbarScroll[^}]*\}\s*from\s*['"][^'"]+['"];?\n/g,
    '',
  );
  next = next.replace(
    /import\s*\{[^}]*useCollapsingListToolbar[^}]*\}\s*from\s*['"][^'"]+['"];?\n/g,
    '',
  );
  next = next.replace(
    /const\s*\{\s*listToolbarCollapsed,\s*handleGridScroll\s*\}\s*=\s*useListPageToolbarScroll\([^)]*\);\s*\n/g,
    '',
  );
  next = next.replace(
    /const\s*\{\s*listToolbarCollapsed,\s*onListBodyScroll\s*\}\s*=\s*useCollapsingListToolbar\(\);\s*\n/g,
    '',
  );
  next = next.replace(
    /const\s*handleGridScroll\s*=\s*useCallback\(\(event:\s*UIEvent<HTMLDivElement>\)\s*=>\s*\{\s*onListBodyScroll\(event\.currentTarget\.scrollTop,\s*event\.currentTarget\);\s*/g,
    'const onGridScroll = useCallback((event: UIEvent<HTMLDivElement>) => {\n    ',
  );
  next = next.replace(
    /const\s*handleGridScroll\s*=\s*useCallback\(\(event:\s*UIEvent<HTMLDivElement>\)\s*=>\s*\{\s*/g,
    'const onGridScroll = useCallback((event: UIEvent<HTMLDivElement>) => {\n    ',
  );
  next = next.replace(/\bhandleGridScroll\b/g, (match, offset, str) => {
    const before = str.slice(0, offset);
    if (before.endsWith('onGridScroll = useCallback')) return match;
    return 'onGridScroll';
  });
  next = next.replace(/\n\s*listToolbarCollapsed,\n/g, '\n');
  next = next.replace(/,?\s*listToolbarCollapsed,?\n/g, '\n');
  return next;
}

let changed = 0;
for (const file of walk(hooksDir)) {
  const text = fs.readFileSync(file, 'utf8');
  const next = migrateHook(text);
  if (next !== text) {
    fs.writeFileSync(file, next);
    changed += 1;
    console.log('hook', path.relative(root, file));
  }
}
console.log('hooks changed:', changed);
