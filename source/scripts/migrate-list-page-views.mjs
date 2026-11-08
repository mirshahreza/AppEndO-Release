import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'src', 'features');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (p.endsWith('PageView.tsx') || p.endsWith('Workspace.tsx') || p.endsWith('Workspace.tsx')) acc.push(p);
    else if (name.endsWith('Workspace.tsx') || name.endsWith('PageView.tsx')) acc.push(p);
  }
  return acc;
}

const roots = [
  '<div className="flex h-full min-h-0 w-full flex-col bg-white font-sans">',
  '<div className="flex h-full w-full flex-col bg-white font-sans">',
  '<div className="flex h-full min-h-0 w-full flex-col bg-white">',
];

function migrate(text) {
  if (text.includes('ListPageShell')) return text;
  let hit = null;
  for (const r of roots) {
    if (text.includes(r)) {
      hit = r;
      break;
    }
  }
  if (!hit) return text;
  let next = text.replace(
    hit,
    '<ListPageShell onGridScroll={page.onGridScroll}>',
  );
  const idx = next.lastIndexOf('</div>');
  if (idx === -1) return text;
  next = `${next.slice(0, idx)}</ListPageShell>${next.slice(idx + 6)}`;
  next = next.replace(/\s*onScroll=\{page\.handleGridScroll\}/g, '');
  next = next.replace(/\s*onScroll=\{page\.onGridScroll\}/g, '');
  next = next.replace(/\s*listToolbarCollapsed=\{page\.listToolbarCollapsed\}/g, '');
  const uiImport = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]*shared\/ui)['"];?/;
  const m = next.match(uiImport);
  if (m && !m[1].includes('ListPageShell')) {
    next = next.replace(
      uiImport,
      `import {\n  ${m[1].trim()},\n  ListPageShell,\n} from '${m[2]}';`,
    );
  }
  return next;
}

let n = 0;
for (const file of walk(src)) {
  const text = fs.readFileSync(file, 'utf8');
  const next = migrate(text);
  if (next !== text) {
    fs.writeFileSync(file, next);
    n += 1;
    console.log(path.relative(root, file));
  }
}
console.log('views', n);
