/**
 * One-shot: standard list toolbars → ListPageToolbarFrame; page roots → ListPageShell.
 * Run: node scripts/migrate-list-page-shell.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'src');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue;
      walk(p, acc);
    } else if (p.endsWith('.tsx')) {
      acc.push(p);
    }
  }
  return acc;
}

const frameOpenRe =
  /<ListPageToolbarScrollRoot[^>]*\n?\s*>/g;
const frameClose = '</ListPageToolbarScrollRoot>';

function migrateToolbarFile(file, text) {
  if (!text.includes('ListPageToolbarScrollRoot')) return text;
  let next = text.replace(frameOpenRe, '<ListPageToolbarFrame>\n');
  next = next.replaceAll(frameClose, '</ListPageToolbarFrame>');
  if (!next.includes('ListPageToolbarFrame')) return text;

  if (!next.includes('ListPageToolbarFrame')) return next;

  if (next.includes("from '../../../shared/ui/list-page/listPageToolbarChrome'")) {
    next = next.replace(
      /import\s*\{[^}]*ListPageToolbarScrollRoot[^}]*\}\s*from\s*['"][^'"]*listPageToolbarChrome['"];?\n/g,
      '',
    );
  }
  if (next.includes("from '../../../../shared/ui/list-page/listPageToolbarChrome'")) {
    next = next.replace(
      /import\s*\{[^}]*ListPageToolbarScrollRoot[^}]*\}\s*from\s*['"][^'"]*listPageToolbarChrome['"];?\n/g,
      '',
    );
  }

  const uiImport = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]*shared\/ui)['"];?/;
  const m = next.match(uiImport);
  if (m && !m[1].includes('ListPageToolbarFrame')) {
    const items = m[1].trim();
    const withoutSingleRow = items
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s !== 'PAGE_TOOLBAR_SINGLE_ROW_CLASS')
      .join(',\n  ');
    const added = withoutSingleRow
      ? `${withoutSingleRow},\n  ListPageToolbarFrame,`
      : 'ListPageToolbarFrame,';
    next = next.replace(uiImport, `import {\n  ${added}\n} from '${m[2]}';`);
  } else if (!m && !next.includes('ListPageToolbarFrame')) {
    next = `import { ListPageToolbarFrame } from '../../../shared/ui';\n${next}`;
  }

  next = next.replace(/\n\s*listToolbarCollapsed\?: boolean;\n/g, '\n');
  next = next.replace(/\n\s*listToolbarCollapsed = false,\n/g, '\n');
  next = next.replace(/\n\s*listToolbarCollapsed,\n/g, '\n');
  next = next.replace(/,?\s*listToolbarCollapsed=\{[^}]+\}/g, '');
  next = next.replace(/,?\s*listToolbarCollapsed=\{page\.listToolbarCollapsed\}/g, '');
  return next;
}

let changed = 0;
for (const file of walk(src)) {
  const rel = path.relative(root, file);
  if (rel.includes('list-page\\ListPage') || rel.includes('list-page/ListPage')) continue;
  let text = fs.readFileSync(file, 'utf8');
  const b = migrateToolbarFile(file, text);
  if (b !== text) {
    fs.writeFileSync(file, b);
    changed += 1;
    console.log('updated', rel);
  }
}
console.log('files changed:', changed);
